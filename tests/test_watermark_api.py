"""
Watermark API integration tests.
"""
import pytest
import base64


class TestWatermarkAPI:

    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    @pytest.mark.asyncio
    async def test_access_key_required(self, client, wrong_key):
        resp = await client.post("/api/watermark/embed")
        assert resp.status_code == 403
        resp = await client.post(f"/api/watermark/embed?key={wrong_key}")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_index_page(self, client, access_key):
        resp = await client.get(f"/?key={access_key}")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_index_no_key(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        assert "auth-page" in resp.text

    @pytest.mark.asyncio
    async def test_embed_and_extract(self, client, access_key, test_image_path):
        import aiofiles
        async with aiofiles.open(test_image_path, "rb") as f:
            file_data = await f.read()

        files = {"file": ("test.png", file_data, "image/png")}
        resp = await client.post(
            f"/api/watermark/embed?key={access_key}",
            files=files,
            data={"text": "hello123"},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["wm_length"] > 0
        assert result["image_data"].startswith("data:image")
        wm_length = result["wm_length"]

        _, b64_data = result["image_data"].split(",", 1)
        wm_bytes = base64.b64decode(b64_data)

        files = {"file": ("wm_test.png", wm_bytes, "image/png")}
        resp = await client.post(
            f"/api/watermark/extract?key={access_key}",
            files=files,
            data={"wm_length": wm_length},
        )
        assert resp.status_code == 200
        extract = resp.json()
        assert extract["success"] is True
        assert "hello" in extract["text"]

    @pytest.mark.asyncio
    async def test_embed_with_password(self, client, access_key, test_image_path):
        import aiofiles
        async with aiofiles.open(test_image_path, "rb") as f:
            file_data = await f.read()

        files = {"file": ("secret.png", file_data, "image/png")}
        resp = await client.post(
            f"/api/watermark/embed?key={access_key}",
            files=files,
            data={"text": "secrete msg", "password": "mypass"},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["has_password"] is True

    @pytest.mark.asyncio
    async def test_wrong_password_fails(self, client, access_key, test_image_path):
        import aiofiles
        async with aiofiles.open(test_image_path, "rb") as f:
            file_data = await f.read()

        files = {"file": ("pwt.png", file_data, "image/png")}
        resp = await client.post(
            f"/api/watermark/embed?key={access_key}",
            files=files,
            data={"text": "protected", "password": "correct"},
        )
        assert resp.status_code == 200
        result = resp.json()
        wm_len = result["wm_length"]

        _, b64_data = result["image_data"].split(",", 1)
        wm_bytes = base64.b64decode(b64_data)

        files = {"file": ("pwt.png", wm_bytes, "image/png")}
        resp = await client.post(
            f"/api/watermark/extract?key={access_key}",
            files=files,
            data={"password": "wrong", "wm_length": wm_len},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["success"] is False
        assert ("password" in result["text"].lower()) or ("\u5bc6\u7801" in result["text"])

    @pytest.mark.asyncio
    async def test_extract_no_watermark(self, client, access_key, test_image_path):
        import aiofiles
        async with aiofiles.open(test_image_path, "rb") as f:
            file_data = await f.read()

        files = {"file": ("nowm.png", file_data, "image/png")}
        resp = await client.post(
            f"/api/watermark/extract?key={access_key}",
            files=files,
            data={"wm_length": 40},
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is False

    @pytest.mark.asyncio
    async def test_invalid_file_type(self, client, access_key):
        files = {"file": ("test.gif", b"GIF89a", "image/gif")}
        resp = await client.post(
            f"/api/watermark/embed?key={access_key}",
            files=files,
            data={"text": "test"},
        )
        assert resp.status_code == 400
