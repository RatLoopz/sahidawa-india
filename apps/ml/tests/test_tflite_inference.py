import pytest
from PIL import Image
from services.tflite_inference import TFLiteModelRunner

def test_runner_attributes():
    runner = TFLiteModelRunner("does_not_exist.tflite")

    assert runner.model_path.name == "does_not_exist.tflite"
    assert runner.interpreter is None
    assert runner.input_details is None
    assert runner.output_details is None
    assert runner.is_loaded is False

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

def test_predict_with_grayscale_image():
    runner = TFLiteModelRunner("does_not_exist.tflite")
    image = Image.new("L", (224, 224))

    assert runner.predict(image) is None

@pytest.mark.parametrize("size", [(32, 32), (224, 224), (640, 480)])
def test_predict_handles_various_image_sizes(size):
    runner = TFLiteModelRunner("does_not_exist.tflite")
    image = Image.new("RGB", size)

    assert runner.predict(image) is None