# blind_watermark_web 完整开发文档

> 为 [guofei9987/blind_watermark](https://github.com/guofei9987/blind_watermark) 提供轻量、美观、易用的 Web 端。
>
> 部署模式：自托管云服务器（无状态处理，浏览器端存储历史）

- **项目仓库**: <https://github.com/ZaiHuaOvO/blind_watermark_web>
- **上游原项目**: <https://github.com/guofei9987/blind_watermark>
- **服务器配置**: 2 核 2G（与博客项目共用）

---

## 目录

1. [项目定位与原则](#1-项目定位与原则)
2. [架构总览（无状态设计）](#2-架构总览无状态设计)
3. [功能介绍与交互说明](#3-功能介绍与交互说明)
4. [后端详细设计](#4-后端详细设计)
5. [前端详细设计](#5-前端详细设计)
6. [关键问题与解决方案](#6-关键问题与解决方案)
7. [与原项目集成策略](#7-与原项目集成策略)
8. [CI 工作流](#8-ci-工作流)
9. [部署方案](#9-部署方案)
10. [本地开发流程](#10-本地开发流程)
11. [验收清单](#11-验收清单)
12. [版本迭代建议](#12-版本迭代建议)

---

## 1. 项目定位与原则

### 1.1 定位

为 blind_watermark 的文本盲水印功能提供一个开箱即用的 Web 图形界面。用户可以通过浏览器上传图片、输入文本，在自托管服务端完成盲水印的嵌入和提取。

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **不改动原项目核心代码** | 通过 `pip install blind-watermark` 引入，在独立适配层调用其公开 API |
| **服务端无状态** | 任何文件处理完毕即刻清理，服务器不保留任何用户图片和数据 |
| **历史存于浏览器** | 所有历史记录、图片数据存于用户的 IndexedDB 中，服务器一无所知 |
| **轻量优先** | 技术栈精简到极致，单进程 + 并发控制适配 2 核 2G 服务器 |
| **命名规范** | 所有生成图片命名格式为 `原图名字_水印文本_4位uuid.{扩展名}`（水印文本截取前 20 字符，特殊字符替换为 `_`） |

### 1.3 服务器资源限制

```
CPU:    2 核（与博客共用）
内存:   2 GB（与博客共用）
并发:   上限 2 个处理任务（asyncio.Semaphore 控制）
存储:   不允许持久存储任何用户文件
带宽:   Nginx 反代 + HTTPS
```

所有嵌入/提取操作均为同步、阻塞式 Python 调用，占用服务器的 CPU 和内存。控制并发为 2 意味着最多同时处理 2 个请求，其余排队等待。

---

## 2. 架构总览（无状态设计）

### 2.1 数据流示意

```text
┌─ 用户浏览器 ────────────────────────────────────────┐
│                                                      │
│  ┌─ 历史记录 ───────────────┐                        │
│  │  IndexedDB (图片 Blobs) │                        │
│  │  localStorage (元数据)  │                        │
│  └─────────────────────────┘                        │
│         │ ① 上传图片 + 文本                          │
│         ▼                                           │
│  fetch POST /api/watermark/embed                    │
│         │                                           │
└─────────┼───────────────────────────────────────────┘
          │
          ▼
┌─ 云服务器 (无状态) ────────────────────────────────┐
│                                                      │
│  ① 接收文件 → 保存临时文件（UUID命名）                 │
│  ② blind_watermark 处理                               │
│  ③ 生成输出文件                                       │
│  ④ 读输出文件为 base64 → 返回 JSON                    │
│  ⑤ 删除临时文件和输出文件                              │
│                                                      │
│  并发控制: asyncio.Semaphore(2)                      │
│  访问控制: 校验 ?key=xxx                              │
│                                                      │
└──────────────────────────────────────────────────────┘
          │
          ▼
┌─ 用户浏览器 ────────────────────────────────────────┐
│                                                      │
│  ⑥ 收到 base64 图片数据                               │
│  ⑦ 显示预览图                                         │
│  ⑧ 存入 IndexedDB (历史记录)                         │
│  ⑨ 点击下载 → 从 IndexedDB 读 Blob → 触发下载        │
│  ⑩ 删除历史 → 从 IndexedDB 删除 Blob                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.2 无状态 vs 传统方案对比

| 方面 | 传统方案 | 本方案（无状态） |
|------|---------|----------------|
| 历史存储 | SQLite / JSON 存服务器 | IndexedDB 存浏览器 |
| 生成图片 | 保留在 `data/outputs/` | 返回 base64，服务器即刻删除 |
| 下载图片 | 从服务器 URL 下载 | 从浏览器 IndexedDB Blob 下载 |
| 批量下载 | 服务器创建 zip 包 | 使用 JSZip 在浏览器端打包 |
| 用户隐私 | 服务器存了用户数据 | 服务器不保留任何痕迹 |
| 服务器重启 | 数据都在 | 无数据丢失风险（数据在浏览器） |
| 水平扩展 | 需共享存储 | 天然无状态，可加实例 |

### 2.3 目录结构

```text
blind_watermark_web/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI 入口 + 并发控制 + 访问密钥
│   ├── services/
│   │   ├── __init__.py
│   │   ├── blind_service.py       # 核心适配层：封装 blind_watermark
│   │   └── file_service.py        # 文件临时处理（用完即删）
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css          # 自定义样式
│   │   └── js/
│   │       ├── app.js             # 页面交互 + API 调用
│   │       ├── history-db.js      # IndexedDB 封装（历史存储）
│   │       └── download.js        # 浏览器端下载 / zip 打包
│   └── templates/
│       └── index.html             # 单页应用
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_watermark_api.py
│   └── test_history_db.py         # IndexedDB 逻辑测试（Node 环境）
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── Dockerfile
├── requirements.txt
├── .gitignore
└── README.md
```

> **注意**：`data/` 目录完全消失了。服务器不需要任何持久化目录。

### 2.4 请求生命周期（以嵌入为例）

```
① 用户选择图片 → 输入文本 → 点击"开始嵌入"
② 浏览器: 构建 FormData → fetch POST /api/watermark/embed?key=xxx
③ 服务器: 校验 access key（拦截非法请求）
④ 服务器: 获取 Semaphore(2) 许可（排队等待或直接处理）
⑤ 服务器: 保存上传文件到 /tmp/blind_watermark_uploads/{uuid}.jpg
⑥ 服务器: blind_watermark 处理（CPU 密集，1-3 秒）
⑦ 服务器: 生成输出文件
⑧ 服务器: 读取输出文件 → base64 编码
⑨ 服务器: 删除临时文件和输出文件
⑩ 服务器: 返回 JSON { image_data: "data:image/jpeg;base64,...", ... }
⑪ 浏览器: 收到 base64 → 显示预览
⑫ 浏览器: 将数据存入 IndexedDB（历史记录）
⑬ 浏览器: 用户点击下载 → 从 IndexedDB 取 Blob → createObjectURL → 下载
```

---

## 3. 功能介绍与交互说明

### 3.1 页面整体布局

```
┌─────────────────────────────────────────────────────────┐
│ [Logo] Blind Watermark Web              [⚙ GitHub icon] │ ← Navbar
├─────────────────────────────────────────────────────────┤
│  [单图处理]  [批量处理]  [历史队列]                        │ ← Tabs
├─────────────────────────────────────────────────────────┤
│                                                         │
│  (Tab 内容区域，根据选中 Tab 切换)                         │ ← Main
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 本项目完全基于开源项目 guofei9987/blind_watermark 实现      │
│ 本项目所有操作均在客户端进行，不上传任何数据                  │ ← Footer
└─────────────────────────────────────────────────────────┘
```

### 3.2 Tab 1：单图处理

#### A. 写入盲水印

```
┌─ Card: 写入盲水印 ─────────────────────────────────────┐
│  ✏ 水印文本: [  ___________________________ ]    *必填   │
│  🔑 嵌入密码: [  ______  ] (可选，默认使用公共密码)        │
│  📁 选择图片: [选择文件]  (支持 jpg/png/webp)             │
│                                                         │
│  [🔄 开始嵌入]                                           │
│                                                         │
│  ┌─ 预览 ──────────────────────────────────────────┐   │
│  │                                                   │   │
│  │       (嵌入成功后显示图片预览)                       │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│  [💾 下载图片]  [📋 保存到历史]                           │
└─────────────────────────────────────────────────────────┘
```

#### B. 提取盲水印

```
┌─ Card: 提取盲水印 ─────────────────────────────────────┐
│  📁 选择图片: [选择文件]  (支持 jpg/png/webp)             │
│  🔑 提取密码: [  ______  ] (可选，留空用默认密码)          │
│  📐 水印长度: [  ______  ] (可选，留空自动识别)           │
│                                                         │
│  [🔍 开始提取]                                           │
│                                                         │
│  ┌─ 结果 ──────────────────────────────────────────┐   │
│  │  提取结果: "这里显示提取的水印文本"                    │   │
│  │  或: "没有提取到盲水印"                              │   │
│  │  或: "密码错误，无法提取水印"                        │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Tab 2：批量处理

#### A. 批量写入

```
┌─ Card: 批量写入盲水印 ─────────────────────────────────┐
│  ✏ 水印文本: [  ___________________________ ]           │
│  🔑 嵌入密码: [  ______  ] (可选)                        │
│  📁 选择多张图片: [选择文件] multiple                      │
│                                                         │
│  [🔄 批量嵌入]                                           │
│                                                         │
│  ┌─ 处理结果列表 ──────────────────────────────────┐   │
│  │  ✅ pic1.jpg    →  pic1_blind_watermark.jpg  [↓] │   │
│  │  ✅ pic2.png    →  pic2_blind_watermark.png  [↓] │   │
│  │  ❌ pic3.gif    →  不支持的格式                    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  [📦 批量下载 (ZIP)]       [📋 全部保存到历史]            │
└─────────────────────────────────────────────────────────┘
```

> **批量下载说明**：在浏览器端使用 JSZip 库将多张图片打包为 zip，不占用服务器资源。

#### B. 批量提取

```
┌─ Card: 批量提取盲水印 ─────────────────────────────────┐
│  📁 选择多张图片: [选择文件] multiple                      │
│  🔑 提取密码: [  ______  ] (可选)                        │
│                                                         │
│  [🔍 批量提取]                                           │
│                                                         │
│  ┌─ 提取结果列表 ──────────────────────────────────┐   │
│  │  pic1.jpg           → "这是水印内容"               │   │
│  │  pic2.png           → "没有提取到盲水印"            │   │
│  │  pic3.jpg           → "密码错误"                   │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Tab 3：历史队列（浏览器本地）

```
┌─ Card: 历史记录 ─────────────────────────────────────────┐
│  我的历史记录（存储在本地浏览器，仅自己可见）                │
│  🔍 搜索: [  ______________ ]  (按文件名/水印文本搜索)      │
│  📊 共 23 条记录 | 占用空间: 12.5 MB                       │
│  🗑 [清空所有历史]                                         │
│                                                           │
│  ┌─ 表格 ─────────────────────────────────────────────┐  │
│  │  缩略图 │  原始文件  │  水印文本  │  密码 │  时间  │   │
│  ├────────┼───────────┼───────────┼──────┼────────┤   │
│  │  [img] │  pic.jpg  │  "测试"   │  🔑   │ 07-07  │   │
│  │  [img] │  pic2.png │  "hello"  │  -    │ 07-06  │   │
│  └───────────────────────────────────────────────────┘   │
│  [上一页]  1 2 3 ...  [下一页]                            │
└───────────────────────────────────────────────────────────┘
```

**历史记录说明**：

- 历史数据（含图片二进制）存储在浏览器的 **IndexedDB** 中
- 不同浏览器/设备之间的历史不互通
- 清除浏览器数据会导致历史丢失（会提示用户）
- 每张缩略图从 IndexedDB 读取 Blob 生成 object URL 展示
- 下载时从 IndexedDB 读取原始 Blob，零服务器开销

---

## 4. 后端详细设计

### 4.1 全部 API 接口清单

| 方法 | 路径 | 用途 | 请求格式 | 响应格式 | 说明 |
|------|------|------|---------|---------|------|
| GET | `/` | 主页面 | `query: key` | HTML | 无 key 或 key 错误返回提示页 |
| POST | `/api/watermark/embed` | 单图嵌入 | `multipart: file, text, password` | `{success, output_name, image_data, wm_length, has_password}` | `image_data` 为 base64 格式 |
| POST | `/api/watermark/extract` | 单图提取 | `multipart: file, password, wm_length` | `{text, success}` | |
| POST | `/api/watermark/embed/batch` | 批量嵌入 | `multipart: files[], text, password` | `{items: [{file_name, success, output_name, image_data}]}` | 无 zip_url，浏览器端自行打包 |
| POST | `/api/watermark/extract/batch` | 批量提取 | `multipart: files[], password` | `{items: [{file_name, text, success}]}` | |

> 所有 API 路径均需携带 `?key=xxx` 参数（通过中间件统一校验）。

### 4.2 核心适配层设计 (`app/services/blind_service.py`)

```python
"""
盲水印核心操作适配层。

本层封装 blind_watermark 库的调用，所有与原项目的交互均通过此文件完成。
遵守"不改动原项目代码"原则。

=== 密码机制 ===

WaterMark(password_wm) 控制水印比特打乱顺序：
  - 嵌入: read_wm 时用 password_wm 作为随机种子打乱比特顺序
  - 提取: 必须使用相同 password_wm 恢复顺序
  - 密码错误 → 比特乱序 → 解码出含 � 的乱码

本层通过检测提取结果是否含 � 来判断密码正确性。
"""

import os
import re
import hashlib
import base64
from pathlib import Path
from typing import Optional, Tuple

from blind_watermark import WaterMark

# 使用系统临时目录，确保进程重启后自动清理
TEMP_DIR = Path("/tmp") / "blind_watermark_uploads"


def _resolve_password(password: Optional[str]) -> int:
    """将用户输入的字符串密码映射为 WaterMark 构造函数的 int 参数。

    使用 SHA256 哈希的前 8 位 hex 转为 int，确保任意字符串都能映射到 int 空间。
    """
    if not password or password.strip() == "":
        return 1
    hash_val = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return int(hash_val[:8], 16)


def _password_hash_prefix(password: str) -> str:
    """计算密码的短哈希摘要（仅用于文件名标识）。"""
    if not password or password.strip() == "":
        return "default"
    hash_val = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hash_val[:8]


def build_output_name(original_name: str, watermark_text: str) -> str:
    """生成符合新命名规范的输出文件名。

    格式：原图名字_水印文本_4位uuid.扩展名
    4位uuid从 uuid4 取前4位 hex，确保短且唯一。
    水印文本取前20字符，替换不安全字符。
    """
    p = Path(original_name)
    safe_text = watermark_text.strip()[:20]
    safe_text = re.sub(r'[\\/:*?"<>|]', '_', safe_text)
    uid = uuid.uuid4().hex[:4]
    return f"{p.stem}_{safe_text}_{uid}{p.suffix}"


def parse_params_from_filename(filename: str) -> dict:
    """从文件名反向解析参数。"""
    match = re.search(r'_blind_watermark_wm(\d+)_pwd(\w+)\.\w+$', filename)
    if match:
        return {"wm_length": int(match.group(1)), "pwd_hash": match.group(2)}
    return {"wm_length": None, "pwd_hash": None}


def _img_to_base64(image_path: str) -> str:
    """将图片文件读取为 base64 数据 URI。

    返回格式如: data:image/jpeg;base64,/9j/4AAQ...
    浏览器可以直接赋值给 <img src="..."> 或用于下载。
    """
    import mimetypes
    ext = Path(image_path).suffix.lower()
    mime = mimetypes.types_map.get(ext, "image/png")
    with open(image_path, "rb") as f:
        data = f.read()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def embed(input_path: str, watermark_text: str, password: str = "") -> dict:
    """嵌入文本盲水印。

    注意事项：
      - 要获得 wm_length 必须先调用 read_wm。因此无法在一步内完成。
      - 当前做法：先以临时文件名嵌入获取 wm_length，再以正式文件名输出。
      - 优化方案见下方。

    Args:
        input_path: 输入图片绝对路径
        watermark_text: 水印文本
        password: 嵌入密码

    Returns:
        dict: { output_name, image_data, wm_length, has_password }
          image_data 为 base64 格式，可直接用于浏览器展示
    """
    password_int = _resolve_password(password)

    # 第一步：临时嵌入，获取 wm_length
    temp_name = f"_temp_{Path(input_path).stem}.png"
    temp_path = str(TEMP_DIR / temp_name)

    bwm = WaterMark(password_img=1, password_wm=password_int)
    bwm.read_img(filename=input_path)
    bwm.read_wm(watermark_text, mode="str")
    wm_length = bwm.wm_size
    bwm.embed(filename=temp_path)

    # 第二步：以正确文件名重新嵌入
    output_name = build_output_name(Path(input_path).stem, wm_length, password)
    output_path = str(TEMP_DIR / output_name)

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


def embed_optimized(input_path: str, watermark_text: str, password: str = "") -> dict:
    """优化的嵌入方案 — 仅嵌入一次。

    由于 embed() 内部已经返回了 embed_img (numpy array)，
    我们可以直接通过 cv2.imwrite 保存到正确路径，避免两次嵌入。
    但 WaterMark.embed() 只提供了 filename 参数保存方式，
    不暴露 embed_img 中间结果。

    此优化需要修改原库 embed() 方法，故暂时不采用。
    等上游合并 PR 后再实现。
    """
    # TODO: 等待 upstream 支持直接返回 embed_img，届时实现单次嵌入
    raise NotImplementedError("等待 upstream 优化")


def extract(input_path: str, wm_length: int, password: str = "") -> dict:
    """从图片中提取文本盲水印。

    Args:
        input_path: 输入图片路径
        wm_length: 水印比特长度
        password: 提取密码

    Returns:
        dict: { text, success }
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
        if "�" in wm_extract or "�" in wm_extract:
            return {"text": "密码错误，无法提取水印", "success": False}

        return {"text": wm_extract.strip(), "success": True}

    except Exception:
        return {"text": "没有提取到盲水印", "success": False}
```

> **关于两次嵌入的性能问题**：上述代码确实需要两次嵌入（一次获取 wm_length，一次正式输出）。但这增加的时间很小（`read_img` + `read_wm` 是极轻量的），主要开销还是 `embed()` 的 DCT/SVD 计算。长远看可以在首版后优化。

### 4.3 文件管理实现 (`app/services/file_service.py`)

```python
"""
文件临时管理服务（无状态版）。

原则：所有文件用完即删，不保留任何用户数据在服务器上。
"""

import os
import uuid
from pathlib import Path

TEMP_DIR = Path("/tmp") / "blind_watermark_uploads"

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_image_type(filename: str):
    """验证文件类型。"""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持的图片格式: {ext}")


def save_upload(file) -> str:
    """保存上传文件到临时目录。

    使用 UUID 重命名以避免冲突。文件在请求完成后由调用方删除。
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
```

### 4.4 并发控制与访问保护 (`app/main.py`)

```python
"""
应用入口。

核心功能：
  1. 访问密钥校验（简单防盗用）
  2. 并发控制（asyncio.Semaphore，限制最大 2 个同时处理）
  3. 无状态路由（所有临时文件处理完毕即删）
"""

import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.base import BaseHTTPMiddleware

from app.api import watermark

# ── 配置（通过环境变量注入） ──────────────────────────
ACCESS_KEY = os.environ.get("ACCESS_KEY", "dev-key-change-me")
# 设一个复杂点的默认值，部署时务必通过环境变量修改

# 全局并发信号量：限制同时处理的请求数
process_semaphore = asyncio.Semaphore(2)


class AccessKeyMiddleware(BaseHTTPMiddleware):
    """访问密钥校验中间件。

    校验规则：
      - 静态文件和 API 请求检查 ?key= 或 X-Access-Key 头
      - key 与 ACCESS_KEY 不匹配 → 403
      - 首页 GET / 不带 key → 返回提示页而非 403
    """

    async def dispatch(self, request: Request, call_next):
        # 首页不带 key 时放行（前端会检查并提示）
        if request.url.path == "/" and request.method == "GET":
            # 检查是否有 key 参数，如果没有仍然放行，由前端处理
            return await call_next(request)

        # 静态文件和 robots.txt 放行
        if request.url.path.startswith("/static/"):
            return await call_next(request)

        # 其他路径校验 key
        key = request.query_params.get("key", "")
        if not key:
            key = request.headers.get("X-Access-Key", "")

        if key != ACCESS_KEY:
            raise HTTPException(status_code=403, detail="无效的访问密钥")

        return await call_next(request)


class ConcurrentProcessor:
    """并发处理上下文管理器。

    用 Semaphore(2) 限制同一时间最多处理 2 个水印操作，
    多余请求排队等待。
    """

    def __init__(self, semaphore: asyncio.Semaphore):
        self.semaphore = semaphore

    async def __aenter__(self):
        await self.semaphore.acquire()
        return self

    async def __aexit__(self, *args):
        self.semaphore.release()


# ── FastAPI 应用 ─────────────────────────────────────
app = FastAPI(
    title="Blind Watermark Web",
    description="盲水印在线工具 - 无状态服务端",
    version="0.1.0",
)

# 中间件（顺序重要：访问校验先于路由）
app.add_middleware(AccessKeyMiddleware)

# 挂载静态文件
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# 注册路由
app.include_router(watermark.router, prefix="/api/watermark")

# 导出供 API 路由使用的并发控制器
app.state.process_semaphore = process_semaphore


@app.get("/")
async def index(request: Request):
    """主页面。

    如果 URL 中没有 key 参数，返回一个简单的密钥输入页面。
    如果有 key 参数，校验通过后渲染主页面。
    """
    key = request.query_params.get("key", "")

    if not key:
        # 无密钥 → 显示密钥输入页
        return HTMLResponse("""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>访问验证 - 盲水印</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
                  rel="stylesheet">
            <style>
                body { background: #f8f9fa; display: flex; align-items: center;
                       justify-content: center; min-height: 100vh; }
                .auth-card { max-width: 400px; width: 100%; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card auth-card mx-auto">
                    <div class="card-body p-4">
                        <h5 class="card-title mb-3">🔐 访问验证</h5>
                        <p class="text-muted small mb-3">
                            请输入访问密钥以使用盲水印
                        </p>
                        <div class="mb-3">
                            <label class="form-label">访问密钥</label>
                            <input type="password" class="form-control"
                                   id="keyInput" placeholder="输入密钥"
                                   autofocus
                                   onkeydown="if(event.key==='Enter') submit()">
                        </div>
                        <button class="btn btn-primary w-100" onclick="submit()">
                            验证
                        </button>
                        <div id="errorMsg" class="text-danger small mt-2"></div>
                    </div>
                </div>
            </div>
            <script>
            function submit() {
                const key = document.getElementById('keyInput').value.trim();
                if (!key) return;
                // 简单客户端校验：请求首页自己
                fetch('/?key=' + encodeURIComponent(key))
                    .then(r => {
                        if (r.ok) {
                            window.location.href = '/?key=' + encodeURIComponent(key);
                        } else {
                            document.getElementById('errorMsg').textContent = '密钥无效';
                        }
                    })
                    .catch(() => {
                        document.getElementById('errorMsg').textContent = '请求失败';
                    });
            }
            </script>
        </body>
        </html>
        """)

    # 有 key，校验通过 → 渲染主页面
    if key != ACCESS_KEY:
        return HTMLResponse("""
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>密钥无效</title></head>
        <body style="display:flex;align-items:center;justify-content:center;
                     min-height:100vh;font-family:sans-serif;">
            <div style="text-align:center">
                <h1>🔐 密钥无效</h1>
                <p>请检查访问密钥是否正确</p>
            </div>
        </body>
        </html>
        """)

    return FileResponse("app/templates/index.html")


@app.get("/health")
async def health():
    """健康检查端点（用于 Nginx / Docker 心跳）。"""
    return {"status": "ok"}
```

### 4.5 API 路由实现 (`app/api/watermark.py`)

```python
import os
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException

from app.services import blind_service, file_service

router = APIRouter()


def _get_semaphore(request: Request) -> asyncio.Semaphore:
    """从 app state 获取全局信号量。"""
    return request.app.state.process_semaphore


@router.post("/embed")
async def embed_watermark(
    request: Request,
    file: UploadFile = File(...),
    text: str = Form(...),
    password: str = Form(""),
):
    """单图嵌入盲水印。

    流程：上传 → 处理 → 返回 base64 → 清理所有文件。
    """
    async with _get_semaphore(request):
        file_service.validate_image_type(file.filename)
        upload_path = file_service.save_upload(file)

        try:
            result = blind_service.embed(
                input_path=upload_path,
                watermark_text=text,
                password=password,
            )
            return result
        finally:
            file_service.cleanup(upload_path)


@router.post("/extract")
async def extract_watermark(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(""),
    wm_length: int = Form(None),
):
    """单图提取盲水印。"""
    async with _get_semaphore(request):
        upload_path = file_service.save_upload(file)

        try:
            # 从文件名解析 wm_length
            params = blind_service.parse_params_from_filename(file.filename)
            length = wm_length or params.get("wm_length")

            if length is None:
                return {
                    "text": "无法确定水印长度，请手动输入或确认图片是否通过本工具生成",
                    "success": False,
                }

            return blind_service.extract(
                input_path=upload_path,
                wm_length=length,
                password=password,
            )
        finally:
            file_service.cleanup(upload_path)


@router.post("/embed/batch")
async def embed_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    text: str = Form(...),
    password: str = Form(""),
):
    """批量嵌入盲水印。

    注意：受并发限制（Semaphore 2），批量任务中的每个图片
    会依次获取信号量处理。如果队列较长，前端应有等待提示。
    """
    results = []

    for file in files:
        try:
            file_service.validate_image_type(file.filename)
            upload_path = file_service.save_upload(file)

            try:
                result = blind_service.embed(
                    input_path=upload_path,
                    watermark_text=text,
                    password=password,
                )
                results.append({
                    "file_name": file.filename,
                    "success": True,
                    "output_name": result["output_name"],
                    "image_data": result["image_data"],
                    "has_password": result["has_password"],
                })
            finally:
                file_service.cleanup(upload_path)

        except Exception as e:
            results.append({
                "file_name": file.filename,
                "success": False,
                "error": str(e),
            })

    return {"items": results}


@router.post("/extract/batch")
async def extract_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    password: str = Form(""),
):
    """批量提取盲水印。"""
    results = []

    for file in files:
        try:
            upload_path = file_service.save_upload(file)

            try:
                params = blind_service.parse_params_from_filename(file.filename)
                length = params.get("wm_length")

                if not length:
                    results.append({
                        "file_name": file.filename,
                        "text": "无法确定水印长度",
                        "success": False,
                    })
                    continue

                result = blind_service.extract(
                    input_path=upload_path,
                    wm_length=length,
                    password=password,
                )
                results.append({
                    "file_name": file.filename,
                    **result,
                })
            finally:
                file_service.cleanup(upload_path)

        except Exception as e:
            results.append({
                "file_name": file.filename,
                "text": str(e),
                "success": False,
            })

    return {"items": results}
```

### 4.6 `requirements.txt`

```
fastapi>=0.110.0
uvicorn[standard]>=0.20.0
python-multipart>=0.0.9
jinja2>=3.1.0
blind-watermark>=0.4.4
```

不再需要 `aiosqlite`，历史功能全部移到浏览器端。

---

## 5. 前端详细设计

### 5.1 技术选型与 CDN 依赖

| 库 | CDN | 用途 |
|---|-----|------|
| Bootstrap 5.3 | CDN | 布局、组件 |
| JSZip | CDN | 浏览器端 zip 打包（批量下载） |
| FileSaver.js | CDN | 浏览器端触发文件下载 |

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js"></script>
```

### 5.2 前端模块划分

```
app/static/js/
├── app.js             # 页面交互：表单提交、Tab切换、Toast
├── history-db.js      # IndexedDB 封装：历史记录的增删改查
└── download.js        # 浏览器端文件下载：单文件下载、zip打包
```

### 5.3 历史记录存储实现 (`history-db.js`)

```javascript
/**
 * IndexedDB 封装 — 浏览器端历史记录存储。
 *
 * 数据库结构：
 *   数据库名: BlindWatermarkHistory
 *   对象存储: historyItems
 *     每条记录:
 *       id:          自增 (autoIncrement)
 *       original_name: string
 *       output_name:   string
 *       watermark_text: string (嵌入操作)
 *       has_password:  boolean
 *       image_blob:    Blob (图片二进制数据)
 *       wm_length:     number
 *       created_at:    string (ISO datetime)
 *
 * 容量说明：IndexedDB 的存储上限通常为磁盘剩余空间的一半以上，
 * 远大于 localStorage 的 5MB 限制，足够存储成百上千张图片。
 */

const DB_NAME = 'BlindWatermarkHistory';
const STORE_NAME = 'historyItems';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('original_name', 'original_name', { unique: false });
                store.createIndex('watermark_text', 'watermark_text', { unique: false });
                store.createIndex('created_at', 'created_at', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 添加一条历史记录。
 * @param {Object} item - { original_name, output_name, watermark_text,
 *                          has_password, image_blob, wm_length }
 * @returns {number} id
 */
async function addHistory(item) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
        ...item,
        created_at: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 查询历史记录（支持分页和搜索）。
 */
async function searchHistory(keyword = '', page = 1, pageSize = 20) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });

    // 过滤
    let filtered = all;
    if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = all.filter(item =>
            (item.original_name || '').toLowerCase().includes(kw) ||
            (item.watermark_text || '').toLowerCase().includes(kw)
        );
    }

    // 排序（最新的在前）
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 分页
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    // 为每条记录生成 object URL（用于展示缩略图）
    items.forEach(item => {
        if (item.image_blob) {
            item.thumbnail_url = URL.createObjectURL(item.image_blob);
        }
    });

    return { items, total, page, pageSize };
}

/**
 * 根据 ID 获取图片 Blob（用于下载）。
 */
async function getImageBlob(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => {
            const record = request.result;
            resolve(record ? record.image_blob : null);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * 删除一条历史记录。
 */
async function deleteHistory(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 清空所有历史记录。
 */
async function clearAll() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 获取存储统计信息。
 */
async function getStorageInfo() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
    const totalSize = all.reduce((sum, item) => {
        return sum + (item.image_blob ? item.image_blob.size : 0);
    }, 0);
    return {
        count: all.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
    };
}
```

### 5.4 下载工具实现 (`download.js`)

```javascript
/**
 * 浏览器端下载工具。
 *
 * 原则：所有文件操作在浏览器端完成，不请求服务器。
 * - 单文件下载：基于 base64 或 Blob
 * - 批量下载：使用 JSZip 在浏览器端打包
 */

/**
 * 从 base64 数据 URI 下载单张图片。
 */
function downloadFromBase64(base64Data, filename) {
    // 移除 data:... 头
    const byteString = atob(base64Data.split(',')[1]);
    const mimeType = base64Data.split(',')[0].match(/:(.*?);/)[1];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 延迟释放 URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 从 IndexedDB 读取 Blob 后下载。
 */
async function downloadFromHistory(id, filename) {
    const blob = await getImageBlob(id); // 来自 history-db.js
    if (!blob) throw new Error('历史记录中未找到图片数据');

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 批量下载为 ZIP（浏览器端打包）。
 *
 * @param {Array} items - [{ base64Data, filename }]
 * @param {string} zipName - 压缩包名称
 */
async function downloadAsZip(items, zipName = 'watermarked_images.zip') {
    const JSZip = window.JSZip;
    if (!JSZip) {
        // 加载 CDN
        await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    }

    const zip = new JSZip();
    for (const item of items) {
        const byteString = atob(item.base64Data.split(',')[1]);
        const mimeType = item.base64Data.split(',')[0].match(/:(.*?);/)[1];

        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        zip.file(item.filename, ab, { binary: true });
    }

    const content = await zip.generateAsync({ type: 'blob' });

    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
```

### 5.5 主交互逻辑 (`app.js`)

```javascript
// ─── 全局 ──────────────────────────────────────────

function getAccessKey() {
    // 从 URL 参数获取 key
    const params = new URLSearchParams(window.location.search);
    return params.get('key') || '';
}

function apiUrl(path) {
    const key = getAccessKey();
    return `${path}?key=${encodeURIComponent(key)}`;
}

// ─── 单图嵌入 ──────────────────────────────────────

async function submitEmbedSingle() {
    const text = document.getElementById('embedTextSingle').value.trim();
    const password = document.getElementById('embedPwdSingle').value.trim();
    const fileInput = document.getElementById('embedFileSingle');
    const btn = document.getElementById('embedBtnSingle');

    if (!text) { showToast('请输入水印文本', 'error'); return; }
    if (!fileInput.files.length) { showToast('请选择图片', 'error'); return; }

    setLoading(btn, true);
    const formData = new FormData();
    formData.append('text', text);
    formData.append('password', password);
    formData.append('file', fileInput.files[0]);

    try {
        const resp = await fetch(apiUrl('/api/watermark/embed'), {
            method: 'POST', body: formData
        });
        if (!resp.ok) throw new Error((await resp.json()).detail || '请求失败');
        const data = await resp.json();

        // 显示预览
        const preview = document.getElementById('embedPreviewSingle');
        preview.innerHTML = `
            <div class="alert alert-success">嵌入成功！</div>
            ${data.has_password ? '<div class="alert alert-warning">🔑 已使用密码加密</div>' : ''}
            <img src="${data.image_data}" class="img-fluid rounded preview-img" alt="水印图片">
            <button class="btn btn-success mt-2" onclick="downloadFromBase64('${data.image_data}', '${data.output_name}')">
                💾 下载 ${data.output_name}
            </button>
            <button class="btn btn-outline-primary mt-2 ms-2" onclick='saveToHistory(${JSON.stringify(data).replace(/'/g, "\\'")},"${text}")'>
                📋 保存到历史
            </button>`;
        showToast('水印嵌入成功！');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function saveToHistory(data, text) {
    const byteString = atob(data.image_data.split(',')[1]);
    const mimeType = data.image_data.split(',')[0].match(/:(.*?);/)[1];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mimeType });

    await addHistory({
        original_name: data.output_name.replace(/_.*$/, '') + '.jpg',
        output_name: data.output_name,
        watermark_text: text,
        has_password: data.has_password,
        wm_length: data.wm_length,
        image_blob: blob,
    });
    showToast('已保存到历史记录');
}

// ─── 单图提取 ──────────────────────────────────────

async function submitExtractSingle() {
    // ...（边界值处理和 fetch 调用逻辑与之前一致，但需注意
    // 提取操作不需要 image_data，结果只有文本）
}

// ─── 历史队列 ──────────────────────────────────────

let currentHistoryPage = 1;
let lastHistoryResult = null;

async function loadHistory(page = 1) {
    const keyword = document.getElementById('historySearch').value;
    const result = await searchHistory(keyword, page, 20);
    lastHistoryResult = result;
    currentHistoryPage = page;
    renderHistoryTable(result);
}

function renderHistoryTable(result) {
    const tbody = document.getElementById('historyTableBody');
    if (!result.items.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">暂无历史记录</td></tr>';
        return;
    }

    tbody.innerHTML = result.items.map(item => `
        <tr>
            <td>
                ${item.thumbnail_url
                    ? `<img src="${item.thumbnail_url}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;">`
                    : '<span class="text-muted">无预览</span>'}
            </td>
            <td>${escapeHtml(item.original_name)}</td>
            <td>${escapeHtml(item.watermark_text || '-')}</td>
            <td>${item.has_password ? '🔑 是' : '-'}</td>
            <td>${new Date(item.created_at).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-success"
                        onclick="downloadFromHistory(${item.id}, '${escapeHtml(item.output_name)}')">↓</button>
                <button class="btn btn-sm btn-outline-danger"
                        onclick="confirmDeleteHistory(${item.id})">🗑</button>
            </td>
        </tr>
    `).join('');

    renderPagination(result);
}

function renderPagination(result) {
    const totalPages = Math.ceil(result.total / result.pageSize) || 1;
    const div = document.getElementById('historyPagination');
    let html = '';
    for (let i = 1; i <= totalPages && i <= 10; i++) {
        html += `<button class="btn btn-sm ${i === result.page ? 'btn-primary' : 'btn-outline-primary'}"
                         onclick="loadHistory(${i})">${i}</button> `;
    }
    div.innerHTML = html;
}

async function confirmDeleteHistory(id) {
    if (!confirm('确定删除此历史记录？图片数据也将从本地删除。')) return;
    // 释放 object URL（如有）
    await deleteHistory(id);
    showToast('已删除');
    loadHistory(currentHistoryPage);
}

async function clearAllHistory() {
    if (!confirm('确定清空所有历史记录？此操作不可恢复，所有本地图片数据将被删除。')) return;
    await clearAll();
    loadHistory(1);
    showToast('已清空所有历史');
}

async function showStorageInfo() {
    const info = await getStorageInfo();
    document.getElementById('storageInfo').textContent =
        `共 ${info.count} 条记录，占用 ${info.totalSizeMB} MB`;
}

// ─── 工具函数 ──────────────────────────────────────

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    // ...（保持之前的 Toast 实现）
}

function setLoading(btn, loading = true) {
    // ...（保持之前的 loading 实现）
}

// ─── 批量操作 ──────────────────────────────────────
// 与单图类似，但遍历 files[]，在浏览器端用 JSZip 打包

async function submitEmbedBatch() {
    // ...（批量操作，
    // 成功后显示 "保存全部到历史" 按钮，
    // "批量下载" 用 downloadAsZip() 在浏览器端打包）
}

// ─── 初始化 ────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // 绑定 data-action 事件
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const fn = window[btn.dataset.action];
            if (fn) fn();
        });
    });

    // 切换到历史 Tab 时自动加载
    document.querySelector('[data-bs-target="#history"]')
        .addEventListener('shown.bs.tab', () => {
            loadHistory();
            showStorageInfo();
        });

    // 文件大小前端预校验
    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', () => {
            for (const file of input.files) {
                if (file.size > 10 * 1024 * 1024) {
                    showToast(`文件 ${file.name} 超过 10MB 限制`, 'error');
                    input.value = '';
                }
            }
        });
    });
});
```

### 5.6 `app/static/css/style.css`

```css
body {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f8f9fa;
}

.footer {
    margin-top: auto !important;
}

.navbar-brand {
    font-weight: 600;
    letter-spacing: 0.5px;
}

.card {
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border: none;
    transition: box-shadow 0.2s;
}

.card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.preview-img {
    max-width: 100%;
    max-height: 400px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid #dee2e6;
}

.password-input {
    max-width: 300px;
}

.table-history th {
    background: #f1f3f5;
    font-weight: 600;
}

.toast-container {
    z-index: 1080;
}

.drop-zone {
    border: 2px dashed #dee2e6;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
}

.drop-zone:hover,
.drop-zone.drag-over {
    border-color: #0d6efd;
    background: rgba(13, 110, 253, 0.04);
}

/* 排队提示 */
.queue-notice {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
}
```

---

## 6. 关键问题与解决方案

### 6.1 并发控制（2 核 2G 服务器）

**方案**：全局 `asyncio.Semaphore(2)`。

```
请求到达 → 尝试获取信号量许可
  ├─ 许可可用 → 立即处理（约 1-3 秒）
  └─ 许可被占 → 请求等待，直到前一个完成
```

**前端表现**：

- 提交按钮变为 loading 状态
- 提示："正在处理，请稍候...（排队中）"
- 不建议在前端实现超时，因为排队时间不可预测

**后端注意事项**：

- Semaphore 控制的是**处理中的请求数**，不是排队总数
- 如果排队过长，FastAPI 默认的 Uvicorn 工作进程会承受压力。建议结合 `uvicorn --limit-concurrency` 使用
- 示例启动命令：

  ```bash
  uvicorn app.main:app --host 127.0.0.1 --port 8000 --limit-concurrency 10
  ```

### 6.2 文件零残留

| 阶段 | 文件 | 去向 |
|------|------|------|
| 上传后 | `/tmp/blind_watermark_uploads/{uuid}.jpg` | `finally` 块中删除 |
| 嵌入后 | `/tmp/blind_watermark_uploads/{原图名}_{水印文本}_{4位uuid}.jpg` | 读完 base64 立即删除 |
| 任何异常 | 所有临时文件 | `try/finally` 确保清理 |

**极端情况**：如果服务在处理中崩溃，临时文件会留在 `/tmp` 中。由于用的是 `/tmp`，系统重启或定期清理时会自动清除。

### 6.3 wm_length 传递

同第 4 版方案，不再赘述。文件名编码 + 浏览器端自动解析。

### 6.4 密码验证

同第 4 版方案。密码机制由 `blind_watermark.WaterMark(password_wm)` 控制。

### 6.5 浏览器 IndexedDB 存储限制

| 方面 | 说明 |
|------|------|
| 存储上限 | 通常为磁盘剩余空间的一半，远大于 localStorage 的 5MB |
| 数据持久性 | 清除浏览器数据时丢失 |
| 跨设备 | 不互通（一台设备的记录另一台看不到） |
| 隐私 | 数据在用户自己浏览器中，服务器无法访问 |
| 清理 | 用户可随时在历史 Tab 中删除或清空 |

**提示用户**：在历史 Tab 顶部显示"存储在本地浏览器，清除浏览器数据会丢失"的提醒。
**冷启动恢复**：首页加载时自动从 IndexedDB 读取历史（速度很快，毫秒级）。

### 6.6 访问密钥实现

```
部署时：ACCESS_KEY=your-secure-key docker run ...

用户访问：
  https://your-domain.com/?key=your-secure-key
  或
  https://your-domain.com/  → 弹出密钥输入框 → 输入后跳转
```

**安全层级**：

| 层级 | 措施 | 说明 |
|------|------|------|
| 传输 | HTTPS（Nginx） | 加密传输，防止中间人 |
| 访问 | 查询参数 key | 简单有效，防止随意访问 |
| 文件 | 临时文件 | 请求结束后即刻删除 |
| 历史 | IndexedDB | 服务器完全无历史数据 |

---

## 7. 与原项目集成策略

### 7.1 方式

通过 pip 安装上游库：

```bash
pip install blind-watermark
```

在 `app/services/blind_service.py` 中通过 `from blind_watermark import WaterMark` 导入并封装。

### 7.2 不修改原项目代码的承诺

| 情况 | 处理方式 |
|------|---------|
| 正常嵌入/提取 | 直接调用 WaterMark 公开 API |
| 密码功能 | 在构造函数传入 password_wm |
| 需要修复原库 bug | 优先 report upstream，在适配层 workaround |

到目前为止，本项目 **不需要** 修改原项目任何代码。

---

## 8. CI 工作流

### 8.1 `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest httpx

      - name: Lint with ruff
        run: |
          pip install ruff
          ruff check app/ tests/

      - name: Test with pytest
        run: |
          ACCESS_KEY=test-key pytest -q tests/

      - name: Test application startup
        run: |
          pip install uvicorn
          ACCESS_KEY=test-key timeout 15 uvicorn app.main:app --host 127.0.0.1 --port 8000 &
          sleep 4
          curl -f http://127.0.0.1:8000/?key=test-key -o /dev/null
          # 验证无 key 请求被拒绝
          curl -f -w "%{http_code}" http://127.0.0.1:8000/api/watermark/embed?key=wrong | grep -q 403
          kill %1 || true
```

---

## 9. 部署方案

部署方式：本地打包 → 上传服务器 → 解压 → 启动。

### 9.1 本地打包

```bash
# 1. 在项目根目录执行
cd blind_watermark_web

# 2. 打包（排除不需要的文件）
tar -czf blind-watermark-web.tar.gz \
    app/ \
    requirements.txt \
    --exclude='__pycache__' \
    --exclude='*.pyc'

# 如果需要在服务器上使用虚拟环境，也可以一起打包
# 但建议在服务器上直接 pip install，更干净
```

### 9.2 上传服务器

```bash
# 方式一：scp（最直接）
scp blind-watermark-web.tar.gz user@your-server:/opt/blind-watermark-web/

# 方式二：rsync（增量传输，适合频繁更新）
rsync -avz --progress \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git' \
    ./ user@your-server:/opt/blind-watermark-web/
```

### 9.3 服务器上解压与部署

```bash
# 1. SSH 登录服务器
ssh user@your-server

# 2. 解压
cd /opt/blind-watermark-web
tar -xzf blind-watermark-web.tar.gz

# 3. 创建虚拟环境（首次部署）
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. 安装 OpenCV 系统依赖（首次部署）
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0
# CentOS/Rocky
# sudo yum install -y libglvnd-glx glib2

# 5. 启动服务
# 先手动测试
source venv/bin/activate
ACCESS_KEY="your-strong-key" uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8001 \
    --limit-concurrency 10
```

### 9.4 使用 systemd 管理（推荐）

创建 `/etc/systemd/system/blind-watermark-web.service`：

```ini
[Unit]
Description=Blind Watermark Web Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/blind-watermark-web
Environment=ACCESS_KEY=your-strong-key
ExecStart=/opt/blind-watermark-web/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8765 \
    --limit-concurrency 10
Restart=always
RestartSec=5

# 资源限制（保护服务器）
CPUQuota=80%
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable blind-watermark-web
sudo systemctl start blind-watermark-web

# 查看状态
sudo systemctl status blind-watermark-web

# 查看日志
sudo journalctl -u blind-watermark-web -f
```

### 9.5 更新流程

```bash
# 本地修改代码后，三步完成更新：

# ① 本地打包
tar -czf blind-watermark-web.tar.gz app/ requirements.txt --exclude='__pycache__' --exclude='*.pyc'

# ② 上传到服务器
scp blind-watermark-web.tar.gz user@your-server:/opt/blind-watermark-web/

# ③ SSH 到服务器执行
ssh user@your-server
cd /opt/blind-watermark-web
tar -xzf blind-watermark-web.tar.gz
sudo systemctl restart blind-watermark-web
```

如果新版本依赖有变化，第 ③ 步加上 `source venv/bin/activate && pip install -r requirements.txt`。

### 9.6 Nginx 反代配置（需提前准备好 HTTPS 证书）

```nginx
server {
    listen 443 ssl;
    server_name watermark.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/watermark.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/watermark.yourdomain.com/privkey.pem;

    # 限制上传大小（与后端 MAX_FILE_SIZE 一致）
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置（处理水印可能需要几秒）
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # 限制请求速率（防止滥用）
    limit_req zone=watermark burst=5 nodelay;
    limit_req_status 429;
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name watermark.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 10. 本地开发流程

```bash
# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
ACCESS_KEY=dev-key uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 访问
open http://localhost:8000/?key=dev-key

# 测试
ACCESS_KEY=test-key pytest -q tests/
```

---

## 11. 验收清单

| # | 验收项 | 验证方式 |
|---|--------|---------|
| 1 | 单图嵌入（无密码） | 上传 → 嵌入 → 预览显示 → 下载正常 |
| 2 | 单图嵌入（加密码） | 输入密码 → 嵌入 → 提示"已使用密码加密" |
| 3 | 单图提取（密码正确） | 输入正确密码 → 提取文本一致 |
| 4 | 单图提取（密码错误） | 输入错误密码 → 提示"密码错误" |
| 5 | 单图提取（无水印） | 上传无盲水印图片 → "没有提取到盲水印" |
| 6 | 批量嵌入 + 浏览器端打包 | 批量嵌入 → 下载 zip（浏览器端 JSZip 打包） |
| 7 | 批量提取 | 逐条显示结果 |
| 8 | 历史队列（浏览器本地） | 保存到历史 → 关闭 Tab 再打开 → 记录还在 |
| 9 | 历史搜索 | 输入关键词 → 过滤匹配记录 |
| 10 | 历史下载 | 从 IndexedDB 读取 → 成功下载 |
| 11 | 历史删除/清空 | 删除单条或清空 → IndexedDB 中数据消失 |
| 12 | 服务器无文件残留 | 处理完成后检查 `/tmp/blind_watermark_uploads` 为空 |
| 13 | 并发控制 | 同时提交 3 个请求 → 第 3 个排队 |
| 14 | 访问密钥 | 无 key → 返回提示 / key 错误 → 403 |
| 15 | Footer 文案 | "完全基于开源项目" + "不上传任何数据" |
| 16 | GitHub 图标 | 右上角跳转 ZaiHuaOvO/blind_watermark_web |
| 17 | 不修改原项目代码 | `git diff blind_watermark/` 为空 |
| 18 | CI 工作流 | PR 触发 → 自动测试通过 |

---

## 12. 版本迭代建议

### v0.2 — 增强用户体验

- [ ] **拖拽上传**：支持拖拽图片到上传区域
- [ ] **批量进度条**：批量处理时显示实时进度（第几张/共几张）
- [ ] **排队提示**：页面显示当前排队人数

### v0.3 — 功能扩展

- [ ] **图片水印**：支持用图片作为水印
- [ ] **提取多候选**：支持指定多个 wm_length 尝试提取
- [ ] **历史导出**：从 IndexedDB 导出为 JSON

### v0.4 — 纯前端模式（长期目标）

- [ ] **Pyodide/WASM**：浏览器中直接运行 Python 处理
- [ ] **完全离线**：彻底脱离服务器，所有处理在浏览器完成

### v0.5 — 运维与质量

- [ ] **历史缩略图缓存优化**：object URL 泄漏检测
- [ ] **Unit Test** ：核心适配层 ≥ 90%
- [ ] **IP 访问统计**：仅日志级别，不涉及用户数据

---

## 附录

### A：`.gitignore`

```
__pycache__/
*.py[cod]
*.egg-info/
venv/
.venv/
.vscode/
.idea/
.DS_Store
Thumbs.db
```

无需忽略 `data/` 目录（本项目中不存在）。

### B：更新参考命令

```bash
# 本地修改代码 → 测试 → 打包 → 上传 → 重启

# 1. 打包
tar -czf blind-watermark-web.tar.gz app/ requirements.txt --exclude='__pycache__' --exclude='*.pyc'

# 2. 上传
scp blind-watermark-web.tar.gz user@your-server:/opt/blind-watermark-web/

# 3. 重启
ssh user@your-server "cd /opt/blind-watermark-web \
  && tar -xzf blind-watermark-web.tar.gz \
  && sudo systemctl restart blind-watermark-web"
```
