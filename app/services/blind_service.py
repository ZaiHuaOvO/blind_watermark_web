"""
Blind watermark service layer.

Delegates to the blind_watermark library (local source in blind_watermark_web/blind_watermark/).
This file contains only adaptation logic: no library internals are reimplemented.
"""

import os, sys
# Ensure local blind_watermark source takes priority over pip-installed version
_LOCAL_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _LOCAL_ROOT not in sys.path:
    sys.path.insert(0, _LOCAL_ROOT)
import re
import hashlib
import base64
import mimetypes
import uuid
import time
import logging
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import library classes directly as-is
from blind_watermark import WaterMark
from blind_watermark.bwm_core import WaterMarkCore, random_strategy1, one_dim_kmeans

_logger = logging.getLogger("blind_service")


# ── Password ────────────────────────────────────────────

def _resolve_password(password: Optional[str]) -> int:
    if not password or password.strip() == "":
        return 1
    hash_val = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return int(hash_val[:8], 16)


# ── Filename helpers ────────────────────────────────────

def build_output_name(original_name: str, watermark_text: str, wm_length: int = None) -> str:
    p = Path(original_name)
    safe_text = re.sub(r'[\\/:*?"<>|]', '_', watermark_text.strip())
    if len(safe_text) > 30:
        safe_text = safe_text[:30]
    uid = uuid.uuid4().hex[:6]
    wm_part = f"_wm{wm_length}" if wm_length is not None else ""
    return f"{p.stem}{wm_part}_{uid}{p.suffix}"


def build_output_name_with_text(original_name, watermark_text, wm_length, password=""):
    return build_output_name(original_name, watermark_text, wm_length)


def parse_params_from_filename(filename: str) -> dict:
    match = re.search(r'_wm(\d+)', filename)
    if match:
        return {"wm_length": int(match.group(1))}
    return {"wm_length": None}


def _img_to_base64(image_path: str) -> str:
    ext = Path(image_path).suffix.lower()
    mime = mimetypes.types_map.get(ext, "image/png")
    with open(image_path, "rb") as f:
        data = f.read()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


# ── Image resize ────────────────────────────────────────

def _resize_if_needed(input_path: str, max_long_edge: int = 1200) -> tuple:
    try:
        import cv2
    except ImportError:
        return input_path, False, (0, 0)
    try:
        img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            return input_path, False, (0, 0)
        h, w = img.shape[:2]
        orig_size = (w, h)
        if max(w, h) <= max_long_edge:
            return input_path, False, orig_size
        scale = max_long_edge / max(w, h)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        ext = Path(input_path).suffix.lower()
        out_path = input_path + "_resized" + ext
        cv2.imwrite(out_path, resized)
        _logger.info(f"[SHRINK] {Path(input_path).name} {w}x{h} -> {new_w}x{new_h}")
        return out_path, True, orig_size
    except Exception:
        return input_path, False, (0, 0)


# ── Watermark presence fast check ───────────────────────
# Uses WaterMarkCore directly (same as library's extract_raw path)
# to sample 100 blocks and check if bit values are bimodal.

def _quick_check_watermark_present(input_path: str, password_int: int = 1) -> tuple:
    """Fast check: sample 100 DCT blocks, check bit distribution.
    Watermarked: strongly bimodal (mostly 0/1).
    Non-watermarked: uniform (all four values equally likely).
    Returns: (likely_has_watermark, extreme_ratio, detail)"""
    try:
        import cv2
        import numpy as np

        core = WaterMarkCore(password_img=password_int)
        core.read_img(filename=input_path)
        core.init_block_index()

        block_num = core.block_num
        if block_num < 10:
            return True, 0.0, "too small"

        d1, d2 = core.d1, core.d2
        sample_count = min(block_num, 100)
        idx_shuffle = random_strategy1(seed=password_int, size=block_num,
                                        block_shape=core.block_shape[0] * core.block_shape[1])
        wm_values = np.zeros(sample_count)

        for i in range(sample_count):
            # Exact same logic as WaterMarkCore.block_get_wm (line 114-124 of bwm_core.py)
            block = core.ca_block[2][core.block_index[i]]
            shuffler = idx_shuffle[i]
            block_dct_shuffled = cv2.dct(block).flatten()[shuffler].reshape(core.block_shape)
            U, s, V = np.linalg.svd(block_dct_shuffled)
            wm = (s[0] % d1 > d1 / 2) * 1
            if d2:
                tmp = (s[1] % d2 > d2 / 2) * 1
                wm = (wm * 3 + tmp * 1) / 4
            wm_values[i] = wm

        count_0 = np.sum(wm_values < 0.1)
        count_1 = np.sum(wm_values >= 0.9)
        extreme_ratio = (count_0 + count_1) / sample_count

        if extreme_ratio > 0.75:
            return True, extreme_ratio, "detected"
        elif extreme_ratio > 0.60:
            return True, extreme_ratio, "weak"
        else:
            return False, extreme_ratio, "none"

    except Exception as e:
        _logger.error(f"Quick check failed: {e}", exc_info=True)
        return True, 0.0, f"error: {e}"


