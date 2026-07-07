"""
文件临时管理服务（无状态版）。

原则：所有文件用完即删，不保留任何用户数据在服务器上。
使用系统临时目录，进程重启后自动清理。
"""

import os
import uuid
from pathlib import Path

TEMP_DIR = Path("/tmp") / "blind_watermark_uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_image_type(filename: str):
    """验证文件类型是否为允许的图片格式。

    Raises:
        ValueError: 格式不支持时抛出
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"不支持的图片格式: {ext}，仅支持 {', '.join(ALLOWED_EXTENSIONS)}"
        )


def save_upload(file) -> str:
    """保存上传文件到临时目录。

    使用 UUID 重命名以避免冲突。文件在请求完成后由调用方删除。

    Args:
        file: FastAPI UploadFile 对象

    Returns:
        str: 保存的绝对路径
    """
    os.makedirs(TEMP_DIR, exist_ok=True)
    ext = Path(file.filename).suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    save_path = str(TEMP_DIR / unique_name)

    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"文件超过 {MAX_FILE_SIZE // 1024 // 1024}MB 限制")

    with open(save_path, "wb") as f:
        f.write(content)

    return save_path


def cleanup(path: str):
    """安全删除文件，不抛出异常。"""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
