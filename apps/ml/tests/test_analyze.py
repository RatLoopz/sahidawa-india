from __future__ import annotations

import io
import pytest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import numpy as np
import requests

from apps.ml.routers.analyze import router, _dct2

# Minimal FastAPI setup to host the router for isolated integration tests
app = FastAPI()
app.include_router(router)
client = TestClient(app)

TARGET_MODULE = "apps.ml.routers.analyze"


# --- Helper Utilities to Generate Valid Image Payloads for Testing ---
def create_dummy_image_bytes(color: str = "white", size: tuple[int, int] = (100, 100)) -> bytes:
    """Generates valid image raw bytes to pass PIL/OpenCV decoding stages."""
    img = Image.new("RGB", size, color=color)
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    return img_byte_arr.getvalue()


def create_mock_response(status_code: int = 200, content_type: str = "image/png", chunks: list[bytes] | None = None) -> MagicMock:
    """Creates a configured mock response with explicit lifecycle closures."""
    mock_res = MagicMock()
    mock_res.status_code = status_code
    mock_res.headers = {"content-type": content_type}
    mock_res.raise_for_status = MagicMock(return_value=None)
    mock_res.close = MagicMock()
    if chunks:
        mock_res.iter_content.return_value = chunks
    return mock_res


# --- Test Cases ---

