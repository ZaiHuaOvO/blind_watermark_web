<div align="center">
  <h1>Blind Watermark Web</h1>
  <p>基于 <a href="https://github.com/guofei9987/blind_watermark">guofei9987/blind_watermark</a> 的盲水印在线工具</p>
</div>

## 功能

- **单图嵌入/提取**：上传图片，输入水印文本，即可嵌入或提取盲水印
- **批量处理**：多张图片批量嵌入/提取，支持打包下载
- **密码保护**：可设置密码，防止水印被随意提取
- **历史记录**：处理记录存储在浏览器本地，随时查看和下载
- **隐私安全**：所有操作在服务端完成，图片处理完毕即删

## 快速开始

```bash
pip install -r requirements.txt
ACCESS_KEY=your-key uvicorn app.main:app --host 0.0.0.0 --port 8001
```

访问 `http://localhost:8001/?key=your-key`

## 部署

```bash
# 打包
tar -czf web.tar.gz app/ requirements.txt --exclude='__pycache__'

# 上传到服务器后
pip install -r requirements.txt
ACCESS_KEY=your-key uvicorn app.main:app --host 127.0.0.1 --port 8001
```

详见 [开发文档](docs/dev/devlopment.md)。

## 链接

- Web 仓库：[ZaiHuaOvO/blind_watermark_web](https://github.com/ZaiHuaOvO/blind_watermark_web)
- 上游项目：[guofei9987/blind_watermark](https://github.com/guofei9987/blind_watermark)

## License

MIT