# ── Single extract attempt ──────────────────────────────

def _try_extract(input_path: str, wm_length: int, password_int: int) -> dict:
    """Try extract at a specific wm_length. Returns {text, success, wm_length}.
    Uses WaterMark.extract() directly from the library, then validates the result."""
    try:
        bwm = WaterMark(password_img=1, password_wm=password_int)
        wm_extract = bwm.extract(filename=input_path, wm_shape=wm_length, mode="str")

        if not wm_extract or not wm_extract.strip():
            return {"text": "", "success": False, "wm_length": wm_length}

        stripped = wm_extract.strip()

        if "\ufffd" in stripped:  # replacement char
            return {"text": "", "success": False, "wm_length": wm_length}

        if len(stripped) < 2:
            return {"text": "", "success": False, "wm_length": wm_length}

        has_meaningful = bool(re.search(r'[\w\u4e00-\u9fff]', stripped))
        if not has_meaningful:
            return {"text": "", "success": False, "wm_length": wm_length}

        printable_count = sum(1 for c in stripped if c.isprintable() or c in '\n\r\t')
        if printable_count < len(stripped) * 0.7:
            return {"text": "", "success": False, "wm_length": wm_length}

        return {"text": stripped, "success": True, "wm_length": wm_length}
    except ValueError:
        return {"text": "", "success": False, "wm_length": wm_length}
    except Exception:
        return {"text": "", "success": False, "wm_length": wm_length}


# ── Debug events (per channel) ──────────────────────────

_RECENT_EVENTS_BY_CHANNEL = {}
_MAX_EVENTS_PER_CHANNEL = 500


def _log_event(channel_id: str, msg: str):
    _logger.info(f"[{channel_id}] {msg}")
    if channel_id not in _RECENT_EVENTS_BY_CHANNEL:
        _RECENT_EVENTS_BY_CHANNEL[channel_id] = []
    _RECENT_EVENTS_BY_CHANNEL[channel_id].append(msg)
    if len(_RECENT_EVENTS_BY_CHANNEL[channel_id]) > _MAX_EVENTS_PER_CHANNEL:
        _RECENT_EVENTS_BY_CHANNEL[channel_id] = _RECENT_EVENTS_BY_CHANNEL[channel_id][-_MAX_EVENTS_PER_CHANNEL:]


def get_recent_logs(channel_id: str, since: int = 0) -> tuple:
    events = _RECENT_EVENTS_BY_CHANNEL.get(channel_id, [])
    total = len(events)
    if since >= total or total == 0:
        return [], total
    return events[since:], total


# ── Thread pool ─────────────────────────────────────────

_EXECUTOR = ThreadPoolExecutor(max_workers=6)


# ── Embed ───────────────────────────────────────────────

def embed(input_path: str, watermark_text: str, password: str = "",
          output_dir: str = None) -> dict:
    """Embed blind watermark. Returns base64 image data + wm_length.
    Uses WaterMark.read_img + read_wm + embed directly from the library."""
    output_dir = output_dir or os.environ.get("TEMP_DIR", "/tmp/blind_watermark_uploads")

    if not watermark_text or not watermark_text.strip():
        raise ValueError("watermark text empty")

    try:
        os.makedirs(output_dir, exist_ok=True)
    except OSError as e:
        raise ValueError(f"cannot create output dir: {e}")

    password_int = _resolve_password(password)

    try:
        bwm = WaterMark(password_img=1, password_wm=password_int)
        bwm.read_img(filename=input_path)
        bwm.read_wm(watermark_text, mode="str")
        wm_length = bwm.wm_size
    except Exception as e:
        _logger.error(f"embed failed: {e}", exc_info=True)
        raise ValueError(f"embed processing failed: {_sanitize_error(e)}")

    temp_simple_name = f"bw_{uuid.uuid4().hex}.png"
    temp_output_path = str(Path(output_dir) / temp_simple_name)

    try:
        bwm.embed(filename=temp_output_path)
    except Exception as e:
        _logger.error(f"embed write failed: {e}", exc_info=True)
        raise ValueError(f"embed write failed: {_sanitize_error(e)}")

    if not os.path.exists(temp_output_path):
        raise ValueError("output file not created, incompatible image format")

    try:
        image_data = _img_to_base64(temp_output_path)
    except Exception as e:
        _logger.error(f"base64 encode failed: {e}", exc_info=True)
        try:
            os.remove(temp_output_path)
        except Exception:
            pass
        raise ValueError(f"image encoding failed: {_sanitize_error(e)}")

    try:
        os.remove(temp_output_path)
    except Exception:
        pass

    output_name = build_output_name(Path(input_path).name, watermark_text, wm_length)

    return {
        "output_name": output_name,
        "image_data": image_data,
        "wm_length": wm_length,
        "has_password": bool(password and password.strip()),
    }


