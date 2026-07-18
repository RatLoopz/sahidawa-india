import logging
from pathlib import Path
from typing import Optional, Tuple
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

try:
    import tflite_runtime.interpreter as tflite
    TFLITE_AVAILABLE = True
except ImportError:
    TFLITE_AVAILABLE = False
    logger.warning("tflite_runtime is not installed. TensorFlow Lite inference will be disabled.")

class TFLiteModelRunner:
    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.interpreter = None
        self.input_details = None
        self.output_details = None
        self.is_loaded = False
        
        if TFLITE_AVAILABLE and self.model_path.exists():
            try:
                self.interpreter = tflite.Interpreter(model_path=str(self.model_path))
                self.interpreter.allocate_tensors()
                self.input_details = self.interpreter.get_input_details()
                self.output_details = self.interpreter.get_output_details()
                self.is_loaded = True
                logger.info(f"Successfully loaded TFLite model: {self.model_path.name}")
            except Exception as e:
                logger.error(f"Failed to load TFLite model at {model_path}: {e}")
        else:
            if not self.model_path.exists():
                logger.warning(f"TFLite model not found at {model_path}")

    def predict(self, image: Image.Image) -> Optional[Tuple[float, dict]]:
        """
        Runs inference on the provided image.
        Returns a tuple of (counterfeit_probability, metadata_dict),
        or None if the model is not loaded.
        """
        if not self.is_loaded or self.interpreter is None:
            return None

        try:
            # Prepare image based on input details
            input_shape = self.input_details[0]['shape'] # typically [1, H, W, 3]
            input_dtype = self.input_details[0]['dtype']
            
            # Extract expected height and width
            height = input_shape[1] if len(input_shape) > 1 else 224
            width = input_shape[2] if len(input_shape) > 2 else 224

            # Resize and convert to RGB
            img_resized = image.convert("RGB").resize((width, height))
            input_data = np.asarray(img_resized, dtype=np.float32)

            # Add batch dimension
            input_data = np.expand_dims(input_data, axis=0)

            # Handle quantization if required by the model
            if input_dtype == np.uint8:
                input_data = input_data.astype(np.uint8)
            elif input_dtype == np.int8:
                input_data = (input_data - 127.5).astype(np.int8)

            # Set tensor and invoke
            self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
            self.interpreter.invoke()

            # Get output
            output_data = self.interpreter.get_tensor(self.output_details[0]['index'])[0]
            output_dtype = self.output_details[0]['dtype']

            # Dequantize output if it is int8 or uint8
            if output_dtype in [np.uint8, np.int8]:
                scale, zero_point = self.output_details[0]['quantization']
                if scale > 0.0:
                    output_data = (output_data.astype(np.float32) - zero_point) * scale

            # Parse probabilities
            # Assuming output is either a single sigmoid probability or a softmax array [genuine, fake]
            if len(output_data) == 1:
                fake_prob = float(output_data[0])
            elif len(output_data) >= 2:
                # We assume index 1 is "fake" / "counterfeit"
                if np.sum(output_data) > 1.1 or np.sum(output_data) < 0.9:
                    # Apply softmax if logits
                    exp_preds = np.exp(output_data - np.max(output_data))
                    output_data = exp_preds / np.sum(exp_preds)
                fake_prob = float(output_data[1])
            else:
                fake_prob = 0.0

            metadata = {
                "model": self.model_path.name,
                "input_dtype": str(input_dtype),
                "output_shape": str(self.output_details[0]['shape']),
            }

            return (fake_prob, metadata)

        except Exception as e:
            logger.error(f"Error during TFLite inference: {e}")
            return None

# Singleton instance using the default model
DEFAULT_MODEL_PATH = Path(__file__).parent.parent / "models" / "mobilenetv3_large_int8.tflite"
tflite_runner = TFLiteModelRunner(str(DEFAULT_MODEL_PATH))
