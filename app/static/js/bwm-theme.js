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
};

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

function debugLog(panel, msg) {
  if (!panel) return;
  var time = new Date().toLocaleTimeString();
  var line = document.createElement('div');
  line.textContent = '[' + time + '] ' + msg;
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
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
  };
  var grid = document.getElementById(map[storeName]);
  var store = imageStore[storeName];
  if (store.length === 0) {
    grid.innerHTML = '';
    return;
  }
  // 在文件选择按钮旁显示提示文字
  var inputId = storeName === 'embedSingle' ? 'embedFileSingle' : storeName === 'extractSingle' ? 'extractFileSingle' : storeName === 'embedBatch' ? 'embedFileBatch' : 'extractFileBatch';
  var input = document.getElementById(inputId);
  if (input && !input.parentNode.querySelector('.bwm-file-hint')) {
    var hint = document.createElement('span');
    hint.className = 'bwm-file-hint';
    hint.textContent = '已检测到图片，预览若为空不影响使用';
    input.parentNode.insertBefore(hint, input.nextSibling);
  }
  // 清空预览后移除提示
  if (input && store.length === 0) {
    var old = input.parentNode.querySelector('.bwm-file-hint');
    if (old) old.remove();
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
}

function getFilesFromStore(storeName) {
  return imageStore[storeName].map(function (item) { return item.file; });
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
  // 所有处理默认立即显示终止按钮
  cancelBar.style.display = 'flex';
  var timeoutId = setTimeout(function () {
    // 2 分钟后仅作为提醒，按钮一直可用
  }, 120000);
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
  var text = document.getElementById('embedTextSingle').value.trim();
  var password = document.getElementById('embedPwdSingle').value.trim();
  var files = getFilesFromStore('embedSingle');
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
  var password = document.getElementById('extractPwdSingle').value.trim();
  var files = getFilesFromStore('extractSingle');
  var btn = document.getElementById('extractBtnSingle');
  if (!files.length) { showToast('请选择图片', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('extractResultSingle');
  resultDiv.innerHTML = '';
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
  cleanupActiveProcess();
  if (cancelled) { resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return; }
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
  var password = document.getElementById('extractPwdBatch').value.trim();
  var files = getFilesFromStore('extractBatch');
  var btn = document.getElementById('extractBtnBatch');
  if (!files.length) { showToast('请选择图片', 'error'); return; }
  setLoading(btn, true);
  cleanupActiveProcess();
  var resultDiv = document.getElementById('extractResultBatch');
  resultDiv.innerHTML = '';
  var controller = startCancelableProcess('extractResultBatch');
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
  cleanupActiveProcess();
  if (cancelled) { resultDiv.innerHTML = '<div class="bwm-alert bwm-alert--warning">处理已取消</div>'; setLoading(btn, false); return; }
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
  ['embedPreviewSingle', 'extractPreviewSingle', 'embedPreviewBatch', 'extractPreviewBatch'].forEach(function (id) {
    document.getElementById(id).innerHTML = '';
  });
  ['embedResultSingle', 'extractResultSingle', 'embedResultBatch', 'extractResultBatch'].forEach(function (id) {
    document.getElementById(id).innerHTML = '';
  });
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
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.bwm-tab').forEach(function (b) { b.addEventListener('click', function () { switchTab(this.dataset.tab); }); });
  document.querySelectorAll('[data-action]').forEach(function (b) { b.addEventListener('click', function () { var fn = window[this.dataset.action]; if (typeof fn === 'function') fn(); }); });
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
});
