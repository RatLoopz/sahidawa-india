import io
import os
import sys

import pytest
from PIL import Image
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from routers.analyze import _score_packaging_image


def _image_bytes(color: tuple[int, int, int], *, size: tuple[int, int] = (24, 24)) -> bytes:
    image = Image.new("RGB", size, color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _checkerboard_bytes() -> bytes:
    image = Image.new("RGB", (24, 24), (245, 245, 245))
    pixels = image.load()
    for x in range(24):
        for y in range(24):
            if (x + y) % 2 == 0:
                pixels[x, y] = (30, 130, 80)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_scores_low_signal_packaging_as_likely_fake():
    result = _score_packaging_image(_image_bytes((5, 5, 5)))

    assert result.isFake is True
    assert result.verdict == "likely_fake"
    assert result.confidence >= 0.8


def test_scores_readable_packaging_as_not_fake():
    result = _score_packaging_image(_checkerboard_bytes())

    assert result.isFake is False
    assert result.verdict in {"likely_genuine", "suspicious"}
    assert 0 <= result.confidence <= 1


def test_rejects_unreadable_image_bytes():
    with pytest.raises(HTTPException) as exc:
        _score_packaging_image(b"not an image")

    assert exc.value.status_code == 400