def test_analyze_identical_images():
    """Verifies that identical images yield a 'likely_genuine' verdict."""
    img_bytes = create_dummy_image_bytes(color="blue")
    mock_response = create_mock_response(chunks=[img_bytes])

    with patch("requests.get", return_value=mock_response):
        payload = {
            "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
            "medicineId": "crocin-650"
        }
        response = client.post("/analyze", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["isFake"] is False
        assert data["verdict"] == "likely_genuine"
        assert data["hashSimilarity"] >= 0.95
        assert 0.0 <= data["confidence"] <= 1.0


def test_analyze_clearly_different_images():
    """Verifies that structurally altered images score below benchmarks, triggering suspect/fake labels."""
    # Image A: Solid Black block
    img_bytes_a = create_dummy_image_bytes(color="black", size=(128, 128))
    
    # Image B: White background with an asymmetric high-contrast shape to force pHash matrices to diverge
    img_b = Image.new("RGB", (128, 128), color="white")
    draw = ImageDraw.Draw(img_b)
    draw.rectangle([10, 10, 60, 110], fill="black")
    img_byte_arr = io.BytesIO()
    img_b.save(img_byte_arr, format="PNG")
    img_bytes_b = img_byte_arr.getvalue()

    # Sequence of responses: 1st call fetches user payload, 2nd call fetches server reference asset
    mock_res_upload = create_mock_response(chunks=[img_bytes_a])
    mock_res_ref = create_mock_response(chunks=[img_bytes_b])

    with patch("requests.get", side_effect=[mock_res_upload, mock_res_ref]):
        payload = {
            "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
            "medicineId": "crocin-650"
        }
        response = client.post("/analyze", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["verdict"] in ["suspicious", "likely_fake"]
        assert 0.0 <= data["confidence"] <= 1.0


def test_unknown_medicine_id():
    """Verifies that an unmapped medicineId triggers a 404 error."""
    payload = {
        "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
        "medicineId": "unknown-drug-id"
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 404
    assert "No verified reference image is registered" in response.json()["detail"]


@pytest.mark.parametrize("invalid_url, expected_detail", [
    ("http://res.cloudinary.com/sahidawa/image/upload/img.png", "Only HTTPS image URLs are accepted."),
    ("https://res.cloudinary.com:8443/sahidawa/image/upload/img.png", "Only Cloudinary image delivery URLs are accepted."),
    ("https://user:pass@res.cloudinary.com/sahidawa/image/upload/img.png", "Only Cloudinary image delivery URLs are accepted."),
    ("https://res.cloudinary.com/sahidawa/not-an-image/upload/img.png", "Cloudinary URL must point to an image asset."),
    ("https://res.cloudinary.com/sahidawa/image/upload/img.png?redirect=true", "Cloudinary image URL cannot include extra parameters."),
])
def test_invalid_cloudinary_url_edge_cases(invalid_url, expected_detail):
    """Parametric validation checking structural URL security layers without triggering remote lookups."""
    payload = {"imageUrl": invalid_url, "medicineId": "crocin-650"}
    response = client.post("/analyze", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == expected_detail


def test_untrusted_host_never_reaches_requests():
    """Verifies that an unauthorized/untrusted hostname fails early and never attempts an external fetch."""
    with patch("requests.get") as mock_get:
        payload = {"imageUrl": "https://malicious-domain.com/image.png", "medicineId": "crocin-650"}
        response = client.post("/analyze", json=payload)
        assert response.status_code == 400
        mock_get.assert_not_called()


def test_unsupported_mime_type():
    """Verifies that illegal media formats (e.g., application/json or image/gif) fail validation."""
    mock_response = create_mock_response(content_type="image/gif")
    
    with patch("requests.get", return_value=mock_response):
        payload = {
            "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
            "medicineId": "crocin-650"
        }
        response = client.post("/analyze", json=payload)
        assert response.status_code == 400
        assert "Unsupported medicine image type" in response.json()["detail"]


def test_oversized_image_stream():
    """Verifies that network downloads exceeding the chunk allocation limit cause a 413 error payload."""
    mock_response = create_mock_response(chunks=[b"0" * (8 * 1024 * 1024 + 1)])

    with patch("requests.get", return_value=mock_response):
        payload = {
            "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
            "medicineId": "crocin-650"
        }
        response = client.post("/analyze", json=payload)
        assert response.status_code == 413
        assert "Medicine image exceeds analysis size limit" in response.json()["detail"]


def test_empty_response_body():
    """Verifies that zero-length payload downloads trigger an explicit 400 validation error."""
    mock_response = create_mock_response(chunks=[b""])

    with patch("requests.get", return_value=mock_response):
        payload = {
            "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
            "medicineId": "crocin-650"
        }
        response = client.post("/analyze", json=payload)
        assert response.status_code == 400
        assert "Medicine image is empty" in response.json()["detail"]


def test_invalid_image_bytes():
    """Verifies that corrupted, unparseable byte arrays trigger a 400 error during processing."""
    mock_response = create_mock_response(chunks=[b"corrupted_binary_data"])

    with patch("requests.get", return_value=mock_response):
        payload = {
            "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
            "medicineId": "crocin-650"
        }
        response = client.post("/analyze", json=payload)
        assert response.status_code == 400
        assert "Uploaded URL did not contain a readable image" in response.json()["detail"]


@pytest.mark.parametrize("fail_on_first_call", [True, False])
def test_download_failures_and_connection_cleanup(fail_on_first_call):
    """Verifies that network errors return 502, and processed resources are freed gracefully."""
    mock_res_ok = create_mock_response(chunks=[create_dummy_image_bytes()])
    
    mock_res_err = MagicMock()
    mock_res_err.raise_for_status = MagicMock()
    mock_res_err.raise_for_status.side_effect = requests.RequestException("Network exception")
    mock_res_err.close = MagicMock()

    side_effects = [mock_res_err, mock_res_ok] if fail_on_first_call else [mock_res_ok, mock_res_err]

    with patch("requests.get", side_effect=side_effects) as mock_get:
        payload = {
            "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
            "medicineId": "crocin-650"
        }
        response = client.post("/analyze", json=payload)
        
        assert response.status_code == 502
        assert "Unable to download image for analysis" in response.json()["detail"]
        
        # Ensures that close() is evaluated solely on mocks executed before network termination
        called_count = mock_get.call_count
        for i in range(called_count):
            side_effects[i].close.assert_called_once()


def test_opencv_unavailable_fallback():
    """Forcibly stubs out OpenCV to verify the native NumPy pHash fallback and null feature metrics work smoothly."""
    img_bytes = create_dummy_image_bytes()
    mock_response = create_mock_response(chunks=[img_bytes])

    with patch("requests.get", return_value=mock_response), \
         patch(f"{TARGET_MODULE}._HAS_CV2", False):
         
        payload = {
            "imageUrl": "https://res.cloudinary.com/sahidawa/image/upload/v1/reference/test.png", 
            "medicineId": "crocin-650"
        }
        response = client.post("/analyze", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["featureSimilarity"] is None
        assert data["hashSimilarity"] is not None
        assert 0.0 <= data["confidence"] <= 1.0


def test_dct2_pure_numpy_implementation():
    """Direct testing of the fallback discrete cosine transform formula mathematical calculation flow."""
    matrix = np.random.rand(8, 8)
    with patch(f"{TARGET_MODULE}._HAS_CV2", False):
        res = _dct2(matrix)
        assert res.shape == (8, 8)
        assert isinstance(res, np.ndarray)