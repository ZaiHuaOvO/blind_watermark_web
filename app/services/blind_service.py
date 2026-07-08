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
from pathlib import Path
from typing import Optional

from blind_watermark import WaterMark


def _resolve_password(password: Optional[str]) -> int:
    """将用户输入的字符串密码映射为 WaterMark 构造函数的 int 参数。

    使用 SHA256 哈希的前 8 位 hex 转为 int，确保任意字符串都能映射到 int 空间。
    空密码默认为 1（与原库默认值一致）。
    """
    if not password or password.strip() == "":
        return 1
    hash_val = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return int(hash_val[:8], 16)


def _password_hash_prefix(password: str) -> str:
    """计算密码的短哈希摘要（仅用于文件名标识，非安全用途）。"""
    if not password or password.strip() == "":
        return "default"
    hash_val = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hash_val[:8]


def build_output_name(original_name: str, wm_length: int, password: str = "") -> str:
    """生成符合命名规范的输出文件名。

    格式：原名_blind_watermark_wm{长度}_pwd{密码摘要}.扩展名
    """
    p = Path(original_name)
    pwd_prefix = _password_hash_prefix(password)
    return f"{p.stem}_blind_watermark_wm{wm_length}_pwd{pwd_prefix}{p.suffix}"


def build_output_name_with_text(original_name: str, watermark_text: str, wm_length: int, password: str = "") -> str:
    """生成带水印文本的输出文件名，用于"逐张处理"模式。

    水印文本截取前 20 个字符，替换不安全字符为 _。
    格式：原名_wm文本_truncated_水印文本_blind_watermark_wm{长度}_pwd{密码摘要}.扩展名
    """
    p = Path(original_name)
    pwd_prefix = _password_hash_prefix(password)
    # 清理水印文本：取前20字符，替换不安全字符
    safe_text = watermark_text.strip()[:20]
    safe_text = re.sub(r'[\\/:*?"<>|]', '_', safe_text)
    return f"{p.stem}_{safe_text}_blind_watermark_wm{wm_length}_pwd{pwd_prefix}{p.suffix}"


def parse_params_from_filename(filename: str) -> dict:
    """从文件名反向解析参数。

    匹配格式：*_blind_watermark_wm{NUM}_pwd{STR}.ext
    """
    match = re.search(r'_blind_watermark_wm(\d+)_pwd(\w+)\.\w+$', filename)
    if match:
        return {
            "wm_length": int(match.group(1)),
            "pwd_hash": match.group(2),
        }
    return {"wm_length": None, "pwd_hash": None}


def _img_to_base64(image_path: str) -> str:
    """将图片文件读取为 base64 数据 URI。

    返回格式如: data:image/jpeg;base64,/9j/4AAQ...
    浏览器可以直接赋值给 <img src="..."> 或用于下载。
    """
    ext = Path(image_path).suffix.lower()
    mime = mimetypes.types_map.get(ext, "image/png")
    with open(image_path, "rb") as f:
        data = f.read()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def embed(input_path: str, watermark_text: str, password: str = "", output_dir: str = None, output_name_override: str = None) -> dict:
    """嵌入文本盲水印。

    Args:
        input_path: 输入图片绝对路径
        watermark_text: 水印文本
        password: 嵌入密码（留空使用默认密码）
        output_dir: 输出目录（默认使用系统临时目录）
        output_name_override: 自定义输出文件名（不指定则自动生成）

    Returns:
        dict: { output_name, image_data, wm_length, has_password }
    """
    output_dir = output_dir or os.environ.get("TEMP_DIR", "/tmp/blind_watermark_uploads")
    os.makedirs(output_dir, exist_ok=True)

    password_int = _resolve_password(password)

    # 第一步：临时嵌入，获取 wm_length
    temp_name = f"_temp_{Path(input_path).stem}.png"
    temp_path = str(Path(output_dir) / temp_name)

    bwm = WaterMark(password_img=1, password_wm=password_int)
    bwm.read_img(filename=input_path)
    bwm.read_wm(watermark_text, mode="str")
    wm_length = bwm.wm_size
    bwm.embed(filename=temp_path)

    # 第二步：以正确文件名重新嵌入
    if output_name_override:
        output_name = output_name_override
    else:
        output_name = build_output_name(Path(input_path).name, wm_length, password)
    output_path = str(Path(output_dir) / output_name)

    bwm = WaterMark(password_img=1, password_wm=password_int)
    bwm.read_img(filename=input_path)
    bwm.read_wm(watermark_text, mode="str")
    bwm.embed(filename=output_path)

    # 清理临时文件
    if os.path.exists(temp_path):
        os.remove(temp_path)

    # 读取为 base64
    image_data = _img_to_base64(output_path)

    # 删除输出文件（服务器不留任何文件）
    os.remove(output_path)

    return {
        "output_name": output_name,
        "image_data": image_data,
        "wm_length": wm_length,
        "has_password": bool(password and password.strip()),
    }


def extract_auto(input_path: str, password: str = "") -> dict:
    """自动检测水印长度并提取盲水印。

    当无法从文件名获取水印长度时，尝试多种常见长度自动检测。
    优先返回第一个不含乱码的有效文本。
    """
    password_int = _resolve_password(password)

    # 常见水印长度候选集（比特数）
    # 覆盖: 1~20 中文字符(UTF-8: 24n) + 1~30 ASCII字符(8n)
    candidates = set()
    for i in range(24, 481, 24):   # 1~20 中文字
        candidates.add(i)
    for i in range(8, 241, 8):     # 1~30 ASCII
        candidates.add(i)
    candidates = sorted(candidates)  # ~35 个

    for wm_length in candidates:
        try:
            bwm = WaterMark(password_img=1, password_wm=password_int)
            wm_extract = bwm.extract(filename=input_path, wm_shape=wm_length, mode="str")
            if wm_extract and wm_extract.strip() and "�" not in wm_extract:
                return {"text": wm_extract.strip(), "success": True, "wm_length": wm_length}
        except Exception:
            continue

    return {"text": "无法自动检测水印长度，未能提取到盲水印", "success": False, "wm_length": None}


def extract(input_path: str, wm_length: int, password: str = "") -> dict:
    """从图片中提取文本盲水印。

    Args:
        input_path: 输入图片路径
        wm_length: 水印比特长度（嵌入时由 embed() 返回）
        password: 提取密码（留空使用默认密码）

    Returns:
        dict: { text, success }
          success=True  → 提取成功
          success=False → 密码错误 或 没有提取到盲水印
    """
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

        # 密码验证：检测 replacement 字符
        # 密码错误 → 比特顺序不对 → 解码出 replacement 字符
        if "�" in wm_extract:
            return {"text": "密码错误，无法提取水印", "success": False}

        return {"text": wm_extract.strip(), "success": True}

    except Exception as e:
        return {"text": "没有提取到盲水印", "success": False}
