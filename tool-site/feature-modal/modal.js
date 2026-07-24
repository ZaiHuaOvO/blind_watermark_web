/**
 * 功能介绍弹窗 - 逻辑 & 内容
 */

var featureContent = {
  'blind-watermark': {
    title: '盲水印',
    icon: '🔒',
    html: [
      '<div class="feature-watermark-header">',
      '  <span class="icon-big">🔒</span>',
      '  <h2>盲水印</h2>',
      '  <div class="sub">Blind Watermark — 不可见的数字水印嵌入与提取</div>',
      '</div>',
      '<hr class="feature-divider">',
      '<h3>📖 什么是盲水印？</h3>',
      '<p>盲水印是一种<strong>不可见的数字水印技术</strong>，它将文字信息以人眼无法察觉的方式嵌入到图片中。即使图片被裁剪、压缩、旋转或调色，水印依然可以被准确提取出来。</p>',
      '<p>与传统的可见水印（如角落的 Logo、半透明文字）不同，盲水印<strong>完全不改变图片的视觉效果</strong>，观看者不会有任何感知。</p>',
      '<div class="feature-highlight-box">',
      '  <p><strong>密码保护</strong> — 可为水印设置密码，只有掌握密码的人才能提取</p>',
      '  <p><strong>抗攻击</strong> — 支持裁剪、JPEG 压缩、缩放、旋转等常见攻击</p>',
      '  <p><strong>自适应长度</strong> — 自动检测水印长度，无需手动记忆参数</p>',
      '  <p><strong>隐私安全</strong> — 所有处理均在服务端内存完成，不留任何文件</p>',
      '</div>',
      '<h3>💡 适用场景</h3>',
      '<ul>',
      '  <li><strong>版权保护</strong> — 创作者在作品发布前嵌入身份标识</li>',
      '  <li><strong>溯源追踪</strong> — 给不同渠道分发不同水印图片，泄露时追溯来源</li>',
      '  <li><strong>内容认证</strong> — 验证图片是否为原始发布版本</li>',
      '  <li><strong>隐秘通信</strong> — 在图片中隐藏信息，安全传递</li>',
      '</ul>',
      '<h3>⚙️ 如何使用</h3>',
      '<p><strong>嵌入水印：</strong>上传图片 → 输入要隐藏的文字 → 可选密码 → 点击嵌入 → 下载带水印的图片</p>',
      '<p><strong>提取水印：</strong>上传已含盲水印的图片 → 输入对应的密码 → 点击提取 → 查看隐藏的文字</p>',
      '<hr class="feature-divider">',
      '<p style="text-align:center;font-size:0.8rem;color:#b0a090;">基于 <a href="https://github.com/guofei9987/blind_watermark" target="_blank" style="color:#b080a0;">blind_watermark</a> 开源库开发</p>',
      '<div style="text-align:center;margin-top:16px;"><a href="/blind-watermark" class="feature-btn">前往盲水印 →</a></div>',
      '<p style="text-align:center;margin-top:18px;font-size:0.75rem;color:#c0b0a0;">- 再花 -</p>',
    ].join('\n'),
  },

  'nine-grid': {
    title: '九宫格',
    icon: '🔲',
    html: [
      '<div class="feature-nine-header">',
      '  <span class="icon-big">🔲</span>',
      '  <h2>九宫格</h2>',
      '  <span class="feature-nine-tag tag-ready" style="background:#e8f5e8;color:#5a8a4a;border-radius:10px;padding:2px 10px;font-size:0.7rem;font-weight:600;">可用</span>',
      '</div>',
      '<hr class="feature-divider">',
      '<h3>📖 这是什么？</h3>',
      '<p>基于 <strong>Cropper.js</strong> 的九宫格一键裁剪工具。上传图片，选取正方形区域，自动切分为九宫格拼图，生成类似微信朋友圈的拟真预览效果。</p>',
      '<div class="feature-nine-preview">',
      '  <div class="mock-moments-card">',
      '    <div class="mock-moments-header">',
      '      <div class="mock-moments-avatar"></div>',
      '      <span class="mock-moments-name">再花</span>',
      '    </div>',
      '    <div class="mock-moments-bg">',
      '      <div class="mock-grid">',
      '        <div class="mock-cell"></div>',
      '        <div class="mock-cell"></div>',
      '        <div class="mock-cell"></div>',
      '        <div class="mock-cell"></div>',
      '        <div class="mock-cell"></div>',
      '        <div class="mock-cell"></div>',
      '        <div class="mock-cell"></div>',
      '        <div class="mock-cell"></div>',
      '        <div class="mock-cell"></div>',
      '      </div>',
      '    </div>',
      '    <div class="mock-moments-footer">',
      '      <span>Like</span><span>Comment</span>',
      '    </div>',
      '  </div>',
      '  <div class="mock-label">可自定义间距与背景颜色</div>',
      '</div>',
      '<h3>✨ 特色功能</h3>',
      '<ul>',
      '  <li><strong>单张处理</strong> — 上传图片，自由裁剪区域，自动生成九宫格预览</li>',
      '  <li><strong>批量处理</strong> — 同时处理多张图片，支持单张或全部打包下载</li>',
      '  <li><strong>朋友圈预览</strong> — 模拟微信朋友圈 / QQ 空间的发布效果，带头像和昵称</li>',
      '  <li><strong>历史记录</strong> — 自动保存处理记录到本地，随时查看原图、预览九宫格</li>',
      '  <li><strong>隐私安全</strong> — 所有处理在浏览器完成，不上传任何图片到服务器</li>',
      '</ul>',
      '<h3>⚙️ 如何使用</h3>',
      '<p><strong>单张处理：</strong>上传图片 → 拖动裁剪框选择区域 → 点击"生成" → 调整间距和背景色 → 下载 ZIP</p>',
      '<p><strong>批量处理：</strong>上传多张图片 → 每张独立裁剪生成 → 单张下载或全部打包下载</p>',
      '<hr class="feature-divider">',
      '<p style="text-align:center;font-size:0.8rem;color:#b0a090;">基于 <a href="https://github.com/fengyuanchen/cropperjs" target="_blank" style="color:#b080a0;">Cropper.js</a> 开源库开发</p>',
      '<div style="text-align:center;margin-top:16px;"><a href="/nine-grid" class="feature-btn">前往九宫格 →</a></div>',
      '<p style="text-align:center;margin-top:18px;font-size:0.75rem;color:#c0b0a0;">- 再花 -</p>',
    ].join('\n'),
  },

  'aliyun': {
    title: '云效助手',
    icon: '🤖',
    html: [
      '<div style="text-align:center;margin-bottom:16px;">',
      '  <span style="font-size:3rem;display:block;margin-bottom:8px;">🤖</span>',
      '  <h2>云效助手</h2>',
      '  <span class="feature-nine-tag tag-key" style="background:#fff3e0;color:#b88540;border-radius:10px;padding:2px 10px;font-size:0.7rem;font-weight:600;">仅再花可用</span>',
      '</div>',
      '<hr class="feature-divider">',
      '<h3>📖 这是什么？</h3>',
      '<p>基于云效 OpenAPI 开发的轻量级日报生成工具。只需点击一下，即可自动生成格式工整的工作日报。</p>',
      '<h3>✨ 功能</h3>',
      '<ul>',
      '  <li><strong>一键日报</strong> — 自动对比今日与昨日的工作项，识别状态变化，生成 Markdown 日报</li>',
      '  <li><strong>任务查询</strong> — 输入工作项编号（如 QXIV-282），查询任务详情及父任务信息</li>',
      '  <li><strong>一键复制</strong> — 支持复制日报或任务信息，方便粘贴到需要的地方</li>',
      '</ul>',
      '<p>如果你也在使用云效需要类似的功能，可以联系再花。</p>',
      '<hr class="feature-divider">',
      '<p style="text-align:center;margin-top:18px;font-size:0.75rem;color:#c0b0a0;">- 再花 -</p>',
    ].join('\n'),
  },

  'about': {
    title: '关于工具箱',
    html: [
      '<div style="text-align:center;margin-bottom:16px;">',
      '  <div style="font-size:3rem;margin-bottom:8px;">🧰</div>',
      '  <h2 style="margin-bottom:4px;">关于工具箱</h2>',
      '</div>',
      '<hr class="feature-divider">',
      '<h3>📖 这是什么？</h3>',
      '<p>一个由再花开发的各种便利实用性工具合集，通常为自己或朋友需要的。</p>',
      '<h3>💡 为什么有密钥？</h3>',
      '<p>再花的服务器资源性能极其有限，所以为所有需要占用服务器资源的工具都设置了密钥。</p>',
      '<h3>✨ 想要获得更多？</h3>',
      '<p>需要密钥 / 有新的需求 / 想要为某个开源项目适配 Web 端 / 工具有 BUG，给我写邮件就好（或者在我的博客找到我的其他联系方式）。</p>',
      '<div style="text-align:center;margin:16px 0;">',
      '  <button class="feature-btn" onclick="copyEmail()" id="copyEmailBtn">点击复制邮件地址</button>',
      '  <p id="copyEmailTip" style="font-size:0.75rem;color:#b0a090;margin-top:6px;min-height:1.2em;"></p>',
      '</div>',
      '<p style="text-align:center;margin-top:18px;font-size:0.75rem;color:#c0b0a0;">- 再花 -</p>',
    ].join('\n'),
  },
};