def _sanitize_error(e: Exception) -> str:
    msg = str(e)
    if len(msg) > 200:
        msg = msg[:200] + "..."
    return msg


# ── extract_auto ────────────────────────────────────────

def _build_coarse_candidates() -> list:
    """Build candidate bit lengths.

    The blind_watermark library ONLY extracts correctly at the exact wm_size
    (the internal bit shuffle uses wm_size as seed dimension). Any other
    wm_shape produces garbled results. So we must scan exhaustively (step=1).

    With 6 workers on a 1200px shrunk image (~0.3s each): ~24 seconds worst.
    Early-exit on first valid result means typical case is much faster.

    For images produced by OUR tool, the filename encodes _wm{N} and
    auto-detect is skipped entirely.
    """
    return list(range(8, 481, 1))


def extract_auto(input_path: str, password: str = "", channel_id: str = "extract_auto",
                 _progress_callback=None) -> dict:
    """Auto-detect watermark length and extract text.
    Uses WaterMark.extract() at multiple wm_shape candidates."""
    def _log(msg):
        _log_event(channel_id, msg)
        if _progress_callback:
            _progress_callback(msg)

    password_int = _resolve_password(password)

    _log(f"Reading: {Path(input_path).name}")
    t0 = time.time()

    _log("Checking watermark presence...")
    has_wm, confidence, detail = _quick_check_watermark_present(input_path, password_int)
    _log(f"Pre-check: {detail}")

    if not has_wm:
        elapsed = time.time() - t0
        _log(f"No watermark, skipping scan ({elapsed:.1f}s)")
        return {"text": "no watermark detected", "success": False, "wm_length": None}

    shrunk_path, did_shrink, orig_size = _resize_if_needed(input_path, max_long_edge=1200)
    processing_path = shrunk_path
    _log(f"Size: {orig_size[0]}x{orig_size[1]}" +
         (" -> shrunk" if did_shrink else " (no shrink)"))

    all_candidates = _build_coarse_candidates()
    _log(f"Candidates: {len(all_candidates)} (step=16)")

    BATCH_SIZE = 6

    def _scan_candidates(img_path, candidates, label=""):
        _log(f"Scanning {label} (step=1, {candidates[0]}~{candidates[-1]})")
        local_found = []
        for batch_start in range(0, len(candidates), BATCH_SIZE):
            batch = candidates[batch_start:batch_start + BATCH_SIZE]
            futures = {}
            for wl in batch:
                futures[_EXECUTOR.submit(_try_extract, img_path, wl, password_int)] = wl
            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    local_found.append(result)
            if local_found:
                _log(f"Found: len={local_found[0]['wm_length']}, text={local_found[0]['text'][:30]}")
                break
        return local_found

    found = _scan_candidates(processing_path, all_candidates, "shrunk")

    if not found and did_shrink:
        _log("Not found on shrunk, scanning original...")
        found = _scan_candidates(input_path, all_candidates, "original")

    elapsed = time.time() - t0

    if did_shrink and os.path.exists(shrunk_path):
        try:
            os.remove(shrunk_path)
        except Exception:
            pass

    if found:
        best = found[0]
        if did_shrink:
            _log(f"Verifying on original with len={best['wm_length']}...")
            verify = _try_extract(input_path, best["wm_length"], password_int)
            if verify["success"]:
                _log("Original verified!")
                best = verify
                elapsed = time.time() - t0
            else:
                _log("Original verify failed, using shrunk result")
        _log(f"Done! {elapsed:.1f}s, len={best['wm_length']}, text={best['text']}")
        return best

    _log(f"Extract failed ({elapsed:.1f}s)")
    return {"text": "could not detect watermark length", "success": False, "wm_length": None}


# ── Single extract (known wm_length) ────────────────────

def extract(input_path: str, wm_length: int, password: str = "") -> dict:
    """Extract text watermark from image with known length.
    Uses WaterMark.extract() directly from the library."""
    if wm_length <= 0:
        return {"text": "invalid watermark length", "success": False}

    password_int = _resolve_password(password)

    try:
        bwm = WaterMark(password_img=1, password_wm=password_int)
        wm_extract = bwm.extract(
            filename=input_path,
            wm_shape=wm_length,
            mode="str",
        )

        if not wm_extract or not wm_extract.strip():
            return {"text": "no watermark found", "success": False}

        stripped = wm_extract.strip()
        if "�" in stripped:
            return {"text": "wrong password", "success": False}

        return {"text": stripped, "success": True}

    except ValueError:
        return {"text": "watermark decode failed", "success": False}
    except Exception as e:
        _logger.error("extract failed: {}".format(e), exc_info=True)
        return {"text": "extract failed", "success": False}
