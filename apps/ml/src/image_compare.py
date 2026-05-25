from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import cv2
import numpy as np
import httpx
from PIL import Image
import io
import time
from pathlib import Path
from urllib.parse import urlparse
import ipaddress
import socket

router = APIRouter()


class CompareRequest(BaseModel):
    cloudinary_url: str
    medicine_name: Optional[str] = None


class CompareResponse(BaseModel):
    verdict: str
    confidence: float
    matched_reference: Optional[str] = None
    processing_time_ms: int
    error: Optional[str] = None


SEEDS_DIR = Path(__file__).parent.parent.parent.parent / "data" / "seeds" / "medicines"


def _is_public_host(hostname: str) -> bool:
    try:
        resolved = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host: {hostname}") from exc

    for family, _, _, _, sockaddr in resolved:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_global and not ip.is_private and not ip.is_loopback and not ip.is_link_local:
            return True

    raise ValueError(f"Host resolves to a non-public address: {hostname}")


def validate_cloudinary_url(url: str) -> httpx.URL:
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise ValueError("Only HTTPS Cloudinary URLs are allowed")

    if parsed.username or parsed.password:
        raise ValueError("Credentials are not allowed in Cloudinary URLs")

    host = parsed.hostname or ""
    if not host.endswith(".cloudinary.com"):
        raise ValueError("Only Cloudinary URLs are allowed")

    _is_public_host(host)

    normalized = httpx.URL(url)
    if not normalized.host:
        raise ValueError("Cloudinary URL must include a host")

    return normalized


def download_image(url: str) -> np.ndarray:
    safe_url = validate_cloudinary_url(url)

    with httpx.Client(timeout=10.0, follow_redirects=False) as client:
        response = client.get(safe_url)
        response.raise_for_status()

    image = Image.open(io.BytesIO(response.content)).convert("RGB")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def compute_orb_similarity(image_a: np.ndarray, image_b: np.ndarray) -> float:
    orb = cv2.ORB_create(nfeatures=1000)
    gray_a = cv2.cvtColor(image_a, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(image_b, cv2.COLOR_BGR2GRAY)

    keypoints_a, descriptors_a = orb.detectAndCompute(gray_a, None)
    keypoints_b, descriptors_b = orb.detectAndCompute(gray_b, None)

    if descriptors_a is None or descriptors_b is None:
        return 0.0

    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(descriptors_a, descriptors_b)

    if len(matches) == 0:
        return 0.0

    good_matches = [match for match in matches if match.distance < 50]
    return (len(good_matches) / len(matches)) * 100


@router.post("/compare", response_model=CompareResponse)
async def compare_medicine_image(request: CompareRequest):
    start_time = time.time()

    try:
        submitted_image = download_image(request.cloudinary_url)
    except Exception as exc:
        return CompareResponse(
            verdict="SUSPICIOUS",
            confidence=0.0,
            processing_time_ms=int((time.time() - start_time) * 1000),
            error=f"Failed to download image: {str(exc)}",
        )

    if not SEEDS_DIR.exists():
        return CompareResponse(
            verdict="SUSPICIOUS",
            confidence=0.0,
            processing_time_ms=int((time.time() - start_time) * 1000),
            error="No reference images available",
        )

    reference_images = (
        list(SEEDS_DIR.glob("*.jpg"))
        + list(SEEDS_DIR.glob("*.jpeg"))
        + list(SEEDS_DIR.glob("*.png"))
    )

    if not reference_images:
        return CompareResponse(
            verdict="SUSPICIOUS",
            confidence=0.0,
            processing_time_ms=int((time.time() - start_time) * 1000),
            error="No reference images available",
        )

    best_score = 0.0
    best_reference = None

    for ref_path in reference_images:
        try:
            ref_image = cv2.imread(str(ref_path))
            if ref_image is None:
                continue

            score = compute_orb_similarity(submitted_image, ref_image)
            if score > best_score:
                best_score = score
                best_reference = ref_path.name
        except Exception:
            continue

    if best_score >= 60:
        verdict = "GENUINE"
    elif best_score >= 30:
        verdict = "SUSPICIOUS"
    else:
        verdict = "LIKELY_FAKE"

    return CompareResponse(
        verdict=verdict,
        confidence=round(best_score, 2),
        matched_reference=best_reference,
        processing_time_ms=int((time.time() - start_time) * 1000),
    )
