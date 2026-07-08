<div align="center">
  <h1>Blind Watermark Web</h1>
  <p>基于 <a href="https://github.com/guofei9987/blind_watermark">guofei9987/blind_watermark</a> 的盲水印在线工具</p>
</div>

## 功能

- **单图嵌入/提取**：上传图片，输入水印文本，即可嵌入或提取盲水印
- **批量处理**：多张图片批量嵌入/提取，支持打包下载
- **密码保护**：可设置密码，防止水印被随意提取
- **历史记录**：处理记录存储在浏览器本地（IndexedDB），随时查看和下载
- **隐私安全**：所有处理在服务端完成，图片处理完毕即删，不留存任何文件
- **水印长度自动检测**：提取时无需记忆水印长度，系统会自动尝试多种长度
- **超时取消**：处理超过 30 秒时可手动取消请求
- **密码验证**：访问需输入密钥，通过 Session Cookie 鉴权，不再使用 URL 参数

## 快速开始

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

访问 `http://localhost:8001/blind-watermark`，输入密钥（默认 `20230412`）即可使用。

## 部署

### 方式一：宝塔面板 Python 项目

1. 将项目文件放入站点目录
2. 在宝塔中添加 Python 项目，选择 Gunicorn 启动
3. 启动命令配置：
   ```
   gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 127.0.0.1:8001 --workers 1 --timeout 600
   ```
4. 在 Nginx 中添加反向代理，将 `/blind-watermark` 指向 `127.0.0.1:8001`
5. 安装依赖：`pip install itsdangerous`（SessionMiddleware 必需）

### 方式二：手动部署

```bash
pip install -r requirements.txt
export ACCESS_KEY=your-key
uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1
```

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

## 项目结构

```
blind_watermark_web/
├── AGENTS.md                 # 项目规范（AI 助手规则）
├── README.md                 # 项目说明
├── run.py                    # 本地开发启动脚本
├── requirements.txt
├── app/                      # 盲水印应用
│   ├── main.py               # 入口 + Session 认证
│   ├── api/watermark.py      # API 路由
│   ├── services/
│   │   ├── blind_service.py  # 水印核心操作（封装 blind_watermark 库）
│   │   └── file_service.py   # 临时文件管理
│   ├── static/
│   │   ├── css/bwm-theme.css # 主题样式（粉嫩风格）
│   │   ├── js/bwm-theme.js   # 交互逻辑
│   │   ├── js/history-db.js  # IndexedDB 封装
│   │   └── js/download.js    # 下载工具
│   └── templates/
│       ├── index.html        # 盲水印工具页面
│       └── auth.html         # 密钥验证页面
├── tool-site/                # 工具导航首页（独立项目）
│   ├── index.html            # 首页 HTML
│   ├── style.css             # 首页样式
│   └── script.js             # 首页动画
├── docs/                     # 文档
│   ├── STYLE_GUIDE.md        # 设计规范/样式指南
│   ├── ARCHITECTURE.md       # 架构说明
│   └── DEPLOYMENT.md         # 部署文档
└── tests/

## 开发

```bash
# 本地启动（热重载）
python run.py
# 或
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

访问 `http://localhost:8001/blind-watermark`

## 链接

- Web 仓库：[ZaiHuaOvO/blind_watermark_web](https://github.com/ZaiHuaOvO/blind_watermark_web)
- 上游项目：[guofei9987/blind_watermark](https://github.com/guofei9987/blind_watermark)

## License

MIT
