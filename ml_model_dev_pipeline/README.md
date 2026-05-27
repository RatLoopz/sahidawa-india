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
- TODO: implement fine-tuning on the custom Cloudinary dataset

