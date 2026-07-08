# 部署文档

## 域名结构

```
flowersink.com        → 主站（Angular）
tool.flowersink.com   → 工具导航 + 各工具项目
api.flowersink.com    → API（NestJS）
```

## Nginx 配置核心要点

### 导航首页

```nginx
server {
    server_name tool.flowersink.com;
    root /www/wwwroot/tool.flowersink.com;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

### 盲水印应用

```nginx
# 静态文件（Nginx 直接托管）
location /static/ {
    alias /www/wwwroot/tool.flowersink.com/blind_watermark_web/app/static/;
    expires 30d;
}

# 页面 + API 反向代理
location /blind-watermark {
    proxy_pass http://127.0.0.1:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/ {
    proxy_pass http://127.0.0.1:8001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20m;
    proxy_read_timeout 600s;
}
```

> **关键**：`location /blind-watermark` 的 `proxy_pass` 末尾必须有 `/`，这样 Nginx 会去掉 `/blind-watermark` 前缀，把路径 `/` 传给后端。

## 宝塔面板部署

### 1. 创建目录

```bash
mkdir -p /www/wwwroot/tool.flowersink.com
```

### 2. 创建 Python 虚拟环境

```bash
cd /www/wwwroot/tool.flowersink.com
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install itsdangerous  # SessionMiddleware 必须
```

### 3. 启动（Gunicorn）

宝塔 → 网站 → Python 项目 → 添加：

| 字段 | 值 |
|------|-----|
| 启动方式 | Gunicorn |
| 启动文件 | `app.main:app` |
| Gunicorn 配置 | `-k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8001 --workers 1 --timeout 600` |

### 4. Nginx 配置

在 `tool.flowersink.com` 的网站设置 → 配置文件中添加上述反向代理规则。

### 5. 环境变量

| 变量 | 说明 | 推荐设置 |
|------|------|----------|
| `ACCESS_KEY` | 访问密钥 | 生产环境改为复杂随机字符串 |
| `SESSION_SECRET` | Session 签名密钥 | 固定一个值，防止重启后所有 Session 失效 |

可通过宝塔面板 → 网站 → Python 项目 → 环境变量中设置。

## 本地开发

```bash
# 一行启动
python run.py

# 或手动
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

访问 `http://localhost:8001/blind-watermark`
