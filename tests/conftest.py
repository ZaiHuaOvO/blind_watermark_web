"""
pytest 测试夹具。
"""
import os
import sys
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ["ACCESS_KEY"] = "test-key"

from app.main import app


@pytest.fixture
def access_key():
    return "test-key"


@pytest.fixture
def wrong_key():
    return "wrong-key"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def test_image_path():
    img_path = Path(__file__).parent / "test_img.png"
    if not img_path.exists():
        try:
            import cv2
            import numpy as np
            img = np.ones((256, 256, 3), dtype=np.uint8) * 200
            img[::2, :] = 180
            img[:, ::2] = 180
            cv2.imwrite(str(img_path), img)
        except ImportError:
            pytest.skip("need opencv-python for test image")
    return str(img_path)
