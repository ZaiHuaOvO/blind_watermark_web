"""
Tests for filename parsing and password resolution logic.
"""
import pytest


class TestParseParams:

    def test_parse_params_from_filename(self):
        from app.services.blind_service import parse_params_from_filename

        # Old format still recognized for backward compatibility
        result = parse_params_from_filename("test_blind_watermark_wm40_pwddefault.png")
        assert result["wm_length"] == 40
        assert result["pwd_hash"] == "default"

        result = parse_params_from_filename("test_blind_watermark_wm40_pwda1b2c3d.jpg")
        assert result["wm_length"] == 40
        assert result["pwd_hash"] == "a1b2c3d"

        result = parse_params_from_filename("normal_photo.jpg")
        assert result["wm_length"] is None
        assert result["pwd_hash"] is None

        # New format: no encoded params, returns None (auto-detect fallback)
        result = parse_params_from_filename("photo_hello123_a1b2.png")
        assert result["wm_length"] is None
        assert result["pwd_hash"] is None

    def test_build_output_name(self):
        from app.services.blind_service import build_output_name

        name = build_output_name("photo.jpg", "hello")
        assert name.startswith("photo_hello_")
        assert name.endswith(".jpg")
        uid_part = name.replace("photo_hello_", "").replace(".jpg", "")
        assert len(uid_part) == 4  # 4位uuid
        assert uid_part.isalnum()

        name = build_output_name("my_photo.png", "水印文本")
        assert name.startswith("my_photo_水印文本_")
        assert name.endswith(".png")
        uid_part = name.replace("my_photo_水印文本_", "").replace(".png", "")
        assert len(uid_part) == 4
        assert uid_part.isalnum()


class TestPasswordResolution:

    def test_default_password(self):
        from app.services.blind_service import _resolve_password

        assert _resolve_password("") == 1
        assert _resolve_password(None) == 1
        assert _resolve_password("   ") == 1

    def test_password_consistency(self):
        from app.services.blind_service import _resolve_password

        p1 = _resolve_password("hello")
        p2 = _resolve_password("hello")
        assert p1 == p2

        p3 = _resolve_password("world")
        assert p1 != p3
