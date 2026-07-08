# 再花的工具箱 — 样式指南 (Style Guide)

本文档定义了"再花的工具箱"系列项目的统一视觉规范。所有新工具项目的样式必须遵循此规范，以保持整体风格一致。

---

## 1. 设计语言

| 属性 | 值 |
|------|-----|
| 风格关键词 | 可爱、粉嫩、毛玻璃、灵动、轻盈 |
| 目标用户 | 个人项目、兴趣向 |
| 设计原则 | 好看 > 功能完备、轻量 > 重型框架、原生 > 依赖 |

---

## 2. 色彩系统

### 2.1 主色盘

```
--bwm-pink:         #ffb5c5    /* 主粉色 - 按钮、激活态、强调 */
--bwm-pink-light:   #ffd6e0    /* 浅粉 - hover、装饰 */
--bwm-pink-bg:      #fff5f5    /* 粉底 - 背景、表格行hover */
--bwm-purple:       #b47cbf    /* 紫色 - 渐变搭配（标题、导航） */
--bwm-blue:         #7a9ecf    /* 蓝色 - 辅助渐变色、info */
```

### 2.2 中性色

```
--bwm-brown:          #4a3728    /* 深棕 - 正文、标题 */
--bwm-brown-light:    #8a7a6a    /* 中棕 - 次要文字、图标 */
--bwm-brown-lighter:  #a09080    /* 浅棕 - placeholder */
--bwm-surface:        rgba(255,255,255,0.72)  /* 毛玻璃底色 */
--bwm-surface-solid:  #ffffff    /* 纯白 */
--bwm-border:         rgba(200,180,160,0.3)    /* 卡片边框 */
--bwm-border-strong:  #d0c0b0   /* 输入框边框 */
```

### 2.3 功能色

```
--bwm-success:  #5a8a3c    /* 成功 - 绿色 */
--bwm-success-bg: #eef5e8
--bwm-warning:  #c8952e    /* 警告 - 金色 */
--bwm-warning-bg: #fdf5e6
--bwm-danger:   #b54a3a    /* 危险 - 红色 */
--bwm-danger-bg: #fdeeed
--bwm-info:     #5b7fa5    /* 信息 - 蓝色 */
```

### 2.4 使用规则

- **主要交互按钮**：粉色实心（`--bwm-pink`），文字白色，不使用渐变
- **导航标题/品牌名**：粉→紫渐变（`linear-gradient(135deg, #ffb5c5, #b47cbf)`），文字剪切
- **卡片背景**：`rgba(255,255,255,0.72)` + `backdrop-filter: blur(12px)` 毛玻璃效果
- **边框**：`rgba(200,180,160,0.3)` 半透明边框
- **阴影**：暖棕色投影（`rgba(142,98,68, 0.06)`），hover 时转为粉色调（`rgba(255,150,160,0.2)`）
- **hover 效果**：统一使用 `opacity: 0.7` 或边框加深，**避免背景色突变**
- **标签/徽章**：纯色背景 + 同色系文字

---

## 3. 字体

### 3.1 字体族

