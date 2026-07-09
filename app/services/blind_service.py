"""
盲水印核心操作适配层。

本层封装 blind_watermark 库的调用，所有与原项目的交互均通过此文件完成。
遵守"不改动原项目代码"原则。

=== 密码机制 ===

blind_watermark.WaterMark(password_wm) 控制水印比特打乱顺序：
  - 嵌入: read_wm 时用 password_wm 作为随机种子打乱比特顺序
  - 提取: 必须使用相同 password_wm 恢复顺序
  - 密码错误 → 比特乱序 → 解码出含 � 的乱码

本层通过检测提取结果是否含 � 来判断密码正确性。
"""

import os
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

import cv2
import numpy as np
from blind_watermark import WaterMark

_logger = logging.getLogger("blind_service")


def _resolve_password(password: Optional[str]) -> int:
    """将用户输入的字符串密码映射为 WaterMark 构造函数的 int 参数。"""
    if not password or password.strip() == "":
        return 1
    hash_val = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return int(hash_val[:8], 16)


def _password_hash_prefix(password: str) -> str:
    if not password or password.strip() == "":
        return "default"
    hash_val = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hash_val[:8]


def build_output_name(original_name: str, watermark_text: str) -> str:
    p = Path(original_name)
    safe_text = watermark_text.strip()[:20]
    safe_text = re.sub(r'[\\/:*?"<>|]', '_', safe_text)
    uid = uuid.uuid4().hex[:4]
    return f"{p.stem}_{safe_text}_{uid}{p.suffix}"


def build_output_name_with_text(original_name: str, watermark_text: str, wm_length: int, password: str = "") -> str:
    return build_output_name(original_name, watermark_text)


def parse_params_from_filename(filename: str) -> dict:
    match = re.search(r'_blind_watermark_wm(\d+)_pwd(\w+)\.\w+$', filename)
    if match:
        return {
            "wm_length": int(match.group(1)),
            "pwd_hash": match.group(2),
        }
    return {"wm_length": None, "pwd_hash": None}


def _img_to_base64(image_path: str) -> str:
    ext = Path(image_path).suffix.lower()
    mime = mimetypes.types_map.get(ext, "image/png")
    with open(image_path, "rb") as f:
        data = f.read()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


# ── 图像缩小辅助 ──────────────────────────────────────────

def _resize_if_needed(input_path: str, max_long_edge: int = 1200) -> tuple:
    """如果图片长边过大，等比缩小到 max_long_edge 像素。
    Returns: (处理后的路径, 是否缩小了, 原始尺寸 (w, h))
    """
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        return input_path, False, (0, 0)

    h, w = img.shape[:2]
    orig_size = (w, h)
    long_edge = max(w, h)

    if long_edge <= max_long_edge:
        return input_path, False, orig_size

    scale = max_long_edge / long_edge
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    ext = Path(input_path).suffix.lower()
    out_path = input_path + "_resized" + ext
    cv2.imwrite(out_path, resized)

    _logger.info(f"[SHRINK] {Path(input_path).name} {w}x{h} -> {new_w}x{new_h}")
    return out_path, True, orig_size


def _try_extract(input_path: str, wm_length: int, password_int: int) -> dict:
    """单次盲水印提取尝试，返回 {text, success, wm_length}。"""
    try:
        bwm = WaterMark(password_img=1, password_wm=password_int)
        wm_extract = bwm.extract(filename=input_path, wm_shape=wm_length, mode="str")
        if wm_extract and wm_extract.strip() and "�" not in wm_extract:
            return {"text": wm_extract.strip(), "success": True, "wm_length": wm_length}
    except Exception:
        pass
    return {"text": "", "success": False, "wm_length": wm_length}


# ── 调试事件收集 ──────────────────────────────────────────

_LOG_EVENTS = []
_RECENT_EVENTS = []  # 保留最近 200 条给 /api/watermark/logs


def _log_event(msg: str):
    _logger.info(f"[EVENT] {msg}")
    _LOG_EVENTS.append(msg)
    _RECENT_EVENTS.append(msg)
    if len(_RECENT_EVENTS) > 200:
        _RECENT_EVENTS.pop(0)


def get_log_events() -> list:
    events = list(_LOG_EVENTS)
    _LOG_EVENTS.clear()
    return events


def get_recent_logs() -> list:
    return list(_RECENT_EVENTS)


# ── 线程池 ────────────────────────────────────────────────

_EXECUTOR = ThreadPoolExecutor(max_workers=4)


# ── 嵌入 ──────────────────────────────────────────────────

def embed(input_path: str, watermark_text: str, password: str = "",
          output_dir: str = None, output_name_override: str = None) -> dict:
    output_dir = output_dir or os.environ.get("TEMP_DIR", "/tmp/blind_watermark_uploads")
    os.makedirs(output_dir, exist_ok=True)

    password_int = _resolve_password(password)

    temp_name = f"_temp_{Path(input_path).stem}.png"
    temp_path = str(Path(output_dir) / temp_name)

    bwm = WaterMark(password_img=1, password_wm=password_int)
    bwm.read_img(filename=input_path)
    bwm.read_wm(watermark_text, mode="str")
    wm_length = bwm.wm_size
    bwm.embed(filename=temp_path)

    if output_name_override:
        output_name = output_name_override
    else:
        output_name = build_output_name(Path(input_path).name, watermark_text)
    output_path = str(Path(output_dir) / output_name)

    bwm = WaterMark(password_img=1, password_wm=password_int)
    bwm.read_img(filename=input_path)
    bwm.read_wm(watermark_text, mode="str")
    bwm.embed(filename=output_path)

    if os.path.exists(temp_path):
        os.remove(temp_path)

    image_data = _img_to_base64(output_path)
    os.remove(output_path)

    return {
        "output_name": output_name,
        "image_data": image_data,
        "wm_length": wm_length,
        "has_password": bool(password and password.strip()),
    }


