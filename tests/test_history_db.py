"""
Tests for filename parsing and password resolution logic.
"""
import pytest


class TestParseParams:

    def test_parse_params_from_filename(self):
        from app.services.blind_service import parse_params_from_filename
        result = parse_params_from_filename("test_blind_watermark_wm40_pwddefault.png")
        assert result["wm_length"] == 40
        assert result["pwd_hash"] == "default"

        result = parse_params_from_filename("test_blind_watermark_wm40_pwda1b2c3d.jpg")
        assert result["wm_length"] == 40
        assert result["pwd_hash"] == "a1b2c3d"

        result = parse_params_from_filename("normal_photo.jpg")
        assert result["wm_length"] is None
        assert result["pwd_hash"] is None

    def test_build_output_name(self):
        from app.services.blind_service import build_output_name

        name = build_output_name("photo.jpg", 40, "")
        assert "photo_blind_watermark_wm40_pwddefault.jpg" == name

        name = build_output_name("my_photo.png", 135, "secret123")
        assert "my_photo_blind_watermark_wm135_pwd" in name
        assert name.endswith(".png")


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
