import os
import argparse
import cloudinary
import cloudinary.api
import cloudinary.search
import requests
import tensorflow as tf
from dotenv import load_dotenv

# Load environment variables (Cloudinary credentials)
load_dotenv()

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

DATA_DIR = "data/cloudinary_dataset"
MODEL_PATH = "mobilenetv3_large_checkpoint.keras"
OUTPUT_MODEL_PATH = "mobilenetv3_large_finetuned.keras"
BATCH_SIZE = 32
IMG_SIZE = (224, 224)
EPOCHS = 10

def download_image(url, save_path):
    if not os.path.exists(save_path):
        try:
            response = requests.get(url, stream=True)
            if response.status_code == 200:
                with open(save_path, 'wb') as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
        except Exception as e:
            print(f"Failed to download {url}: {e}")

def fetch_cloudinary_dataset(tag_real="real-medicine", tag_fake="fake-medicine"):
    print("Fetching Cloudinary dataset metadata...")
    os.makedirs(os.path.join(DATA_DIR, "Real"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "Fake"), exist_ok=True)

    # Fetch Real
    print(f"Downloading images for tag '{tag_real}'...")
    try:
        real_resources = cloudinary.search.Search().expression(f"tags:{tag_real}").max_results(100).execute()
        for res in real_resources.get('resources', []):
            url = res['secure_url']
            filename = f"{res['public_id'].split('/')[-1]}.jpg"
            save_path = os.path.join(DATA_DIR, "Real", filename)
            download_image(url, save_path)
    except Exception as e:
        print(f"Error fetching Real images: {e}")

    # Fetch Fake
    print(f"Downloading images for tag '{tag_fake}'...")
    try:
        fake_resources = cloudinary.search.Search().expression(f"tags:{tag_fake}").max_results(100).execute()
        for res in fake_resources.get('resources', []):
            url = res['secure_url']
            filename = f"{res['public_id'].split('/')[-1]}.jpg"
            save_path = os.path.join(DATA_DIR, "Fake", filename)
            download_image(url, save_path)
    except Exception as e:
        print(f"Error fetching Fake images: {e}")

def load_and_prep_data():
    if not os.path.exists(DATA_DIR):
        raise ValueError(f"Dataset directory {DATA_DIR} not found.")

    train_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR,
        validation_split=0.2,
        subset="training",
        seed=123,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR,
        validation_split=0.2,
        subset="validation",
        seed=123,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE
    )

    class_names = train_ds.class_names
    print(f"Found classes: {class_names}")

    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.cache().shuffle(1000).prefetch(buffer_size=AUTOTUNE)
    val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)

    return train_ds, val_ds, len(class_names)

def fine_tune_model(train_ds, val_ds, num_classes, dry_run=False):
    print(f"Loading base model from {MODEL_PATH}...")
    base_model = tf.keras.models.load_model(MODEL_PATH)
    
    # Optional: freeze earlier layers
    for layer in base_model.layers[:-10]:
        layer.trainable = False

    # Pop last layer and append new Dense layer for the new num_classes
    x = base_model.layers[-2].output
    outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
    model = tf.keras.Model(inputs=base_model.inputs, outputs=outputs)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=False),
        metrics=['accuracy']
    )

    if dry_run:
        print("Dry run enabled. Skipping training.")
        return model

    print("Starting fine-tuning...")
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS
    )

    print(f"Saving fine-tuned model to {OUTPUT_MODEL_PATH}...")
    model.save(OUTPUT_MODEL_PATH)
    return model

def main():
    parser = argparse.ArgumentParser(description="Fine-tune model on Cloudinary dataset")
    parser.add_argument("--dry-run", action="store_true", help="Download dataset and load model without training")
    parser.add_argument("--tag-real", default="real-medicine", help="Cloudinary tag for real medicine images")
    parser.add_argument("--tag-fake", default="fake-medicine", help="Cloudinary tag for fake medicine images")
    parser.add_argument("--skip-download", action="store_true", help="Skip Cloudinary dataset download")
    args = parser.parse_args()

    if not args.skip_download:
        fetch_cloudinary_dataset(args.tag_real, args.tag_fake)

    try:
        train_ds, val_ds, num_classes = load_and_prep_data()
        fine_tune_model(train_ds, val_ds, num_classes, dry_run=args.dry_run)
    except Exception as e:
        print(f"Fine-tuning failed: {e}")

if __name__ == "__main__":
    main()
