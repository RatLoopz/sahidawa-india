from __future__ import annotations

import io
import logging
from statistics import mean, pstdev
from urllib.parse import quote, urlparse, urlunparse

import requests
from fastapi import APIRouter, HTTPException
from PIL import Image, ImageStat, UnidentifiedImageError
from pydantic import BaseModel, HttpUrl

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyze", tags=["Image Analysis"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 6
SUPPORTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
CLOUDINARY_IMAGE_HOST = "res.cloudinary.com"


class AnalyzeImageRequest(BaseModel):
    imageUrl: HttpUrl


class AnalyzeImageResponse(BaseModel):
    isFake: bool
    confidence: float
    verdict: str
    details: str


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


def _read_limited_image(url: str) -> bytes:
    image_url = _canonical_cloudinary_image_url(url)

    try:
        response = requests.get(image_url, timeout=REQUEST_TIMEOUT_SECONDS, stream=True)
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("Failed to download medicine image for analysis: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to download image for analysis.") from exc

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

    if not chunks:
        raise HTTPException(status_code=400, detail="Medicine image is empty.")

    return b"".join(chunks)


def _score_packaging_image(image_bytes: bytes) -> AnalyzeImageResponse:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image = image.convert("RGB")
            image.thumbnail((512, 512))
            grayscale = image.convert("L")
            stat = ImageStat.Stat(grayscale)
            brightness = float(stat.mean[0])
            contrast = float(stat.stddev[0])
            rgb_means = [float(channel) for channel in ImageStat.Stat(image).mean]
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Uploaded URL did not contain a readable image.") from exc

    channel_spread = pstdev(rgb_means) if len(rgb_means) > 1 else 0.0
    quality_score = (
        min(contrast / 70, 1.0) * 0.5
        + (1.0 - abs(brightness - 150) / 150) * 0.35
        + min(channel_spread / 45, 1.0) * 0.15
    )
    quality_score = max(0.0, min(1.0, quality_score))

    if brightness < 35 or contrast < 9:
        return AnalyzeImageResponse(
            isFake=True,
            confidence=round(1.0 - quality_score, 2),
            verdict="likely_fake",
            details="Packaging photo has very low visual signal; advise citizen not to consume until verified.",
        )

    if brightness < 65 or contrast < 20 or quality_score < 0.45:
        return AnalyzeImageResponse(
            isFake=False,
            confidence=round(1.0 - quality_score / 2, 2),
            verdict="suspicious",
            details="Packaging photo needs pharmacist review; report is recommended before consumption.",
        )

    return AnalyzeImageResponse(
        isFake=False,
        confidence=round(max(0.62, mean([quality_score, 0.78])), 2),
        verdict="likely_genuine",
        details="Packaging photo passed the preliminary visual quality scan.",
    )


@router.post("", response_model=AnalyzeImageResponse)
def analyze_image(payload: AnalyzeImageRequest) -> AnalyzeImageResponse:
    image_bytes = _read_limited_image(str(payload.imageUrl))
    return _score_packaging_image(image_bytes)
