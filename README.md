<div align="center">
  <h1>Blind Watermark Web</h1>
  <p>基于 <a href="https://github.com/guofei9987/blind_watermark">blind_watermark</a> 的盲水印在线工具</p>
</div>

## 功能

- **单图嵌入/提取**：上传图片，输入水印文本，即可嵌入或提取盲水印
- **批量处理**：多张图片批量嵌入/提取，支持打包下载
- **密码保护**：可设置密码，防止水印被随意提取
- **历史记录**：处理记录存储在浏览器本地（IndexedDB），随时查看和下载
- **隐私安全**：所有处理在服务端完成，图片处理完毕即删，不留存任何文件

## 快速开始

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

访问 `http://localhost:8001/blind-watermark`，输入密钥（默认 `20230412`）即可使用。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ACCESS_KEY` | `20230412` | 访问密钥，登录时验证 |
| `SESSION_SECRET` | 随机生成 | Session 签名密钥（生产环境建议固定） |

## 技术栈

- **后端**：FastAPI + Uvicorn/Gunicorn
- **前端**：原生 HTML/CSS/JS，无框架
- **水印库**：blind_watermark
- **认证**：Session Cookie（Starlette SessionMiddleware）
- **浏览器存储**：IndexedDB（历史记录）

## 开发

```bash
# 本地启动（热重载）
python run.py
# 或
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

访问 `http://localhost:8001/blind-watermark`

## License

MIT
