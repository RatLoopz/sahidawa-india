import pytest
import numpy as np
from PIL import Image
from services.tflite_inference import TFLiteModelRunner

def test_tflite_runner_initialization(tmp_path):
    # Test with non-existent model
    fake_model_path = tmp_path / "fake.tflite"
    runner = TFLiteModelRunner(str(fake_model_path))
    assert not runner.is_loaded
    assert runner.predict(Image.new("RGB", (224, 224))) is None

def test_tflite_predict_unloaded_model():
    runner = TFLiteModelRunner("does_not_exist.tflite")
    assert runner.predict(Image.new("RGB", (224, 224))) is None

# If tflite_runtime is available, we could test a dummy model,
# but it requires creating a valid flatbuffer which is complex.
# This test suite ensures the robust error handling works.
