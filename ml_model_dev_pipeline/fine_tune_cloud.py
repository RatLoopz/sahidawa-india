# TODO
# implement fine-tuning on cloudinary images

def load_model():
    raise NotImplementedError("Load model functionality not implemented yet.")

def fine_tune_model(model):
    raise NotImplementedError("Fine-tuning functionality not implemented yet.")

def save_model(model):
    raise NotImplementedError("Save model functionality not implemented yet.")


def main():
    model = load_model()
    tuned_model = fine_tune_model(model)
    save_model(tuned_model)

if __name__ == "__main__":
    main()