## ML Model Dev Pipeline

setup -
```bash
pip install -r requirements.txt 
```
### Pretraining

- Notebook: [pre_train_exp.ipynb](pre_train_exp.ipynb)
- Model: ModelNet V3 Large
- Dataset: https://www.kaggle.com/api/v1/datasets/download/surajkumarjha1/fake-vs-real-medicine-datasets-images
- Target: INT8 quantization, export TFLite under 5 MB
- Reported accuracy: 98%

### Fine-tuning

- script: [fine_tune_cloud.py](fine_tune_cloud.py)

To run the fine-tuning on the custom Cloudinary dataset:
```bash
# Ensure you have your Cloudinary credentials in a .env file:
# CLOUDINARY_CLOUD_NAME=...
# CLOUDINARY_API_KEY=...
# CLOUDINARY_API_SECRET=...

# Run the fine-tuning script
python fine_tune_cloud.py --tag-real real-medicine --tag-fake fake-medicine
```

