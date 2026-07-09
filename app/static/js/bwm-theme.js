/**
 * 盲水印 - 交互脚本（主题适配版）
 * 功能逻辑不变，仅适配新样式
 */

// ══════════════════════════════════════════════════════
//  Globals: image arrays per upload area
// ══════════════════════════════════════════════════════

var imageStore = {
  embedSingle: [],
  extractSingle: [],
  embedBatch: [],
  extractBatch: [],
  perMulti: [],
  perOneMulti: [],
};

// 上传模式状态: 'file' | 'paste' | 'url'
var uploadModes = {
  embedSingle: 'file',
  extractSingle: 'file',
  embedBatch: 'file',
  extractBatch: 'file',
  perMulti: 'file',
  perOneMulti: 'file',
};

// ══════════════════════════════════════════════════════
//  Upload Mode Switching
// ══════════════════════════════════════════════════════

function switchUploadMode(area, mode) {
  var isSingle = area.indexOf('Single') >= 0;

  // 单图模式：互斥逻辑
  if (isSingle) {
    var urlInput = document.getElementById('urlInput-' + area);
    var store = imageStore[area];

    if (mode === 'url') {
      // 切换到网络图片模式：如果已有预览图片 → 禁用 input + 提示
      if (store.length > 0) {
        if (urlInput) {
          urlInput.disabled = true;
          urlInput.placeholder = '已检测到上传图片';
          urlInput.value = '';
        }
        showToast('已检测到上传图片，请先清空后使用网络图片', 'warning');
      } else {
        if (urlInput) {
          urlInput.disabled = false;
          urlInput.placeholder = '输入图片 URL，如 https://example.com/image.jpg';
        }
      }
    } else {
      // 切换到文件/粘贴模式：如果 URL input 有值 → 清空
      if (urlInput && urlInput.value.trim() && !urlInput.disabled) {
        urlInput.value = '';
        showToast('已清空网络图片', 'info');
      }
      if (urlInput) {
        urlInput.disabled = false;
      }
    }
  }

  uploadModes[area] = mode;

  // 更新按钮状态
  var bar = document.querySelector('[data-area="' + area + '"]');
  if (bar) {
    var btns = bar.parentNode.querySelectorAll('.bwm-upload-mode-btn[data-area="' + area + '"]');
    btns.forEach(function (btn) {
      btn.classList.toggle('bwm-upload-mode-btn--active', btn.dataset.mode === mode);
    });
  }

  // 切换面板
  ['file', 'paste', 'url'].forEach(function (m) {
    var panel = document.getElementById('panel-' + area + '-' + m);
    if (panel) {
      panel.classList.toggle('bwm-upload-panel--active', m === mode);
    }
  });
}

function checkBatchConflict(area) {
  // 批量模式：如果预览和 URL 都有值，显示提示
  var isSingle = area.indexOf('Single') >= 0;
  if (isSingle) return;

  var store = imageStore[area];
  var urlInput = document.getElementById('urlInput-' + area);
  var hasStoreItems = store.length > 0;
  var hasUrlValue = urlInput && urlInput.value.trim().length > 0;

  // 查找或创建提示元素
  var previewGrid = document.getElementById(area === 'embedBatch' ? 'embedPreviewBatch' : 'extractPreviewBatch');
  if (!previewGrid) return;

  var oldHint = previewGrid.parentNode.querySelector('.bwm-conflict-hint');
  if (oldHint) oldHint.remove();

  if (hasStoreItems && hasUrlValue) {
    var hint = document.createElement('div');
    hint.className = 'bwm-conflict-hint';
    hint.textContent = '预览图片和网络图片会一并进行提取';
    previewGrid.parentNode.appendChild(hint);
  }
}

// ══════════════════════════════════════════════════════
//  Utilities
// ══════════════════════════════════════════════════════

function escapeHtml(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showToast(msg, type) {
  var c = document.getElementById('toastContainer');
  var t = document.createElement('div');
  t.className = 'bwm-toast';
  if (type === 'error') t.className += ' bwm-toast--error';
  else if (type === 'warning') t.className += ' bwm-toast--warning';
  else if (type === 'info') t.className += ' bwm-toast--info';
  t.textContent = msg;
  t.onclick = function () { t.remove(); };
  c.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
}

function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="bwm-spinner"></span> 处理中...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || '提交';
  }
}

// ── Modal ──────────

function openModal(title, body, confirmText, callback) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  var cb = document.getElementById('modalConfirmBtn');
  cb.textContent = confirmText || '确定';
  cb.className = 'bwm-btn bwm-btn--solid' + (confirmText === '删除' ? ' bwm-btn--danger' : '');
  cb.onclick = function () { closeModal(); if (callback) callback(); };
  document.getElementById('modalOverlay').classList.add('bwm-modal-overlay--open');
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('bwm-modal-overlay--open');
}

// ── Lightbox ───────────

function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('bwm-lightbox--open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('bwm-lightbox--open');
}

// ── Incremental file upload + square thumbnail preview

function getDebugPanel(storeName) {
  var map = {
    embedSingle: 'embedResultSingle',
    extractSingle: 'extractResultSingle',
    embedBatch: 'embedResultBatch',
    extractBatch: 'extractResultBatch',
  };
  var container = document.getElementById(map[storeName]);
  if (!container) return null;
  var panel = container.parentNode.querySelector('.bwm-debug');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'bwm-debug';
    panel.style.display = 'none';
    container.parentNode.appendChild(panel);
  }
  return panel;
}

function debugLog(panel, msg, cssClass) {
  if (!panel) return;
  var time = new Date().toLocaleTimeString();
  var line = document.createElement('div');
  var timeSpan = document.createElement('span');
  timeSpan.className = 'bwm-dlog-time';
  timeSpan.textContent = '[' + time + ']';
  line.appendChild(timeSpan);
  var msgSpan = document.createElement('span');
  if (cssClass) msgSpan.className = cssClass;
  msgSpan.textContent = msg;
  line.appendChild(msgSpan);
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
}

var _serverLogPolling = null;

function startServerLogPolling(panel, intervalMs) {
  stopServerLogPolling();
  if (!panel) return;
  intervalMs = intervalMs || 2000;
  _serverLogPolling = setInterval(async function () {
    try {
      var resp = await fetch('/api/watermark/logs');
      if (!resp.ok) return;
      var data = await resp.json();
      if (data.logs && data.logs.length) {
        data.logs.forEach(function (logMsg) {
          var cssClass = 'bwm-dlog-info';
          if (logMsg.indexOf('✅') >= 0 || logMsg.indexOf('🎉') >= 0 || logMsg.indexOf('成功') >= 0) cssClass = 'bwm-dlog-ok';
          else if (logMsg.indexOf('❌') >= 0 || logMsg.indexOf('😢') >= 0 || logMsg.indexOf('失败') >= 0 || logMsg.indexOf('错误') >= 0) cssClass = 'bwm-dlog-err';
          else if (logMsg.indexOf('⚠') >= 0 || logMsg.indexOf('注意') >= 0) cssClass = 'bwm-dlog-warn';
          debugLog(panel, logMsg, cssClass + ' bwm-dlog-server');
        });
      }
    } catch (e) {
      // ignore polling errors
    }
  }, intervalMs);
}

function stopServerLogPolling() {
  if (_serverLogPolling) {
    clearInterval(_serverLogPolling);
    _serverLogPolling = null;
  }
}

function handleFileInput(inputId, storeName) {
  var input = document.getElementById(inputId);
  if (!input.files || !input.files.length) return;
  var store = imageStore[storeName];
  var files = Array.from(input.files);

  // 立即重置 input，避免浏览器显示文件名或"未选择任何文件"
  input.value = '';

  var pending = files.length;
  var debug = getDebugPanel(storeName);

  debugLog(debug, '选择了 ' + files.length + ' 个文件');

  if (storeName.indexOf('Single') >= 0) {
    store.length = 0;
    debugLog(debug, '单图模式，清空旧图');
  }

  files.forEach(function (file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      store.push({ file: file, dataUrl: e.target.result });
      renderThumbs(storeName);
      pending--;
      if (storeName.indexOf('Single') >= 0) {
        // 单图模式：如果切换到 URL 模式时已有图，后续禁用 URL input
        var urlInput = document.getElementById('urlInput-' + storeName);
        if (urlInput && uploadModes[storeName] === 'url') {
          urlInput.disabled = true;
          urlInput.placeholder = '已检测到上传图片';
          urlInput.value = '';
        }
      }
      checkBatchConflict(storeName);
      // 逐张处理 - 多图分别水印：FileReader 完成后重新渲染行列表
      if (storeName === 'perMulti') {
        renderPerMultiList();
      }
    };
    reader.onerror = function () {
      pending--;
    };
    reader.readAsDataURL(file);
  });
}