function openFeature(key) {
  var data = featureContent[key];
  if (!data) return;

  var overlay = document.getElementById('featureModal');
  var content = document.getElementById('featureContent');

  content.innerHTML = '<div class="feature-content">' + data.html + '</div>';
  // 每次打开弹窗，确保滚动回到顶部
  var card = overlay.querySelector('.modal-card');
  if (card) card.scrollTop = 0;
  overlay.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';
}

function closeFeature() {
  var overlay = document.getElementById('featureModal');
  if (!overlay.classList.contains('modal-overlay--open')) return;

  overlay.classList.add('modal-overlay--closing');
  setTimeout(function () {
    overlay.classList.remove('modal-overlay--open', 'modal-overlay--closing');
    document.body.style.overflow = '';
  }, 260);
}

// ESC 关闭弹窗
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeFeature();
});

function copyEmail() {
  var email = 'ZyZy1724@gmail.com';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(function () {
      showCopyTip('✅ 已复制到剪贴板');
    }).catch(function () {
      fallbackCopy(email);
    });
  } else {
    fallbackCopy(email);
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showCopyTip('✅ 已复制到剪贴板');
  } catch (e) {
    showCopyTip('❌ 复制失败，请手动复制');
  }
  document.body.removeChild(ta);
}

function showCopyTip(msg) {
  var tip = document.getElementById('copyEmailTip');
  if (tip) tip.textContent = msg;
}
