# 工具集部署指南

> 域名：tool.flowersink.com
> 服务器：阿里云 ECS（已部署博客，已有证书）

## 架构

```nginx
用户访问 tool.flowersink.com
        │
        ▼
    Nginx
        │
        ├── /                     → /var/www/tool-site/index.html（静态导航页）
        ├── /blind-watermark      → localhost:3001（盲水印工具）
        ├── /image-compress       → localhost:3002（图片压缩，预留）
        ├── /qrcode-generator     → localhost:3003（二维码，预留）
        └── ... （后续继续追加）
```

---

## 1. Nginx 配置

在 ECS 的 Nginx 配置目录（通常是 `/etc/nginx/conf.d/`）下创建 `tool.flowersink.com.conf`：

```nginx
server {
    listen 443 ssl http2;
    server_name tool.flowersink.com;

    ssl_certificate     /etc/letsencrypt/live/tool.flowersink.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tool.flowersink.com/privkey.pem;

    # 上传文件大小限制
    client_max_body_size 12m;

    # ── 首页：静态导航页 ──
    location / {
        root /var/www/tool-site;
        index index.html;
    }

    # ── 工具：盲水印 ──
    location /blind-watermark/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;

        # WebSocket 支持（如需）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # ── 工具：图片压缩（预留） ──
    # location /image-compress/ {
    #     proxy_pass http://127.0.0.1:3002/;
    #     proxy_set_header ...;
    # }

    # ── 工具：二维码生成（预留） ──
    # location /qrcode-generator/ {
    #     proxy_pass http://127.0.0.1:3003/;
    #     proxy_set_header ...;
    # }

    # ── 静态资源缓存（可选） ──
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name tool.flowersink.com;
    return 301 https://$server_name$request_uri;
}
```

部署：

```bash
# 上传配置
sudo tee /etc/nginx/conf.d/tool.flowersink.com.conf > /dev/null

# 检查配置
sudo nginx -t

# 重载 Nginx
sudo nginx -s reload

# 申请证书（如果还没有）
sudo certbot --nginx -d tool.flowersink.com
```

---

## 2. 部署盲水印工具

### 服务端

```bash
# 在 ECS 上创建目录
mkdir -p /opt/tools/blind-watermark
cd /opt/tools/blind-watermark

# 上传项目文件（本地打包上传）
# 本地执行：tar -czf blind-watermark.tar.gz app/ requirements.txt --exclude='__pycache__'
# scp blind-watermark.tar.gz user@your-server:/opt/tools/blind-watermark/

# 解压并安装
tar -xzf blind-watermark.tar.gz
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### systemd 服务（推荐）

```ini
# /etc/systemd/system/blind-watermark.service
[Unit]
Description=Blind Watermark Tool
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/tools/blind-watermark
Environment=ACCESS_KEY=your-access-key
Environment=ROOT_PATH=/blind-watermark
ExecStart=/opt/tools/blind-watermark/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 3001 \
    --limit-concurrency 10
Restart=always
RestartSec=5
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable blind-watermark
sudo systemctl start blind-watermark

# 查看状态
sudo systemctl status blind-watermark

# 查看日志
sudo journalctl -u blind-watermark -f
```

---

## 3. 部署导航首页

```bash
# 在 ECS 上创建目录
sudo mkdir -p /var/www/tool-site

# 上传 tool-site/index.html
# scp tool-site/index.html user@your-server:/var/www/tool-site/
```

---

## 4. 添加新工具

只需三步：

```bash
# 1. 部署工具服务（监听 localhost:300X）
# scp 文件到 /opt/tools/xxx/
# systemctl start xxx

# 2. 在 Nginx 配置中添加新的 location 块
# sudo vim /etc/nginx/conf.d/tool.flowersink.com.conf
# sudo nginx -s reload

# 3. 在导航首页添加工具卡片
# 编辑 /var/www/tool-site/index.html，复制卡片 HTML 并修改
```

---

## 5. 端口分配

| 工具 | 端口 | 描述 |
|------|------|------|
| 盲水印 | 3001 | ✅ 已就绪 |
| 图片压缩 | 3002 | 🔲 预留 |
| 二维码生成 | 3003 | 🔲 预留 |
| JSON 格式化 | 3004 | 🔲 预留 |
