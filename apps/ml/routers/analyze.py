from __future__ import annotations

import io
import logging
from urllib.parse import quote, urlparse, urlunparse

import numpy as np
import requests
from fastapi import APIRouter, HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, HttpUrl, Field

try:
    import cv2
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False

logger = logging.getLogger(__name__)

try:
    from services.tflite_inference import tflite_runner
except ImportError:
    tflite_runner = None

router = APIRouter(prefix="/analyze", tags=["Image Analysis"])

# Configurations & Limits
MAX_IMAGE_BYTES = 8 * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 6
SUPPORTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
CLOUDINARY_IMAGE_HOST = "res.cloudinary.com"

# Perceptual Hashing & Feature Matching Parameters
PHASH_SIZE = 32
PHASH_LOW_FREQ = 8
ORB_FEATURES = 500
ORB_GOOD_MATCH_RATIO = 0.75
ORB_MIN_MATCHES = 15

# Scoring Thresholds
FAKE_THRESHOLD = 0.45
SUSPICIOUS_THRESHOLD = 0.70

# Server-owned reference dataset (Mocked/Simple Database fallback)
REFERENCE_IMAGES: dict[str, str] = {
    "crocin-650": "https://res.cloudinary.com/sahidawa/image/upload/reference/crocin-650.png",
    "dolo-650": "https://res.cloudinary.com/sahidawa/image/upload/reference/dolo-650.png",
}


class AnalyzeImageRequest(BaseModel):
    imageUrl: HttpUrl
    medicineId: str = Field(..., min_length=1, max_length=100)


class AnalyzeImageResponse(BaseModel):
    isFake: bool
    confidence: float
    verdict: str
    details: str
    hashSimilarity: float
    featureSimilarity: float | None = None
    tfliteConfidence: float | None = None


def _canonical_cloudinary_image_url(url: str) -> str:
    parsed_url = urlparse(url)
    if parsed_url.scheme != "https":
        raise HTTPException(status_code=400, detail="Only HTTPS image URLs are accepted.")

    if parsed_url.netloc != CLOUDINARY_IMAGE_HOST:
        raise HTTPException(status_code=400, detail="Only Cloudinary image delivery URLs are accepted.")

    if parsed_url.params or parsed_url.query or parsed_url.fragment:
        raise HTTPException(status_code=400, detail="Cloudinary image URL cannot include extra parameters.")

    path_segments = [segment for segment in parsed_url.path.split("/") if segment]
    if len(path_segments) < 3 or path_segments[1] != "image":
        raise HTTPException(status_code=400, detail="Cloudinary URL must point to an image asset.")

    safe_path = quote(parsed_url.path, safe="/._-")
    return urlunparse(("https", CLOUDINARY_IMAGE_HOST, safe_path, "", "", ""))


def _resolve_reference_url(medicine_id: str) -> str:
    reference_url = REFERENCE_IMAGES.get(medicine_id)
    if reference_url is None:
        raise HTTPException(
            status_code=404,
            detail=f"No verified reference image is registered for medicineId '{medicine_id}'.",
        )
    return reference_url


def _read_limited_image(url: str) -> bytes:
    image_url = _canonical_cloudinary_image_url(url)

    try:
        response = requests.get(image_url, timeout=REQUEST_TIMEOUT_SECONDS, stream=True)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
        if content_type and content_type not in SUPPORTED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported medicine image type.")

        chunks: list[bytes] = []
        total = 0
        for chunk in response.iter_content(chunk_size=64 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail="Medicine image exceeds analysis size limit.")
            chunks.append(chunk)
    except requests.RequestException as exc:
        logger.warning("Failed to download medicine image for analysis: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to download image for analysis.") from exc
    finally:
        if "response" in locals():
            response.close()

    if not chunks:
        raise HTTPException(status_code=400, detail="Medicine image is empty.")

    return b"".join(chunks)


def _load_and_preprocess(image_bytes: bytes) -> Image.Image:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Uploaded URL did not contain a readable image.") from exc

    image.thumbnail((512, 512))
    grayscale = ImageOps.autocontrast(image.convert("L"), cutoff=1)
    grayscale = ImageOps.equalize(grayscale)
    return grayscale


def _dct2(block: np.ndarray) -> np.ndarray:
    if _HAS_CV2:
        return cv2.dct(block.astype(np.float32)).astype(np.float64)

    def dct1(a: np.ndarray) -> np.ndarray:
        n = a.shape[-1]
        result = np.zeros_like(a)
        factor = np.pi / n
        for k in range(n):
            weights = np.cos(factor * (np.arange(n) + 0.5) * k)
            result[..., k] = np.sum(a * weights, axis=-1)
        return result

    return dct1(dct1(block.T).T)


def _phash(grayscale: Image.Image) -> np.ndarray:
    resized = grayscale.resize((PHASH_SIZE, PHASH_SIZE), Image.LANCZOS)
    pixels = np.asarray(resized, dtype=np.float64)

    dct = _dct2(pixels)
    low_freq = dct[:PHASH_LOW_FREQ, :PHASH_LOW_FREQ]
    median = np.median(low_freq)
    return (low_freq > median).flatten()


