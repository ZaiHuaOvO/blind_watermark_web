# blind_watermark_web — 项目规范

## 项目概述

本项目是"再花的工具箱"的组成部分，位于工具导航首页（`tool-site/index.html`）之下。
每个工具是**独立项目**，通过 Nginx 反向代理实现路由导航，工具之间不存在任何前端路由关系。

当前项目：**盲水印 Web 工具**（`blind_watermark_web`）

## 技术栈

- 后端：Python FastAPI + Uvicorn/Gunicorn
- 前端：纯原生 HTML/CSS/JS，不使用任何前端框架
- 数据库：无（历史记录存储在浏览器 IndexedDB）
- 认证：Session Cookie（Starlette SessionMiddleware）

## 目录结构

```
blind_watermark_web/
├── AGENTS.md                          # 本文件
├── README.md                          # 项目说明
├── run.py                             # 本地开发启动脚本
├── requirements.txt
├── app/                               # 盲水印应用
│   ├── main.py                        # FastAPI 入口 + Session 认证
│   ├── api/watermark.py               # 水印 API 路由
│   ├── services/
│   │   ├── blind_service.py           # 水印核心操作（封装 blind_watermark 库）
│   │   └── file_service.py            # 临时文件管理
│   ├── static/
│   │   ├── css/bwm-theme.css          # 盲水印主题样式
│   │   └── js/bwm-theme.js            # 盲水印交互逻辑
│   └── templates/
│       ├── index.html                 # 盲水印工具页面
│       └── auth.html                  # 密钥验证页面
├── tool-site/                         # 工具导航首页（独立项目）
│   ├── index.html                     # 首页 HTML
│   ├── style.css                      # 首页样式
│   └── script.js                      # 首页动画
├── docs/                              # 项目文档（根目录下文档合集）
│   ├── STYLE_GUIDE.md                 # 设计规范/样式指南
│   ├── ARCHITECTURE.md                # 架构说明
│   └── DEPLOYMENT.md                  # 部署文档
└── tests/                             # 测试
```

## 关键约定

### 1. 工具独立原则
每个工具项目都是独立的，只通过 Nginx 反向代理聚合到 `tool.flowersink.com`。
代理路径如 `/blind-watermark` → `127.0.0.1:8001`。
**不允许**在工具之间创建前端路由或后端相互调用。

### 2. 样式规范
所有工具项目的样式必须参考 `tool-site/style.css` 的设计风格：
- 粉嫩可爱 + 毛玻璃视觉效果
- 偏粉色系为主色调，部分元素可使用渐变色
- 动画应灵动但不影响功能使用
- 所有文件保存为 UTF-8 无 BOM

具体颜色、组件、动画规范详见 `docs/STYLE_GUIDE.md`。

### 3. 第三方库封装原则
如果项目基于第三方开源项目开发（如盲水印基于 `guofei9987/blind_watermark`）：
- **禁止**修改第三方库的任何源代码
- 只通过适配层（如 `blind_service.py`）调用第三方库接口
- 适配层应集中在一个文件中，便于维护和升级

### 4. 认证规范
所有需要鉴权的工具统一使用 Session Cookie 方式：
- 后端使用 `Starlette SessionMiddleware`
- 前端通过 `POST /api/login` 提交密钥
- Session 过期后自动跳转到验证页面

### 5. 部署规范
- 后端监听 `127.0.0.1`，通过 Nginx 反向代理对外暴露
- 静态文件由 Nginx 直接托管
- API 请求通过 `/api/` 路径代理

### 6. CSS 命名规范
- 工具相关的样式使用项目缩写前缀（如盲水印用 `bwm-`）
- 导航首页使用无前缀的通用类名（如 `.tool-card`、`.home-btn`）

### 7. JavaScript 编写规范
- 使用 ES5 语法（`var`、`function`），确保兼容性
- 避免引入外部依赖，保持轻量
- 复杂状态管理使用全局变量 + 模块函数
