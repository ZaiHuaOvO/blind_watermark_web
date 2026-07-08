"""
文件临时管理服务（无状态版）。

原则：所有文件用完即删，不保留任何用户数据在服务器上。
使用系统临时目录，进程重启后自动清理。
"""

import os
import uuid
import urllib.error
import urllib.request
from pathlib import Path

TEMP_DIR = Path("/tmp") / "blind_watermark_uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_PREFIXES = ("image/jpeg", "image/png", "image/webp")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
URL_DOWNLOAD_TIMEOUT = 30  # seconds


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


def download_from_url(url: str) -> str:
    """从 URL 下载图片到临时目录。

    验证 Content-Type 是否为图片类型，并检查文件大小。
    文件在请求完成后由调用方删除。

    Args:
        url: 图片 URL

    Returns:
        str: 保存的绝对路径

    Raises:
        ValueError: 下载失败、类型不支持或文件过大时抛出
    """
    os.makedirs(TEMP_DIR, exist_ok=True)

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=URL_DOWNLOAD_TIMEOUT) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if not content_type.startswith(ALLOWED_MIME_PREFIXES):
                raise ValueError(
                    f"URL 返回的不是图片（Content-Type: {content_type}）"
                )

            content = resp.read()
            if len(content) > MAX_FILE_SIZE:
                raise ValueError(
                    f"图片超过 {MAX_FILE_SIZE // 1024 // 1024}MB 限制"
                )

            # 根据 Content-Type 确定扩展名
            mime_to_ext = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/webp": ".webp",
            }
            ext = ".jpg"  # 默认
            for mime, e in mime_to_ext.items():
                if content_type.startswith(mime):
                    ext = e
                    break

            unique_name = f"{uuid.uuid4().hex}{ext}"
            save_path = str(TEMP_DIR / unique_name)

            with open(save_path, "wb") as f:
                f.write(content)

            return save_path

    except ValueError:
        raise
    except urllib.error.HTTPError as e:
        raise ValueError(f"下载失败，HTTP {e.code}: {e.reason}")
    except urllib.error.URLError as e:
        raise ValueError(f"无法访问 URL: {e.reason}")
    except Exception as e:
        raise ValueError(f"下载图片失败: {str(e)}")


def cleanup(path: str):
    """安全删除文件，不抛出异常。"""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