def _hamming_similarity(hash_a: np.ndarray, hash_b: np.ndarray) -> float:
    distance = int(np.count_nonzero(hash_a != hash_b))
    return 1.0 - (distance / hash_a.size)


def _orb_similarity(image_bytes_a: bytes, image_bytes_b: bytes) -> float | None:
    if not _HAS_CV2:
        return None

    array_a = np.frombuffer(image_bytes_a, dtype=np.uint8)
    array_b = np.frombuffer(image_bytes_b, dtype=np.uint8)
    img_a = cv2.imdecode(array_a, cv2.IMREAD_GRAYSCALE)
    img_b = cv2.imdecode(array_b, cv2.IMREAD_GRAYSCALE)
    if img_a is None or img_b is None:
        return None

    img_a = cv2.resize(img_a, (512, 512))
    img_b = cv2.resize(img_b, (512, 512))
    img_a = cv2.equalizeHist(img_a)
    img_b = cv2.equalizeHist(img_b)

    orb = cv2.ORB_create(nfeatures=ORB_FEATURES)
    kp_a, des_a = orb.detectAndCompute(img_a, None)
    kp_b, des_b = orb.detectAndCompute(img_b, None)

    if des_a is None or des_b is None or len(kp_a) < 2 or len(kp_b) < 2:
        return None

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    raw_matches = matcher.knnMatch(des_a, des_b, k=2)

    good_matches = []
    for pair in raw_matches:
        if len(pair) != 2:
            continue
        m, n = pair
        if m.distance == 0:
            good_matches.append(m)
        elif n.distance > 0 and m.distance < ORB_GOOD_MATCH_RATIO * n.distance:
            good_matches.append(m)

    max_possible = min(len(kp_a), len(kp_b))
    if max_possible == 0:
        return None

    return min(1.0, len(good_matches) / max(ORB_MIN_MATCHES, max_possible * 0.3))


def _clamp_confidence(value: float) -> float:
    return round(min(max(value, 0.0), 1.0), 2)


def _score_packaging(
    uploaded_bytes: bytes, reference_bytes: bytes
) -> AnalyzeImageResponse:
    uploaded_gray = _load_and_preprocess(uploaded_bytes)
    reference_gray = _load_and_preprocess(reference_bytes)

    hash_similarity = round(
        _hamming_similarity(_phash(uploaded_gray), _phash(reference_gray)), 4
    )
    feature_similarity = _orb_similarity(uploaded_bytes, reference_bytes)

    if feature_similarity is not None:
        combined = hash_similarity * 0.4 + feature_similarity * 0.6
    else:
        combined = hash_similarity

    tflite_confidence = None
    if tflite_runner is not None and tflite_runner.is_loaded:
        try:
            with Image.open(io.BytesIO(uploaded_bytes)) as image:
                uploaded_image_rgb = image.convert("RGB")
                tflite_res = tflite_runner.predict(uploaded_image_rgb)
                if tflite_res:
                    tflite_confidence, _ = tflite_res
        except Exception as e:
            logger.error(f"Failed to run TFLite inference: {e}")

    # Incorporate TFLite confidence into the combined score if available
    # TFLite predicts counterfeit probability, so 1.0 - tflite_confidence is genuine probability
    if tflite_confidence is not None:
        tflite_genuine_prob = 1.0 - tflite_confidence
        # Give TFLite 30% weight, CV 70% weight (adjustable)
        combined = combined * 0.7 + tflite_genuine_prob * 0.3

    if combined < FAKE_THRESHOLD:
        return AnalyzeImageResponse(
            isFake=True,
            confidence=_clamp_confidence(1.0 - combined),
            verdict="likely_fake",
            details="Packaging does not structurally match the verified reference image.",
            hashSimilarity=hash_similarity,
            featureSimilarity=feature_similarity,
            tfliteConfidence=tflite_confidence,
        )

    if combined < SUSPICIOUS_THRESHOLD:
        return AnalyzeImageResponse(
            isFake=False,
            confidence=_clamp_confidence(combined),
            verdict="suspicious",
            details="Packaging shows partial similarity to reference; pharmacist review recommended.",
            hashSimilarity=hash_similarity,
            featureSimilarity=feature_similarity,
            tfliteConfidence=tflite_confidence,
        )

    return AnalyzeImageResponse(
        isFake=False,
        confidence=_clamp_confidence(combined),
        verdict="likely_genuine",
        details="Packaging closely matches the verified reference image.",
        hashSimilarity=hash_similarity,
        featureSimilarity=feature_similarity,
        tfliteConfidence=tflite_confidence,
    )


@router.post("", response_model=AnalyzeImageResponse)
def analyze_image(payload: AnalyzeImageRequest) -> AnalyzeImageResponse:
    reference_url = _resolve_reference_url(payload.medicineId)
    uploaded_bytes = _read_limited_image(str(payload.imageUrl))
    reference_bytes = _read_limited_image(reference_url)
    return _score_packaging(uploaded_bytes, reference_bytes)