function renderThumbs(storeName) {
  var map = {
    embedSingle: 'embedPreviewSingle',
    extractSingle: 'extractPreviewSingle',
    embedBatch: 'embedPreviewBatch',
    extractBatch: 'extractPreviewBatch',
    perOneMulti: 'perOneMultiPreview',
  };
  var grid = document.getElementById(map[storeName]);
  var store = imageStore[storeName];
  if (!grid) return; // 没有缩略图容器的 store（如 perMulti）跳过

  // 更新文件选择按钮旁的提示文字
  var inputId = storeName === 'embedSingle' ? 'embedFileSingle' : storeName === 'extractSingle' ? 'extractFileSingle' : storeName === 'embedBatch' ? 'embedFileBatch' : 'extractFileBatch';
  var input = document.getElementById(inputId);
  // 先移除旧提示
  var oldHint = input && input.parentNode.querySelector('.bwm-file-hint');
  if (oldHint) oldHint.remove();
  // 有图片才添加提示
  if (store.length > 0 && input) {
    var hint = document.createElement('span');
    hint.className = 'bwm-file-hint';
    hint.textContent = '已检测到图片，预览若为空不影响使用';
    input.parentNode.insertBefore(hint, input.nextSibling);
  }

  if (store.length === 0) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = store.map(function (item, idx) {
    return '<div class="bwm-thumb-item" onclick="openLightbox(\'' + item.dataUrl + '\')">' +
      '<img src="' + item.dataUrl + '" alt="预览">' +
      '<button class="bwm-thumb-remove" onclick="event.stopPropagation(); removeThumb(\'' + storeName + '\',' + idx + ')">&times;</button></div>';
  }).join('');
}

function removeThumb(storeName, idx) {
  imageStore[storeName].splice(idx, 1);
  renderThumbs(storeName);
  // 单图：如果 URL 模式被禁用，解除
  if (storeName.indexOf('Single') >= 0) {
    var urlInput = document.getElementById('urlInput-' + storeName);
    if (urlInput && imageStore[storeName].length === 0) {
      urlInput.disabled = false;
      urlInput.placeholder = '输入图片 URL，如 https://example.com/image.jpg';
    }
  }
  // 批量：检查冲突提示
  checkBatchConflict(storeName);
}

function getFilesFromStore(storeName) {
  return imageStore[storeName].map(function (item) { return item.file; });
}

// ══════════════════════════════════════════════════════
//  Paste Handler
// ══════════════════════════════════════════════════════

function handlePaste(area) {
  return function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    var files = e.clipboardData && e.clipboardData.files;
    var imageFiles = [];

    if (items && items.length) {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.type && item.type.indexOf('image/') === 0) {
          var file = item.getAsFile();
          if (file) {
            // 标准化文件名
            if (!file.name || file.name === '') {
              file = new File([file], 'pasted-image-' + Date.now() + '.' + item.type.split('/')[1], { type: item.type });
            }
            imageFiles.push(file);
          }
        }
      }
    } else if (files && files.length) {
      for (var j = 0; j < files.length; j++) {
        if (files[j].type && files[j].type.indexOf('image/') === 0) {
          imageFiles.push(files[j]);
        }
      }
    }

    if (imageFiles.length === 0) {
      showToast('未检测到剪贴板中的图片', 'warning');
      return;
    }

    var isSingle = area.indexOf('Single') >= 0;
    var resultDetail = document.getElementById('pasteResult-' + area);
    var resultHtml = '';

    if (isSingle && imageFiles.length > 1) {
      showToast('检测到多张图片，仅上传首张', 'info');
      resultHtml = '<div class="bwm-upload-result-item bwm-upload-result-item--warning">检测到 ' + imageFiles.length + ' 张图片，仅上传首张</div>';
      imageFiles = [imageFiles[0]];
    }

    // 清空旧 store（单图模式）或追加（批量模式）
    if (isSingle) {
      imageStore[area].length = 0;
    }

    // 验证并添加图片
    var added = 0;
    var failed = 0;
    imageFiles.forEach(function (file) {
      // 验证大小
      if (file.size > 10 * 1024 * 1024) {
        showToast(file.name + ' 超过 10MB 限制', 'error');
        resultHtml += '<div class="bwm-upload-result-item bwm-upload-result-item--error">❌ ' + file.name + '：超过 10MB 限制</div>';
        failed++;
        return;
      }
      // 验证格式
      var ext = '.' + file.name.split('.').pop().toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].indexOf(ext) < 0 && file.type.indexOf('image/') === 0) {
        // 从 MIME 推断扩展名
        var mimeToExt = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
        ext = mimeToExt[file.type] || '.png';
      }
      if (['.jpg', '.jpeg', '.png', '.webp'].indexOf(ext) < 0) {
        showToast('不支持 ' + ext + ' 格式', 'error');
        resultHtml += '<div class="bwm-upload-result-item bwm-upload-result-item--error">❌ ' + file.name + '：不支持的格式</div>';
        failed++;
        return;
      }

      // 读取并添加
      var reader = new FileReader();
      reader._file = file;
      reader._area = area;
      reader.onload = function (ev) {
        imageStore[ev.target._area].push({ file: ev.target._file, dataUrl: ev.target.result });
        renderThumbs(ev.target._area);
        checkBatchConflict(ev.target._area);
      };
      reader.readAsDataURL(file);
      added++;
      resultHtml += '<div class="bwm-upload-result-item bwm-upload-result-item--success">✅ ' + file.name + '：已添加</div>';
    });

    // 显示结果详情
    if (resultDetail) {
      resultDetail.innerHTML = resultHtml;
      resultDetail.style.display = 'block';
      // 3 秒后自动隐藏
      clearTimeout(resultDetail._hideTimer);
      resultDetail._hideTimer = setTimeout(function () {
        if (resultDetail) resultDetail.style.display = 'none';
      }, 5000);
    }

    // 标记粘贴区状态
    var pasteZone = document.getElementById('pasteZone-' + area);
    if (pasteZone && added > 0) {
      pasteZone.classList.add('bwm-paste-zone--pasted');
    }

    if (added > 0) {
      showToast('已添加 ' + added + ' 张图片' + (failed > 0 ? '，' + failed + ' 张失败' : ''), failed > 0 ? 'warning' : 'success');
    }
  };
}

// ══════════════════════════════════════════════════════
//  URL submission helpers
// ══════════════════════════════════════════════════════

function getUrlsFromArea(area) {
  var isSingle = area.indexOf('Single') >= 0;
  var input = document.getElementById('urlInput-' + area);
  if (!input) return [];
  if (isSingle) {
    var url = input.value.trim();
    return url ? [url] : [];
  }
  // 批量模式：textarea，每行一个 URL
  return input.value.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
}

