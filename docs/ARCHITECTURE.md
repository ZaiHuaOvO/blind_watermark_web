# 盲水印项目 — 架构说明

## 整体架构

```
用户浏览器
    │
    ▼
Nginx (tool.flowersink.com)
    │
    ├── / → tool-site/index.html（首页导航）
    │
    └── /blind-watermark → proxy_pass 127.0.0.1:8001
        │
        ├── GET / → FastAPI 认证检查 → auth.html / index.html
        ├── GET /static/ → Nginx 直接托管静态文件
        └── POST /api/watermark/* → FastAPI 处理（需 Session 认证）
```

## 认证流程

```
1. 用户访问 /blind-watermark
2. 后端检查 Session 是否含 "authenticated": true
3. 未认证 → 返回 auth.html（密钥输入页面）
4. 用户提交密钥 → POST /api/login
5. 密钥正确 → Session 写入 "authenticated": true → 跳转 /blind-watermark
6. 已认证 → 返回 index.html（工具页面）
7. API 调用通过 Depends(require_auth) 验证 Session
```

## 数据流

### 嵌入水印

```
用户选择图片 → 前端 FileReader 预览
     → 点击"开始嵌入" → POST /api/watermark/embed
     → FastAPI 验证格式 → 保存临时文件
     → blind_service.embed() 调用 blind_watermark 库
        ├── WaterMark.read_img()
        ├── WaterMark.read_wm()
        ├── WaterMark.embed()
        └── 返回 base64 图片数据
     → 删除临时文件
     → 前端接收 base64 → 显示结果 + 保存到 IndexedDB 历史
```

### 提取水印

```
用户选择图片 → 点击"开始提取" → POST /api/watermark/extract
     → FastAPI 解析文件名（获取 wm_length）
     → 有 wm_length？→ blind_service.extract()
     → 没有 wm_length？→ blind_service.extract_auto() 自动尝试
        ├── 遍历 35 种常见长度（24~480 bit）
        ├── 返回第一个不含乱码的有效结果
```

## 服务分层

```
┌──────────────────────────────────────┐
│  app/main.py                         │
│  入口 + Session 认证 + 静态文件挂载   │
├──────────────────────────────────────┤
│  app/api/watermark.py                │
│  API 路由 + 参数校验 + 异常处理       │
├──────────────────────────────────────┤
│  app/services/                       │
│  ├── blind_service.py                │
│  │   blind_watermark 库的适配层      │
│  │   （不修改原库代码）              │
│  └── file_service.py                 │
│      临时文件管理（用完即删）         │
├──────────────────────────────────────┤
│  app/static/ + app/templates/        │
│  前端静态资源（HTML/CSS/JS）         │
└──────────────────────────────────────┘
```

## 密码机制

```
用户输入密码字符串
     → SHA256 哈希 → 取前 8 位 hex → 转为 int
     → 传给 WaterMark(password_wm=password_int)
     
嵌入时：用 password_int 作为随机种子打乱水印比特顺序
提取时：必须用相同的 password_int 恢复顺序
密码错误 → 比特乱序 → 解码出含 � 的乱码
检测到 � → 返回"密码错误"
```

## 并发控制

- FastAPI 应用级 Semaphore(2)
- 同时最多处理 2 个水印请求
- 使用 `async with _get_semaphore(request)` 控制

## 原子操作

所有 API 路由实现"用完即删"的临时文件策略：
1. 保存上传文件到系统临时目录（UUID 命名防冲突）
2. 处理图片
3. `finally` 块中删除临时文件
4. 不保留任何用户数据在服务器上