```css
--bwm-font: 'Quicksand', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

### 3.2 字号层级

| Token | 大小 | 用途 |
|-------|------|------|
| 12px | --fi-font-size-xs | 极小标签 |
| 13px | sm | 辅助文字、结果列表、按钮 |
| 14px | md | 正文、输入框 |
| 16px | lg | 较大正文 |
| 18px | xl | 卡片标题、导航标题 |
| 24px | 2xl | 大标题 |

### 3.3 字重

| Token | 值 | 用途 |
|-------|-----|------|
| `--fi-font-weight-medium` | 500 | 正文、按钮 |
| `--fi-font-weight-semibold` | 600 | 卡片标题、标签 |
| `--fi-font-weight-bold` | 700 | 大标题 |

---

## 4. 间距系统

```
--fi-space-1: 4px
--fi-space-2: 8px
--fi-space-3: 12px
--fi-space-4: 16px
--fi-space-5: 20px
--fi-space-6: 24px
--fi-space-7: 32px
--fi-space-8: 40px
```

---

## 5. 圆角

```
--fi-radius-xs: 8px       /* 缩略图、小元素 */
--fi-radius-sm: 10px      /* 按钮、输入框、tab */
--fi-radius-md: 14px      /* 卡片 */
--fi-radius-lg: 18px      /* 大卡片 */
--fi-radius-xl: 20px      /* 导航首页卡片 */
--fi-radius-pill: 999px   /* 标签、头像 */
```

---

## 6. 阴影系统

| 层级 | 值 | 用途 |
|------|-----|------|
| soft | `0 4px 18px rgba(142,98,68,0.06)` | 默认卡片阴影 |
| hover | `0 12px 36px rgba(255,150,160,0.2)` | 卡片 hover 阴影（粉色调） |
| modal | `0 10px 26px rgba(0,0,0,0.1)` | 弹窗阴影 |

---

## 7. 动画与动效

### 7.1 微交互动画

| 元素 | 动画 | 时长 | 曲线 |
|------|------|------|------|
| 卡片 hover | 上浮 `translateY(-6px)` | 0.3s | `cubic-bezier(0.22,1,0.36,1)` |
| 图标 hover | 放大 + 旋转 `scale(1.15) rotate(-5deg)` | 0.3s | `cubic-bezier(0.34,1.56,0.64,1)` |
| 按钮 hover | 透明度变化 `opacity: 0.85` | 0.16s | `ease` |
| 页面切换 | 淡入 + 上移 | 0.18s | `ease` |
| 头像入场 | 缩放 + 旋转 | 0.8s | `cubic-bezier(0.34,1.56,0.64,1)` |
| 背景装饰 | 浮动 + 旋转 | 7-12s | `ease-in-out infinite` |

### 7.2 滚动动画（AOS）

- 引入 AOS 库（`https://unpkg.com/aos@2.3.1`）
- 页头：`fade-down`，delay 100ms
- 卡片：`fade-up`，delay 逐卡递增（200ms、300ms...）
- 底部：`fade-up`，delay 500ms
- AOS 配置：`duration: 600`、`once: true`

### 7.3 背景粒子（可选）

- 花瓣粒子系统：18 片随机颜色/大小/速度的粉色花瓣，从顶部飘落
- 使用纯 CSS `@keyframes` + JS 生成 DOM，无需额外库
- 放在 `#petalContainer` 中，`pointer-events: none` 不干扰交互

---

## 8. 组件规范

### 8.1 导航首页（tool-site）

```
[返回博客]                          [关于工具箱]

          再花的工具箱
          [头像]
   ┌─────────────┐  ┌─────────────┐
   │  🔒 盲水印   │  │  🔲 九宫格  │
   │  可用        │  │  等待开发   │
   └─────────────┘  └─────────────┘
```

- 卡片用毛玻璃效果，hover 时上浮 + 粉色阴影
- 已上线卡片右上角可放 GitHub 图标
- 等待开发卡片用虚线边框 + 灰色文字

### 8.2 工具应用（如盲水印）

- 导航栏：左 HOME 图标 → 中 渐变标题 → 右 GitHub 图标
- Tab 切换：粉底白字激活态，0.18s 淡入动画
- 卡片布局：双列网格（单栏 < 900px），毛玻璃效果
- 按钮：粉色实心，hover 透明度变化
- 输入框：圆角边框，focus 粉色光晕
- 结果列表：左侧彩色边框（绿=成功、红=失败）

### 8.3 验证页面

- 居中卡片布局，输入框 + 粉色按钮
- 按钮与输入框间距 12px
- 错误提示红色文字，放在按钮下方

---

## 9. 响应式断点

| 设备 | 断点 | 变化 |
|------|------|------|
| 移动端 | < 600px | 卡片网格 2 列、字号缩小、导航 padding 减少 |
| 平板 | < 768px | 卡片内边距缩小、导航紧凑 |
| 桌面 | >= 900px | 双列布局恢复 |

---

## 10. 滚动条规范

所有项目统一使用自定义滚动条：

```css
html { overflow: overlay; }
::-webkit-scrollbar { width: 8px; background: transparent; }
::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
html:hover ::-webkit-scrollbar-thumb,
body:hover ::-webkit-scrollbar-thumb { background: rgba(255, 181, 197, 0.5); }
```

- 默认隐藏，hover 时显示粉色半透明滚动条
- 不占据页面宽度（`overflow: overlay`）

---

## 11. 文件命名规范

| 类型 | 命名 | 示例 |
|------|------|------|
| 主题 CSS | `{项目key}-theme.css` | `bwm-theme.css` |
| 交互 JS | `{项目key}-theme.js` | `bwm-theme.js` |
| HTML 模板 | 语义化名称 | `index.html`, `auth.html` |
| 工具首页 | 统一在 `tool-site/` 目录 | `index.html` + `style.css` + `script.js` |

## 12. 自定义光标（可选）

导航首页可使用粉猫光标 SVG（内联 data URI），普通应用页面不建议使用以免干扰用户体验。