async function submitEmbedSingleFromUrl() {
  var text = document.getElementById('embedTextSingle').value.trim();
  var password = document.getElementById('embedPwdSingle').value.trim();
  var urls = getUrlsFromArea('embedSingle');
  var btn = document.getElementById('embedBtnSingle');
  if (!text) { showToast('请输入水印文本', 'error'); return; }
  if (!urls.length) { showToast('请输入图片 URL', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('embedResultSingle');
  resultDiv.innerHTML = '';
  var controller = startCancelableProcess('embedResultSingle');
  var signal = controller.signal;
  var allResults = []; var zipData = []; var cancelled = false;
  for (var i = 0; i < urls.length; i++) {
    if (signal.aborted) { cancelled = true; break; }
    try {
      var resp = await fetch('/api/watermark/embed/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urls[i], text: text, password: password }),
        signal: signal,
      });
      if (!resp.ok) {
        var errMsg = '失败';
        try { var errData = await resp.json(); errMsg = errData.detail || errMsg; } catch (e2) { errMsg = resp.status + ' ' + resp.statusText; }
        throw new Error(errMsg);
      }
      var data = await resp.json();
      try {
        var bs = atob(data.image_data.split(',')[1]), mt = data.image_data.split(',')[0].match(/:(.*?);/)[1];
        var ab = new ArrayBuffer(bs.length), ia = new Uint8Array(ab);
        for (var j = 0; j < bs.length; j++) ia[j] = bs.charCodeAt(j);
        await addHistory({ original_name: urls[i], output_name: data.output_name, watermark_text: text, has_password: data.has_password, wm_length: data.wm_length, image_blob: new Blob([ab], { type: mt }) });
      } catch (e) { console.warn('历史保存失败', e); }
      zipData.push({ base64Data: data.image_data, filename: data.output_name });
      allResults.push({ file_name: urls[i], success: true, output_name: data.output_name, image_data: data.image_data });
    } catch (e) {
      if (isAbortError(e)) { cancelled = true; break; }
      allResults.push({ file_name: urls[i], success: false, error: e.message });
    }
  }
  stopServerLogPolling();
  cleanupActiveProcess();
  if (cancelled) {
    debugLog(debugPanel, '⛔ 处理已取消', 'bwm-dlog-warn');
    resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return;
  }
  debugLog(debugPanel, '✅ 批量提取完成！', 'bwm-dlog-ok');
  renderUrlResults(allResults, resultDiv, zipData, 'watermarked_url.zip', '嵌入');
  setLoading(btn, false);
}

async function submitEmbedBatchFromUrl() {
  var text = document.getElementById('embedTextBatch').value.trim();
  var password = document.getElementById('embedPwdBatch').value.trim();
  var urls = getUrlsFromArea('embedBatch');
  var btn = document.getElementById('embedBtnBatch');
  if (!text) { showToast('请输入水印文本', 'error'); return; }
  if (!urls.length) { showToast('请输入图片 URL', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('embedResultBatch');
  resultDiv.innerHTML = '';
  var controller = startCancelableProcess('embedResultBatch');
  var signal = controller.signal;
  var allResults = []; var zipData = []; var cancelled = false;
  for (var i = 0; i < urls.length; i++) {
    if (signal.aborted) { cancelled = true; break; }
    try {
      var resp = await fetch('/api/watermark/embed/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urls[i], text: text, password: password }),
        signal: signal,
      });
      if (!resp.ok) {
        var errMsg = '处理失败';
        try { var errData = await resp.json(); errMsg = errData.detail || errMsg; } catch (e2) {}
        throw new Error(errMsg);
      }
      var data = await resp.json();
      try {
        var bs = atob(data.image_data.split(',')[1]), mt = data.image_data.split(',')[0].match(/:(.*?);/)[1];
        var ab = new ArrayBuffer(bs.length), ia = new Uint8Array(ab);
        for (var j = 0; j < bs.length; j++) ia[j] = bs.charCodeAt(j);
        await addHistory({ original_name: urls[i], output_name: data.output_name, watermark_text: text, has_password: data.has_password, wm_length: data.wm_length, image_blob: new Blob([ab], { type: mt }) });
      } catch (e) { console.warn('历史保存失败', e); }
      zipData.push({ base64Data: data.image_data, filename: data.output_name });
      allResults.push({ file_name: urls[i], success: true, output_name: data.output_name, image_data: data.image_data });
    } catch (e) {
      if (isAbortError(e)) { cancelled = true; break; }
      allResults.push({ file_name: urls[i], success: false, error: e.message });
    }
  }
  cleanupActiveProcess();
  if (cancelled) { resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return; }
  renderUrlResults(allResults, resultDiv, zipData, 'watermarked_url_batch.zip', '嵌入');
  setLoading(btn, false);
}

async function submitExtractSingleFromUrl() {
  var password = document.getElementById('extractPwdSingle').value.trim();
  var urls = getUrlsFromArea('extractSingle');
  var btn = document.getElementById('extractBtnSingle');
  if (!urls.length) { showToast('请输入图片 URL', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('extractResultSingle');
  resultDiv.innerHTML = '';
  var debugPanel = getDebugPanel('extractSingle');
  if (debugPanel) { debugPanel.innerHTML = ''; debugPanel.style.display = 'block';
    document.getElementById('toggleDebugBtn').textContent = '隐藏调试';
    document.getElementById('toggleDebugBtn').style.opacity = '1';
  }
  debugLog(debugPanel, '🚀 开始从 URL 提取盲水印...', 'bwm-dlog-ok');
  startServerLogPolling(debugPanel, 1500);
  var controller = startCancelableProcess('extractResultSingle');
  var signal = controller.signal;
  var results = []; var cancelled = false;
  for (var i = 0; i < urls.length; i++) {
    if (signal.aborted) { cancelled = true; break; }
    try {
      var resp = await fetch('/api/watermark/extract/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urls[i], password: password }),
        signal: signal,
      });
      if (!resp.ok) {
        var errMsg = '失败';
        try { var errData = await resp.json(); errMsg = errData.detail || errMsg; } catch (e) { errMsg = resp.status + ' ' + resp.statusText; }
        throw new Error(errMsg);
      }
      var data = await resp.json();
      results.push({ file_name: urls[i], text: data.text, success: data.success });
    } catch (e) {
      if (isAbortError(e)) { cancelled = true; break; }
      results.push({ file_name: urls[i], text: e.message, success: false });
    }
  }
  stopServerLogPolling();
  cleanupActiveProcess();
  if (cancelled) {
    debugLog(debugPanel, '⛔ 处理已取消', 'bwm-dlog-warn');
    resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return;
  }
  debugLog(debugPanel, '✅ 提取完成！', 'bwm-dlog-ok');
  renderExtractUrlResults(results, resultDiv, '提取');
  setLoading(btn, false);
}

async function submitExtractBatchFromUrl() {
  var password = document.getElementById('extractPwdBatch').value.trim();
  var urls = getUrlsFromArea('extractBatch');
  var btn = document.getElementById('extractBtnBatch');
  if (!urls.length) { showToast('请输入图片 URL', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('extractResultBatch');
  resultDiv.innerHTML = '';
  var debugPanel = getDebugPanel('extractBatch');
  if (debugPanel) { debugPanel.innerHTML = ''; debugPanel.style.display = 'block';
    document.getElementById('toggleDebugBtn').textContent = '隐藏调试';
    document.getElementById('toggleDebugBtn').style.opacity = '1';
  }
  debugLog(debugPanel, '🚀 开始从 URL 批量提取盲水印...', 'bwm-dlog-ok');
  startServerLogPolling(debugPanel, 2000);
  var controller = startCancelableProcess('extractResultBatch');
  var signal = controller.signal;
  var results = []; var cancelled = false;
  for (var i = 0; i < urls.length; i++) {
    if (signal.aborted) { cancelled = true; break; }
    try {
      var resp = await fetch('/api/watermark/extract/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urls[i], password: password }),
        signal: signal,
      });
      if (!resp.ok) {
        var errMsg = '失败';
        try { var errData = await resp.json(); errMsg = errData.detail || errMsg; } catch (e) { errMsg = resp.status + ' ' + resp.statusText; }
        throw new Error(errMsg);
      }
      var data = await resp.json();
      results.push({ file_name: urls[i], text: data.text, success: data.success });
    } catch (e) {
      if (isAbortError(e)) { cancelled = true; break; }
      results.push({ file_name: urls[i], text: e.message, success: false });
    }
  }
  stopServerLogPolling();
  cleanupActiveProcess();
  if (cancelled) {
    debugLog(debugPanel, '⛔ 处理已取消', 'bwm-dlog-warn');
    resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return;
  }
  debugLog(debugPanel, '✅ 批量提取完成！', 'bwm-dlog-ok');
  renderExtractUrlResults(results, resultDiv, '提取');
  setLoading(btn, false);
}

// ══════════════════════════════════════════════════════
//  Result Renderers
// ══════════════════════════════════════════════════════

function renderUrlResults(allResults, resultDiv, zipData, zipName, actionLabel) {
  var ok = allResults.filter(function (r) { return r.success; }).length;
  var fail = allResults.filter(function (r) { return !r.success; }).length;
  if (fail > 0) {
    allResults.forEach(function (r) { if (!r.success) showToast(r.file_name + ': ' + r.error, 'error'); });
  }
  var html = '<div class="bwm-alert ' + (fail ? 'bwm-alert--warning' : 'bwm-alert--success') + '">完成！成功 ' + ok + '/' + allResults.length + (fail ? '，失败 ' + fail : '') + '</div><ul class="bwm-result-list">';
  allResults.forEach(function (r) {
    html += '<li class="bwm-result-item ' + (r.success ? 'bwm-result-item--success' : 'bwm-result-item--error') + '">';
    html += '<span>' + (r.success ? '✅' : '❌') + '</span><div style="min-width:0;flex:1"><div class="bwm-embed-filename" style="font-size:12px;word-break:break-all;">' + escapeHtml(r.file_name) + '</div>' + (r.success ? '<div class="bwm-embed-outname">' + escapeHtml(r.output_name) + '</div>' : '<div class="bwm-embed-error">' + escapeHtml(r.error || '') + '</div>') + '</div>';
    if (r.success) html += '<button class="bwm-btn bwm-btn--sm" onclick="downloadFromBase64(\'' + r.image_data + '\',\'' + escapeHtml(r.output_name) + '\')">⬇</button>';
    html += '</li>';
  });
  html += '</ul>';
  if (zipData.length > 1) html += '<div class="bwm-mt-3"><button class="bwm-btn bwm-btn--solid" onclick=\'downloadAsZip(' + JSON.stringify(zipData) + ',"' + zipName + '")\'>📦 批量下载 ZIP</button></div>';
  resultDiv.innerHTML = html;
  if (fail === 0) showToast(actionLabel + '成功！', 'success'); else showToast(fail + ' 张失败', 'warning');
}

function renderExtractUrlResults(results, resultDiv, actionLabel) {
  var ok = results.filter(function (r) { return r.success; }).length;
  var fail = results.filter(function (r) { return !r.success; }).length;
  if (fail > 0) {
    results.forEach(function (r) { if (!r.success) showToast(r.file_name + ': ' + r.text, 'error'); });
  }
  var html = '<div class="bwm-alert ' + (fail ? 'bwm-alert--warning' : 'bwm-alert--success') + '">完成！成功 ' + ok + '/' + results.length + (fail ? '，失败 ' + fail : '') + '</div><ul class="bwm-result-list">';
  results.forEach(function (r) {
    var icon = r.success ? '✅' : (r.text.indexOf('密码') >= 0 ? '🔑' : '❌');
    html += '<li class="bwm-result-item ' + (r.success ? 'bwm-result-item--success' : 'bwm-result-item--error') + '">' + icon + ' <div style="min-width:0;flex:1"><div class="bwm-extract-filename" style="font-size:12px;word-break:break-all;">' + escapeHtml(r.file_name) + '</div><div class="bwm-extract-text">' + escapeHtml(r.text) + '</div></div></li>';
  });
  html += '</ul>';
  resultDiv.innerHTML = html;
  if (fail === 0) showToast(actionLabel + '成功！', 'success'); else showToast(fail + ' 张失败', 'warning');
}

// ══════════════════════════════════════════════════════
//  逐张处理
// ══════════════════════════════════════════════════════

// 子模式状态
var perSubMode = 'multi-image'; // 'multi-image' | 'one-multi'

function switchPerSubMode(mode) {
  perSubMode = mode;
  document.querySelectorAll('.bwm-per-submode-btn').forEach(function (b) {
    b.classList.toggle('bwm-per-submode-btn--active', b.dataset.permode === mode);
  });
  ['multi-image', 'one-multi'].forEach(function (m) {
    var panel = document.getElementById('per-panel-' + m);
    if (panel) panel.classList.toggle('bwm-per-panel--active', m === mode);
  });
}

// 渲染"多图分别水印"的图片行列表
function renderPerMultiList() {
  var container = document.getElementById('perMultiList');
  var store = imageStore.perMulti;
  if (!store.length) {
    container.innerHTML = '<div class="bwm-text-caption bwm-text-muted" style="padding:12px 0;">请先选择图片</div>';
    return;
  }
  var html = '';
  store.forEach(function (item, idx) {
    html += '<div class="bwm-per-row" data-idx="' + idx + '">';
    html += '<img class="bwm-per-row-thumb" src="' + item.dataUrl + '" onclick="openLightbox(\'' + item.dataUrl + '\')" alt="">';
    html += '<div class="bwm-per-row-info">';
    html += '<div class="bwm-per-row-filename">' + escapeHtml(item.file.name) + '</div>';
    html += '<input type="text" class="bwm-per-row-input" placeholder="输入该图片的水印文本" data-idx="' + idx + '">';
    html += '</div>';
    html += '<button class="bwm-per-row-remove" onclick="removePerMultiItem(' + idx + ')" title="移除">✖</button>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function removePerMultiItem(idx) {
  imageStore.perMulti.splice(idx, 1);
  renderPerMultiList();
  // 同时更新缩略图网格（如果有）
  var grid = document.getElementById('embedPreview-perMulti');
  if (grid) renderThumbs('perMulti');
}

async function submitPerMulti() {
  var files = getFilesFromStore('perMulti');
  var password = document.getElementById('perMultiPwd').value.trim();
  var btn = document.getElementById('perMultiBtn');
  if (!files.length) { showToast('请选择图片', 'error'); return; }

  // 收集每个图片对应的水印文本
  var texts = [];
  var inputEls = document.querySelectorAll('#perMultiList .bwm-per-row-input');
  var allValid = true;
  inputEls.forEach(function (el) {
    var val = el.value.trim();
    if (!val) { allValid = false; }
    texts.push(val);
  });
  if (!allValid) { showToast('每张图片的水印文本不能为空', 'error'); return; }

  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('perMultiResult');
  resultDiv.innerHTML = '';
  var controller = startCancelableProcess('perMultiResult');
  var signal = controller.signal;
  var allResults = []; var zipData = []; var cancelled = false;

  var fd = new FormData();
  files.forEach(function (f) { fd.append('files', f); });
  fd.append('texts', JSON.stringify(texts));
  fd.append('password', password);

  try {
    var resp = await fetch('/api/watermark/embed/multi-text', {
      method: 'POST',
      body: fd,
      signal: signal,
    });
    if (!resp.ok) {
      var errMsg = '处理失败';
      try { var errData = await resp.json(); errMsg = errData.detail || errMsg; } catch (e2) {}
      throw new Error(errMsg);
    }
    var data = await resp.json();
    allResults = data.items;
    data.items.forEach(function (r) {
      if (r.success) {
        zipData.push({ base64Data: r.image_data, filename: r.output_name });
        // 保存到历史队列
        try {
          var bs = atob(r.image_data.split(',')[1]), mt = r.image_data.split(',')[0].match(/:(.*?);/)[1];
          var ab = new ArrayBuffer(bs.length), ia = new Uint8Array(ab);
          for (var j = 0; j < bs.length; j++) ia[j] = bs.charCodeAt(j);
          addHistory({ original_name: r.file_name, output_name: r.output_name, watermark_text: r.watermark_text, has_password: !!password, wm_length: r.wm_length || 0, image_blob: new Blob([ab], { type: mt }) });
        } catch (e) { console.warn('历史保存失败', e); }
      }
    });
  } catch (e) {
    if (!isAbortError(e)) { showToast(e.message, 'error'); }
    cancelled = isAbortError(e);
  }

  cleanupActiveProcess();
  if (cancelled) { resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return; }

  var ok = allResults.filter(function (r) { return r.success; }).length;
  var fail = allResults.filter(function (r) { return !r.success; }).length;
  if (fail > 0) {
    allResults.forEach(function (r) { if (!r.success) showToast(r.file_name + ': ' + r.error, 'error'); });
  }
  var html = '<div class="bwm-alert ' + (fail ? 'bwm-alert--warning' : 'bwm-alert--success') + '">完成！成功 ' + ok + '/' + allResults.length + (fail ? '，失败 ' + fail : '') + '</div><ul class="bwm-result-list">';
  allResults.forEach(function (r) {
    html += '<li class="bwm-result-item ' + (r.success ? 'bwm-result-item--success' : 'bwm-result-item--error') + '">';
    html += '<span>' + (r.success ? '✅' : '❌') + '</span><div style="min-width:0;flex:1"><div class="bwm-embed-filename">' + escapeHtml(r.file_name) + '</div>' + (r.success ? '<div class="bwm-embed-outname">' + escapeHtml(r.watermark_text) + ' → ' + escapeHtml(r.output_name) + '</div>' : '<div class="bwm-embed-error">' + escapeHtml(r.error || '') + '</div>') + '</div>';
    if (r.success) html += '<button class="bwm-btn bwm-btn--sm" onclick="downloadFromBase64(\'' + r.image_data + '\',\'' + escapeHtml(r.output_name) + '\')">⬇</button>';
    html += '</li>';
  });
  html += '</ul>';
  if (zipData.length > 1) {
    html += '<div class="bwm-mt-3"><button class="bwm-btn bwm-btn--solid" onclick=\'downloadAsZip(' + JSON.stringify(zipData) + ',"per_multi_watermarked.zip")\'>📦 批量下载 ZIP</button></div>';
  }
  resultDiv.innerHTML = html;
  if (fail === 0) showToast('全部处理成功！', 'success'); else showToast(fail + ' 张失败', 'warning');
  setLoading(btn, false);
}

// 一图多水印 - 动态 input 管理
var perOneMultiTexts = ['', ''];  // 初始 2 个空文本

function renderPerOneMultiInputs() {
  var container = document.getElementById('perOneMultiInputs');
  if (!container) return;
  var html = '';
  for (var i = 0; i < perOneMultiTexts.length; i++) {
    html += '<div class="bwm-per-multi-row">';
    html += '<span class="bwm-per-multi-label">水印 ' + (i + 1) + '</span>';
    html += '<input type="text" class="bwm-per-multi-input" data-wmidx="' + i + '" value="' + escapeHtml(perOneMultiTexts[i]) + '" placeholder="输入水印文本">';
    html += '<button class="bwm-per-multi-del" onclick="removePerOneMultiInput(' + i + ')" title="删除此水印">✖</button>';
    html += '</div>';
  }
  container.innerHTML = html;
  // 重新绑定 input 事件，实时同步到数组
  container.querySelectorAll('.bwm-per-multi-input').forEach(function (el) {
    el.addEventListener('input', function () {
      var idx = parseInt(this.dataset.wmidx);
      if (!isNaN(idx) && idx < perOneMultiTexts.length) {
        perOneMultiTexts[idx] = this.value;
      }
    });
  });
}

function addPerOneMultiInput() {
  perOneMultiTexts.push('');
  renderPerOneMultiInputs();
}

function removePerOneMultiInput(idx) {
  if (perOneMultiTexts.length <= 1) { showToast('至少保留一个水印', 'warning'); return; }
  perOneMultiTexts.splice(idx, 1);
  renderPerOneMultiInputs();
}

async function submitPerOneMulti() {
  var files = getFilesFromStore('perOneMulti');
  var password = document.getElementById('perOneMultiPwd').value.trim();
  var btn = document.querySelector('[data-action="submitPerOneMulti"]');
  if (!files.length) { showToast('请选择图片', 'error'); return; }

  // 收集所有水印文本（从数组，比 DOM 更可靠）
  var texts = perOneMultiTexts.map(function (s) { return s.trim(); });
  var allValid = texts.every(function (s) { return s.length > 0; });
  if (!allValid) { showToast('水印文本不能为空', 'error'); return; }
  if (!texts.length) { showToast('请至少添加一个水印文本', 'error'); return; }

  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('perOneMultiResult');
  resultDiv.innerHTML = '';
  var controller = startCancelableProcess('perOneMultiResult');
  var signal = controller.signal;
  var allResults = []; var zipData = []; var cancelled = false;

  var fd = new FormData();
  fd.append('file', files[0]);
  fd.append('texts', JSON.stringify(texts));
  fd.append('password', password);

  try {
    var resp = await fetch('/api/watermark/embed/one-to-multi', {
      method: 'POST',
      body: fd,
      signal: signal,
    });
    if (!resp.ok) {
      var errMsg = '处理失败';
      try { var errData = await resp.json(); errMsg = errData.detail || errMsg; } catch (e2) {}
      throw new Error(errMsg);
    }
    var data = await resp.json();
    allResults = data.items;
    data.items.forEach(function (r) {
      if (r.success) {
        zipData.push({ base64Data: r.image_data, filename: r.output_name });
        // 保存到历史队列
        try {
          var bs = atob(r.image_data.split(',')[1]), mt = r.image_data.split(',')[0].match(/:(.*?);/)[1];
          var ab = new ArrayBuffer(bs.length), ia = new Uint8Array(ab);
          for (var j = 0; j < bs.length; j++) ia[j] = bs.charCodeAt(j);
          addHistory({ original_name: r.file_name, output_name: r.output_name, watermark_text: r.watermark_text, has_password: !!password, wm_length: r.wm_length || 0, image_blob: new Blob([ab], { type: mt }) });
        } catch (e) { console.warn('历史保存失败', e); }
      }
    });
  } catch (e) {
    if (!isAbortError(e)) { showToast(e.message, 'error'); }
    cancelled = isAbortError(e);
  }

  cleanupActiveProcess();
  if (cancelled) { resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return; }

  var ok = allResults.filter(function (r) { return r.success; }).length;
  var fail = allResults.filter(function (r) { return !r.success; }).length;
  if (fail > 0) {
    allResults.forEach(function (r) { if (!r.success) showToast(r.watermark_text + ': ' + r.error, 'error'); });
  }
  var html = '<div class="bwm-alert ' + (fail ? 'bwm-alert--warning' : 'bwm-alert--success') + '">完成！成功 ' + ok + '/' + allResults.length + (fail ? '，失败 ' + fail : '') + '</div><ul class="bwm-result-list">';
  allResults.forEach(function (r) {
    html += '<li class="bwm-result-item ' + (r.success ? 'bwm-result-item--success' : 'bwm-result-item--error') + '">';
    html += '<span>' + (r.success ? '✅' : '❌') + '</span><div style="min-width:0;flex:1"><div class="bwm-embed-filename">' + escapeHtml(r.watermark_text) + '</div>' + (r.success ? '<div class="bwm-embed-outname">' + escapeHtml(r.output_name) + '</div>' : '<div class="bwm-embed-error">' + escapeHtml(r.error || '') + '</div>') + '</div>';
    if (r.success) html += '<button class="bwm-btn bwm-btn--sm" onclick="downloadFromBase64(\'' + r.image_data + '\',\'' + escapeHtml(r.output_name) + '\')">⬇</button>';
    html += '</li>';
  });
  html += '</ul>';
  if (zipData.length > 1) {
    html += '<div class="bwm-mt-3"><button class="bwm-btn bwm-btn--solid" onclick=\'downloadAsZip(' + JSON.stringify(zipData) + ',"one_multi_watermarked.zip")\'>📦 批量下载 ZIP</button></div>';
  }
  resultDiv.innerHTML = html;
  if (fail === 0) showToast('全部处理成功！', 'success'); else showToast(fail + ' 个失败', 'warning');
  setLoading(btn, false);
}

// ══════════════════════════════════════════════════════
//  Timeout & Cancel helpers
// ══════════════════════════════════════════════════════

var activeState = null;

function startCancelableProcess(resultDivId) {
  cleanupActiveProcess();
  var controller = new AbortController();
  var resultDiv = document.getElementById(resultDivId);
  var cancelBar = document.createElement('div');
  cancelBar.id = 'cancelBar-' + Date.now();
  cancelBar.className = 'bwm-cancel-bar';
  cancelBar.style.display = 'none';
  cancelBar.innerHTML = '<span>若觉得出现异常可提前终止</span><button class="bwm-btn bwm-btn--sm bwm-btn--danger" id="cancelProcessBtn">提前终止</button>';
  resultDiv.parentNode.appendChild(cancelBar);
  // 2 分钟后才显示终止按钮
  var timeoutId = setTimeout(function () { cancelBar.style.display = 'flex'; }, 120000);
  document.getElementById('cancelProcessBtn').onclick = function () {
    controller.abort();
    cancelBar.innerHTML = '<span>正在取消...</span>';
    clearTimeout(timeoutId);
  };
  activeState = { controller: controller, timeoutId: timeoutId, cancelBar: cancelBar };
  return controller;
}

function cleanupActiveProcess() {
  if (activeState) {
    clearTimeout(activeState.timeoutId);
    if (activeState.cancelBar && activeState.cancelBar.parentNode) activeState.cancelBar.remove();
    activeState = null;
  }
}

function isAbortError(e) {
  return e && (e.name === 'AbortError' || e.code === 20);
}

// ══════════════════════════════════════════════════════
//  Tab switching
// ══════════════════════════════════════════════════════

function switchTab(tabId) {
  document.querySelectorAll('.bwm-tab').forEach(function (b) {
    b.classList.toggle('bwm-tab--active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.bwm-tab-content').forEach(function (c) {
    c.classList.toggle('bwm-tab-content--active', c.id === 'tab-' + tabId);
  });
  if (tabId === 'history') loadHistory(1);
}

// ══════════════════════════════════════════════════════
//  Embed (single & batch)
// ══════════════════════════════════════════════════════

async function submitEmbedSingle() {
  // 只有 store 中的图片（本地文件/粘贴），嵌入模式无网络图片
  var files = getFilesFromStore('embedSingle');
  var text = document.getElementById('embedTextSingle').value.trim();
  var password = document.getElementById('embedPwdSingle').value.trim();
  var btn = document.getElementById('embedBtnSingle');
  if (!text) { showToast('请输入水印文本', 'error'); return; }
  if (!files.length) { showToast('请选择图片', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('embedResultSingle');
  resultDiv.innerHTML = '';
  var controller = startCancelableProcess('embedResultSingle');
  var signal = controller.signal;
  var allResults = []; var zipData = []; var cancelled = false;
  for (var i = 0; i < files.length; i++) {
    if (signal.aborted) { cancelled = true; break; }
    var fd = new FormData();
    fd.append('text', text);
    fd.append('password', password);
    fd.append('file', files[i]);
    try {
      var resp = await fetch('/api/watermark/embed', { method: 'POST', body: fd, signal: signal });
      if (!resp.ok) {
        var errMsg = '失败';
        try { var errData = await resp.json(); errMsg = errData.detail || errData.text || errMsg; } catch (e2) { errMsg = resp.status + ' ' + resp.statusText; }
        throw new Error(errMsg);
      }
      var data = await resp.json();
      try {
        var bs = atob(data.image_data.split(',')[1]), mt = data.image_data.split(',')[0].match(/:(.*?);/)[1];
        var ab = new ArrayBuffer(bs.length), ia = new Uint8Array(ab);
        for (var j = 0; j < bs.length; j++) ia[j] = bs.charCodeAt(j);
        await addHistory({ original_name: files[i].name, output_name: data.output_name, watermark_text: text, has_password: data.has_password, wm_length: data.wm_length, image_blob: new Blob([ab], { type: mt }) });
      } catch (e) { console.warn('历史保存失败', e); }
      zipData.push({ base64Data: data.image_data, filename: data.output_name });
      allResults.push({ file_name: files[i].name, success: true, output_name: data.output_name, image_data: data.image_data });
    } catch (e) {
      if (isAbortError(e)) { cancelled = true; break; }
      allResults.push({ file_name: files[i].name, success: false, error: e.message });
    }
  }
  cleanupActiveProcess();
  if (cancelled) { resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return; }
  var ok = allResults.filter(function (r) { return r.success; }).length;
  var fail = allResults.filter(function (r) { return !r.success; }).length;
  if (fail > 0) {
    allResults.forEach(function (r) { if (!r.success) showToast(r.file_name + ': ' + r.error, 'error'); });
  }
  var html = '<div class="bwm-alert ' + (fail ? 'bwm-alert--warning' : 'bwm-alert--success') + '">完成！成功 ' + ok + '/' + allResults.length + (fail ? '，失败 ' + fail : '') + '</div><ul class="bwm-result-list">';
  allResults.forEach(function (r) {
    html += '<li class="bwm-result-item ' + (r.success ? 'bwm-result-item--success' : 'bwm-result-item--error') + '">';
    html += '<span>' + (r.success ? '✅' : '❌') + '</span><div style="min-width:0;flex:1"><div class="bwm-embed-filename">' + escapeHtml(r.file_name) + '</div>' + (r.success ? '<div class="bwm-embed-outname">' + escapeHtml(r.output_name) + '</div>' : '<div class="bwm-embed-error">' + escapeHtml(r.error || '') + '</div>') + '</div>';
    if (r.success) html += '<button class="bwm-btn bwm-btn--sm" onclick="downloadFromBase64(\'' + r.image_data + '\',\'' + escapeHtml(r.output_name) + '\')">⬇</button>';
    html += '</li>';
  });
  html += '</ul>';
  if (zipData.length > 1) html += '<div class="bwm-mt-3"><button class="bwm-btn bwm-btn--solid" onclick=\'downloadAsZip(' + JSON.stringify(zipData) + ',"watermarked.zip")\'>📦 批量下载 ZIP</button></div>';
  resultDiv.innerHTML = html;
  if (fail === 0) showToast('嵌入成功！', 'success'); else showToast(fail + ' 张失败', 'warning');
  setLoading(btn, false);
}

async function submitEmbedBatch() {
  // batch embed 无网络图片模式，只走 store
  document.getElementById('embedTextBatch').value = document.getElementById('embedTextBatch').value;
  document.getElementById('embedBtnBatch').dataset.originalText = document.getElementById('embedBtnBatch').innerHTML;
  var text = document.getElementById('embedTextBatch').value.trim();
  var password = document.getElementById('embedPwdBatch').value.trim();
  var files = getFilesFromStore('embedBatch');
  var btn = document.getElementById('embedBtnBatch');
  if (!text) { showToast('请输入水印文本', 'error'); return; }
  if (!files.length) { showToast('请选择图片', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('embedResultBatch');
  resultDiv.innerHTML = '';
  var controller = startCancelableProcess('embedResultBatch');
  var signal = controller.signal;
  var allResults = []; var zipData = []; var cancelled = false;
  for (var i = 0; i < files.length; i++) {
    if (signal.aborted) { cancelled = true; break; }
    var fd = new FormData();
    fd.append('text', text);
    fd.append('password', password);
    fd.append('file', files[i]);
    try {
      var resp = await fetch('/api/watermark/embed', { method: 'POST', body: fd, signal: signal });
      if (!resp.ok) {
        var errMsg = '处理失败';
        try { var errData = await resp.json(); errMsg = errData.detail || errData.error || errMsg; } catch (e2) {}
        throw new Error(errMsg);
      }
      var data = await resp.json();
      try {
        var bs = atob(data.image_data.split(',')[1]), mt = data.image_data.split(',')[0].match(/:(.*?);/)[1];
        var ab = new ArrayBuffer(bs.length), ia = new Uint8Array(ab);
        for (var j = 0; j < bs.length; j++) ia[j] = bs.charCodeAt(j);
        await addHistory({ original_name: files[i].name, output_name: data.output_name, watermark_text: text, has_password: data.has_password, wm_length: data.wm_length, image_blob: new Blob([ab], { type: mt }) });
      } catch (e) { console.warn('历史保存失败', e); }
      zipData.push({ base64Data: data.image_data, filename: data.output_name });
      allResults.push({ file_name: files[i].name, success: true, output_name: data.output_name, image_data: data.image_data });
    } catch (e) {
      if (isAbortError(e)) { cancelled = true; break; }
      allResults.push({ file_name: files[i].name, success: false, error: e.message });
    }
  }
  cleanupActiveProcess();
  if (cancelled) { resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return; }
  var ok = allResults.filter(function (r) { return r.success; }).length;
  var fail = allResults.filter(function (r) { return !r.success; }).length;
  if (fail > 0) {
    allResults.forEach(function (r) { if (!r.success) showToast(r.file_name + ': ' + r.error, 'error'); });
  }
  var html = '<div class="bwm-alert ' + (fail ? 'bwm-alert--warning' : 'bwm-alert--success') + '">完成！成功 ' + ok + '/' + allResults.length + (fail ? '，失败 ' + fail : '') + '</div><ul class="bwm-result-list">';
  allResults.forEach(function (r) {
    html += '<li class="bwm-result-item ' + (r.success ? 'bwm-result-item--success' : 'bwm-result-item--error') + '">';
    html += '<span>' + (r.success ? '✅' : '❌') + '</span><div style="min-width:0;flex:1"><div class="bwm-embed-filename">' + escapeHtml(r.file_name) + '</div>' + (r.success ? '<div class="bwm-embed-outname">' + escapeHtml(r.output_name) + '</div>' : '<div class="bwm-embed-error">' + escapeHtml(r.error || '') + '</div>') + '</div>';
    if (r.success) html += '<button class="bwm-btn bwm-btn--sm" onclick="downloadFromBase64(\'' + r.image_data + '\',\'' + escapeHtml(r.output_name) + '\')">⬇</button>';
    html += '</li>';
  });
  html += '</ul>';
  if (zipData.length > 1) html += '<div class="bwm-mt-3"><button class="bwm-btn bwm-btn--solid" onclick=\'downloadAsZip(' + JSON.stringify(zipData) + ',"watermarked_batch.zip")\'>📦 批量下载 ZIP</button></div>';
  resultDiv.innerHTML = html;
  if (fail === 0) showToast('批量嵌入全部成功！', 'success'); else showToast(fail + ' 张失败', 'warning');
  setLoading(btn, false);
}

// ══════════════════════════════════════════════════════
//  Extract (single & batch)
// ══════════════════════════════════════════════════════

async function submitExtractSingle() {
  // 优先使用 store 中的图片（本地文件/粘贴），其次才是 URL
  var files = getFilesFromStore('extractSingle');
  var urls = getUrlsFromArea('extractSingle');
  if (!files.length && !urls.length) { showToast('请选择图片或输入图片 URL', 'error'); return; }
  // 有 store 图片就用图片，没有才走 URL
  if (!files.length && urls.length) { await submitExtractSingleFromUrl(); return; }
  var password = document.getElementById('extractPwdSingle').value.trim();
  var btn = document.getElementById('extractBtnSingle');
  if (!files.length) { showToast('请选择图片', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('extractResultSingle');
  resultDiv.innerHTML = '';
  var debugPanel = getDebugPanel('extractSingle');
  if (debugPanel) {
    debugPanel.innerHTML = '';
    debugPanel.style.display = 'block';
    document.getElementById('toggleDebugBtn').textContent = '隐藏调试';
    document.getElementById('toggleDebugBtn').style.opacity = '1';
  }
  debugLog(debugPanel, '🚀 开始提取盲水印...', 'bwm-dlog-ok');
  startServerLogPolling(debugPanel, 1500);
  var controller = startCancelableProcess('extractResultSingle');
  var signal = controller.signal;
  var results = []; var cancelled = false;
  for (var i = 0; i < files.length; i++) {
    if (signal.aborted) { cancelled = true; break; }
    var fd = new FormData();
    fd.append('password', password);
    fd.append('file', files[i]);
    try {
      var resp = await fetch('/api/watermark/extract', { method: 'POST', body: fd, signal: signal });
      if (!resp.ok) {
        var errMsg = '失败';
        try { var errData = await resp.json(); errMsg = errData.detail || errData.text || errMsg; } catch (e) { errMsg = resp.status + ' ' + resp.statusText; }
        throw new Error(errMsg);
      }
      var data = await resp.json();
      results.push({ file_name: files[i].name, text: data.text, success: data.success });
    } catch (e) {
      if (isAbortError(e)) { cancelled = true; break; }
      results.push({ file_name: files[i].name, text: e.message, success: false });
    }
  }
  stopServerLogPolling();
  cleanupActiveProcess();
  if (cancelled) {
    debugLog(debugPanel, '⛔ 处理已取消', 'bwm-dlog-warn');
    resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return;
  }
  debugLog(debugPanel, '✅ 提取完成！正在整理结果...', 'bwm-dlog-ok');
  var html = '<ul class="bwm-result-list">';
  results.forEach(function (r) {
    var icon = r.success ? '✅' : (r.text.indexOf('密码') >= 0 ? '🔑' : '❌');
    if (!r.success) showToast(r.file_name + ': ' + r.text, 'error');
    html += '<li class="bwm-result-item ' + (r.success ? 'bwm-result-item--success' : 'bwm-result-item--error') + '">' + icon + ' <div style="min-width:0;flex:1"><div class="bwm-extract-filename">' + escapeHtml(r.file_name) + '</div><div class="bwm-extract-text">' + escapeHtml(r.text) + '</div></div></li>';
  });
  html += '</ul>';
  resultDiv.innerHTML = html;
  setLoading(btn, false);
}

async function submitExtractBatch() {
  // 路由到 URL 模式（仅当无本地/粘贴图片时）
  var files = getFilesFromStore('extractBatch');
  var urls = getUrlsFromArea('extractBatch');
  if (!files.length && !urls.length) { showToast('请选择图片或输入图片 URL', 'error'); return; }
  // 如果只有 URL，走纯 URL 路径
  if (!files.length && urls.length) { await submitExtractBatchFromUrl(); return; }

  var password = document.getElementById('extractPwdBatch').value.trim();
  var btn = document.getElementById('extractBtnBatch');
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('extractResultBatch');
  resultDiv.innerHTML = '';
  var debugPanel = getDebugPanel('extractBatch');
  if (debugPanel) { debugPanel.innerHTML = ''; debugPanel.style.display = 'block';
    document.getElementById('toggleDebugBtn').textContent = '隐藏调试';
    document.getElementById('toggleDebugBtn').style.opacity = '1';
  }
  debugLog(debugPanel, '🚀 开始批量提取盲水印...', 'bwm-dlog-ok');
  startServerLogPolling(debugPanel, 2000);
  var controller = startCancelableProcess('extractResultBatch');
  var signal = controller.signal;
  var results = []; var cancelled = false;

  // 第一步：处理本地/粘贴文件
  for (var i = 0; i < files.length; i++) {
    if (signal.aborted) { cancelled = true; break; }
    var fd = new FormData();
    fd.append('password', password);
    fd.append('file', files[i]);
    try {
      var resp = await fetch('/api/watermark/extract', { method: 'POST', body: fd, signal: signal });
      if (!resp.ok) {
        var errMsg = '失败';
        try { var errData = await resp.json(); errMsg = errData.detail || errData.text || errMsg; } catch (e) { errMsg = resp.status + ' ' + resp.statusText; }
        throw new Error(errMsg);
      }
      var data = await resp.json();
      results.push({ file_name: files[i].name, text: data.text, success: data.success });
    } catch (e) {
      if (isAbortError(e)) { cancelled = true; break; }
      results.push({ file_name: files[i].name, text: e.message, success: false });
    }
  }

  // 第二步：如果还有 URL，继续处理
  if (!cancelled && urls.length) {
    for (var k = 0; k < urls.length; k++) {
      if (signal.aborted) { cancelled = true; break; }
      try {
        var resp2 = await fetch('/api/watermark/extract/from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[k], password: password }),
          signal: signal,
        });
        if (!resp2.ok) {
          var errMsg2 = '失败';
          try { var errData2 = await resp2.json(); errMsg2 = errData2.detail || errMsg2; } catch (e) { errMsg2 = resp2.status + ' ' + resp2.statusText; }
          throw new Error(errMsg2);
        }
        var data2 = await resp2.json();
        results.push({ file_name: urls[k], text: data2.text, success: data2.success });
      } catch (e) {
        if (isAbortError(e)) { cancelled = true; break; }
        results.push({ file_name: urls[k], text: e.message, success: false });
      }
    }
  }

  stopServerLogPolling();
  cleanupActiveProcess();
  if (cancelled) {
    debugLog(debugPanel, '⛔ 处理已取消', 'bwm-dlog-warn');
    resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return;
  }
  debugLog(debugPanel, '✅ 批量提取完成！正在整理结果...', 'bwm-dlog-ok');
  var html = '<ul class="bwm-result-list">';
  results.forEach(function (r) {
    var icon = r.success ? '✅' : (r.text.indexOf('密码') >= 0 ? '🔑' : '❌');
    if (!r.success) showToast(r.file_name + ': ' + r.text, 'error');
    html += '<li class="bwm-result-item ' + (r.success ? 'bwm-result-item--success' : 'bwm-result-item--error') + '">' + icon + ' <div style="min-width:0;flex:1"><div class="bwm-extract-filename">' + escapeHtml(r.file_name) + '</div><div class="bwm-extract-text">' + escapeHtml(r.text) + '</div></div></li>';
  });
  html += '</ul>';
  resultDiv.innerHTML = html;
  setLoading(btn, false);
}

// ══════════════════════════════════════════════════════
//  History
// ══════════════════════════════════════════════════════

var currentHistoryPage = 1;

async function loadHistory(page) {
  if (page) currentHistoryPage = page;
  var kw = document.getElementById('historySearch').value;
  try {
    var result = await searchHistory(kw, currentHistoryPage, 20);
    renderHistoryTable(result);
    updateStorageInfo();
  } catch (e) { console.warn(e); }
}

function renderHistoryTable(result) {
  var tbody = document.getElementById('historyTableBody');
  if (!result.items || !result.items.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="bwm-text-center bwm-text-muted" style="padding:24px;">暂无历史记录</td></tr>';
    document.getElementById('historyPagination').innerHTML = '';
    return;
  }
  tbody.innerHTML = result.items.map(function (item) {
    var thumb = item.thumbnail_url ? '<img src="' + item.thumbnail_url + '" class="bwm-thumb" alt="">' : '<span class="bwm-text-muted">无</span>';
    var time = new Date(item.created_at).toLocaleString('zh-CN');
    return '<tr><td>' + thumb + '</td><td class="bwm-truncate" style="max-width:160px;">' + escapeHtml(item.original_name) + '</td><td class="bwm-truncate" style="max-width:160px;">' + escapeHtml(item.watermark_text || '-') + '</td><td>' + time + '</td><td><div class="bwm-action-group"><button class="bwm-btn bwm-btn--sm" onclick="downloadFromHistory(' + item.id + ',\'' + escapeHtml(item.output_name) + '\')" title="下载">⬇</button><button class="bwm-btn bwm-btn--sm bwm-btn--danger" onclick="confirmDeleteHistory(' + item.id + ')" title="删除">✖</button></div></td></tr>';
  }).join('');
  renderPagination(result.total, result.page, result.pageSize);
}

function renderPagination(total, page, pageSize) {
  var tp = Math.ceil(total / pageSize) || 1;
  var div = document.getElementById('historyPagination');
  if (tp <= 1) { div.innerHTML = ''; return; }
  var html = '';
  var s = Math.max(1, page - 2), e = Math.min(tp, page + 2);
  if (page > 1) html += '<button onclick="loadHistory(' + (page - 1) + ')">上一页</button>';
  for (var i = s; i <= e; i++) html += '<button class="' + (i === page ? 'bwm-pagination--active' : '') + '" onclick="loadHistory(' + i + ')">' + i + '</button>';
  if (page < tp) html += '<button onclick="loadHistory(' + (page + 1) + ')">下一页</button>';
  div.innerHTML = html;
}

function confirmDeleteHistory(id) {
  openModal('删除历史记录', '确定删除此历史记录？图片数据也将从本地删除，不可恢复。', '删除', async function () {
    try { await deleteHistory(id); showToast('已删除', 'success'); loadHistory(); } catch (e) { showToast('删除失败', 'error'); }
  });
}

async function clearAllHistory() {
  openModal('清空所有历史', '确定清空所有历史记录？此操作不可恢复，所有本地图片数据将被删除。', '删除', async function () {
    try { await clearAll(); showToast('已清空所有历史', 'success'); loadHistory(1); } catch (e) { showToast('清空失败', 'error'); }
  });
}

async function updateStorageInfo() {
  try { var info = await getStorageInfo(); document.getElementById('storageInfo').textContent = '共 ' + info.count + ' 条记录，占用 ' + info.totalSizeMB + ' MB'; } catch (e) { document.getElementById('storageInfo').textContent = '信息获取失败'; }
}

function resetAll() {
  cleanupActiveProcess();
  for (var key in imageStore) imageStore[key] = [];
  ['embedPreviewSingle', 'extractPreviewSingle', 'embedPreviewBatch', 'extractPreviewBatch', 'perOneMultiPreview'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  ['embedResultSingle', 'extractResultSingle', 'embedResultBatch', 'extractResultBatch', 'perMultiResult', 'perOneMultiResult'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  // 重置粘贴结果
  ['embedSingle', 'extractSingle', 'embedBatch', 'extractBatch', 'perMulti', 'perOneMulti'].forEach(function (area) {
    var pasteResult = document.getElementById('pasteResult-' + area);
    if (pasteResult) { pasteResult.innerHTML = ''; pasteResult.style.display = 'none'; }
    var pasteZone = document.getElementById('pasteZone-' + area);
    if (pasteZone) pasteZone.classList.remove('bwm-paste-zone--pasted');
    var urlInput = document.getElementById('urlInput-' + area);
    if (urlInput) urlInput.value = '';
  });
  // 重置回文件模式
  ['embedSingle', 'extractSingle', 'embedBatch', 'extractBatch', 'perMulti', 'perOneMulti'].forEach(function (area) {
    switchUploadMode(area, 'file');
  });
  // 重置逐张处理相关
  var perMultiList = document.getElementById('perMultiList');
  if (perMultiList) perMultiList.innerHTML = '';
  perOneMultiTexts = ['', ''];
  renderPerOneMultiInputs();
  showToast('工作队列已重置', 'info');
}

function toggleDebugAll() {
  var btn = document.getElementById('toggleDebugBtn');
  var resultIds = ['embedResultSingle', 'extractResultSingle', 'embedResultBatch', 'extractResultBatch'];
  var panels = [];
  resultIds.forEach(function (id) {
    var container = document.getElementById(id);
    if (!container) return;
    var panel = container.parentNode.querySelector('.bwm-debug');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'bwm-debug';
      panel.style.display = 'none';
      container.parentNode.appendChild(panel);
    }
    panels.push(panel);
  });
  if (!panels.length) return;
  var allHidden = panels.every(function (p) { return p.style.display === 'none' || !p.style.display; });
  var show = allHidden;
  panels.forEach(function (p) { p.style.display = show ? 'block' : 'none'; });
  btn.textContent = show ? '隐藏调试' : '显示调试';
  btn.style.opacity = show ? '1' : '0.4';
  // 显示时立即拉取服务器日志
  if (show) {
    panels.forEach(function (p) {
      // 一次性拉取历史
      fetch('/api/watermark/logs').then(function (r) { return r.json(); }).then(function (d) {
        if (d.logs && d.logs.length) {
          d.logs.forEach(function (l) {
            debugLog(p, l, 'bwm-dlog-server');
          });
        }
      }).catch(function () {});
    });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.bwm-tab').forEach(function (b) { b.addEventListener('click', function () { switchTab(this.dataset.tab); }); });
  document.querySelectorAll('[data-action]').forEach(function (b) { b.addEventListener('click', function () { var fn = window[this.dataset.action]; if (typeof fn === 'function') fn(); }); });

  // 注册上传模式切换
  document.querySelectorAll('.bwm-upload-mode-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchUploadMode(this.dataset.area, this.dataset.mode);
    });
  });

  // 注册粘贴事件
  var pasteAreas = ['embedSingle', 'extractSingle', 'embedBatch', 'extractBatch'];
  pasteAreas.forEach(function (area) {
    var pasteZone = document.getElementById('pasteZone-' + area);
    if (pasteZone) {
      pasteZone.addEventListener('paste', function (e) {
        e.preventDefault();
        handlePaste(area)(e);
        // 切换到 paste 模式（如果是其他模式）
        switchUploadMode(area, 'paste');
      });
      // drag-over 视觉反馈
      pasteZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        pasteZone.classList.add('bwm-paste-zone--dragover');
      });
      pasteZone.addEventListener('dragleave', function () {
        pasteZone.classList.remove('bwm-paste-zone--dragover');
      });
    }
  });

  var cfgs = [
    { input: 'embedFileSingle', store: 'embedSingle' },
    { input: 'extractFileSingle', store: 'extractSingle' },
    { input: 'embedFileBatch', store: 'embedBatch' },
    { input: 'extractFileBatch', store: 'extractBatch' },
  ];
  cfgs.forEach(function (cfg) {
    var el = document.getElementById(cfg.input);
    if (!el) return;
    el.addEventListener('change', function () {
      for (var i = 0; i < this.files.length; i++) {
        if (this.files[i].size > 10 * 1024 * 1024) { showToast('文件超过 10MB 限制', 'error'); this.value = ''; return; }
        var ext = '.' + this.files[i].name.split('.').pop().toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].indexOf(ext) < 0) { showToast('不支持 ' + ext + ' 格式', 'error'); this.value = ''; return; }
      }
      handleFileInput(cfg.input, cfg.store);
    });
  });

  // 逐张处理 - 子模式切换
  document.querySelectorAll('.bwm-per-submode-btn').forEach(function (b) {
    b.addEventListener('click', function () { switchPerSubMode(this.dataset.permode); });
  });

  // 逐张处理 - 文件输入事件（多图分别水印）
  var perMultiFile = document.getElementById('perMultiFile');
  if (perMultiFile) {
    perMultiFile.addEventListener('change', function () {
      for (var i = 0; i < this.files.length; i++) {
        if (this.files[i].size > 10 * 1024 * 1024) { showToast('文件超过 10MB 限制', 'error'); this.value = ''; return; }
        var ext = '.' + this.files[i].name.split('.').pop().toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].indexOf(ext) < 0) { showToast('不支持 ' + ext + ' 格式', 'error'); this.value = ''; return; }
      }
      handleFileInput('perMultiFile', 'perMulti');
      renderPerMultiList();
    });
  }

  // 逐张处理 - 文件输入事件（一图多水印）
  var perOneMultiFile = document.getElementById('perOneMultiFile');
  if (perOneMultiFile) {
    perOneMultiFile.addEventListener('change', function () {
      if (this.files.length > 0) {
        if (this.files[0].size > 10 * 1024 * 1024) { showToast('文件超过 10MB 限制', 'error'); this.value = ''; return; }
        var ext = '.' + this.files[0].name.split('.').pop().toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].indexOf(ext) < 0) { showToast('不支持 ' + ext + ' 格式', 'error'); this.value = ''; return; }
      }
      handleFileInput('perOneMultiFile', 'perOneMulti');
    });
  }

  // 逐张处理 - 粘贴事件
  ['perMulti', 'perOneMulti'].forEach(function (area) {
    var pasteZone = document.getElementById('pasteZone-' + area);
    if (pasteZone) {
      pasteZone.addEventListener('paste', function (e) {
        e.preventDefault();
        handlePaste(area)(e);
        switchUploadMode(area, 'paste');
        if (area === 'perMulti') renderPerMultiList();
      });
      pasteZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        pasteZone.classList.add('bwm-paste-zone--dragover');
      });
      pasteZone.addEventListener('dragleave', function () {
        pasteZone.classList.remove('bwm-paste-zone--dragover');
      });
    }
  });

  // 逐张处理 - 一图多水印初始化（默认 2 个输入框）
  renderPerOneMultiInputs();

  // 逐张处理 - 添加水印按钮
  var addBtn = document.getElementById('perOneMultiAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      addPerOneMultiInput();
    });
  }
});