# ── 改进版 extract_auto（并行 + 缩小加速） ────────────

def extract_auto(input_path: str, password: str = "", _progress_callback=None) -> dict:
    """自动检测水印长度并提取盲水印。

    优化策略：
    1. 图像缩小加速（长边 > 1200px 时等比缩小）
    2. 先并行尝试常见长度，分组选出候选
    3. 用原图回退验证

    Args:
        input_path: 图片路径
        password: 密码
        _progress_callback: 可选进度回调 (msg: str) -> None

    Returns:
        dict: {text, success, wm_length}
    """
    def _log(msg):
        _log_event(msg)
        if _progress_callback:
            _progress_callback(msg)

    password_int = _resolve_password(password)

    _log(f"📸 读取图片: {Path(input_path).name}")
    t0 = time.time()

    # 1. 缩小
    shrunk_path, did_shrink, orig_size = _resize_if_needed(input_path, max_long_edge=1200)
    processing_path = shrunk_path
    _log(f"📐 原始尺寸: {orig_size[0]}x{orig_size[1]}" +
         (f" → 缩小到长边1200" if did_shrink else " (无需缩小)"))

    # 2. 候选长度
    common = list(range(24, 121, 24))      # 1~5 中文字
    common += list(range(8, 49, 8))        # 1~6 ASCII
    common += list(range(144, 481, 24))    # 6~20 中文字
    common += list(range(56, 241, 16))     # 7~30 ASCII
    all_candidates = sorted(set(common))
    _log(f"🔢 候选长度: {len(all_candidates)} 种")

    # 3. 并行扫描（4 个一组）
    BATCH_SIZE = 4
    found = None

    for batch_start in range(0, len(all_candidates), BATCH_SIZE):
        batch = all_candidates[batch_start:batch_start + BATCH_SIZE]
        _log(f"🔍 尝试 {batch[0]}~{batch[-1]}...")

        futures = {}
        for wl in batch:
            futures[_EXECUTOR.submit(_try_extract, processing_path, wl, password_int)] = wl

        for future in as_completed(futures):
            result = future.result()
            if result["success"]:
                found = result
                for f in futures:
                    f.cancel()
                break

        if found:
            _log(f"✅ 发现水印: 长度={found['wm_length']}, 文本='{found['text']}'")
            break
        _log(f"❌ 无匹配，继续...")

    # 4. 缩小图没找到 → 原图重试
    if not found and did_shrink:
        _log(f"🔄 缩略图未找到，尝试原图...")
        processing_path = input_path
        for batch_start in range(0, len(all_candidates), BATCH_SIZE):
            batch = all_candidates[batch_start:batch_start + BATCH_SIZE]
            futures = {}
            for wl in batch:
                futures[_EXECUTOR.submit(_try_extract, processing_path, wl, password_int)] = wl
            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    found = result
                    for f in futures:
                        f.cancel()
                    break
            if found:
                _log(f"✅ 原图发现: 长度={found['wm_length']}, 文本='{found['text']}'")
                break
            _log(f"❌ 无匹配，继续...")

    # 5. 验证
    if found and did_shrink:
        _log(f"🔬 原图验证长度={found['wm_length']}...")
        verify = _try_extract(input_path, found["wm_length"], password_int)
        if verify["success"]:
            _log(f"✅ 原图验证成功！")
            found = verify

    elapsed = time.time() - t0

    # 清理缩小用的临时文件
    if did_shrink and os.path.exists(shrunk_path):
        os.remove(shrunk_path)
        _log(f"🧹 临时缩略图已删除")

    if found:
        _log(f"🎉 提取成功! 耗时={elapsed:.1f}s, 长度={found['wm_length']}, 内容='{found['text']}'")
        return found

    _log(f"😢 未能提取盲水印，耗时={elapsed:.1f}s")
    return {"text": "无法自动检测水印长度，未能提取到盲水印", "success": False, "wm_length": None}


# ── 单次提取 ──────────────────────────────────────────

def extract(input_path: str, wm_length: int, password: str = "") -> dict:
    """从图片中提取文本盲水印。"""
    password_int = _resolve_password(password)

    try:
        bwm = WaterMark(password_img=1, password_wm=password_int)
        wm_extract = bwm.extract(
            filename=input_path,
            wm_shape=wm_length,
            mode="str",
        )

        if not wm_extract or not wm_extract.strip():
            return {"text": "没有提取到盲水印", "success": False}

        if "�" in wm_extract:
            return {"text": "密码错误，无法提取水印", "success": False}

        return {"text": wm_extract.strip(), "success": True}

    except Exception as e:
        return {"text": "没有提取到盲水印", "success": False}
