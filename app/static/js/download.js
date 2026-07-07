/**
 * 浏览器端下载工具。
 *
 * 原则：所有文件操作在浏览器端完成，不请求服务器。
 * - 单文件下载：基于 base64 或 Blob
 * - 批量下载：使用 JSZip 在浏览器端打包
 */

/**
 * 从 base64 数据 URI 下载单张图片。
 * @param {string} base64Data - data:image/...;base64,...
 * @param {string} filename
 */
function downloadFromBase64(base64Data, filename) {
    if (!base64Data || !base64Data.includes(',')) return;

    const byteString = atob(base64Data.split(',')[1]);
    const mimeType = base64Data.split(',')[0].match(/:(.*?);/)[1];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 从 IndexedDB 读取 Blob 后下载。
 * @param {number} id - 历史记录 ID
 * @param {string} filename
 */
async function downloadFromHistory(id, filename) {
    const blob = await getImageBlob(id);
    if (!blob) {
        showToast('历史记录中未找到图片数据', 'error');
        return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 批量下载为 ZIP（浏览器端打包）。
 * @param {Array} items - [{ base64Data, filename }]
 * @param {string} zipName
 */
async function downloadAsZip(items, zipName = 'watermarked_images.zip') {
    if (!window.JSZip) {
        showToast('JSZip 库未加载，请检查网络', 'error');
        return;
    }

    const zip = new JSZip();
    for (const item of items) {
        try {
            const byteString = atob(item.base64Data.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            zip.file(item.filename, ab, { binary: true });
        } catch (e) {
            console.warn('打包文件失败:', item.filename, e);
        }
    }

    const content = await zip.generateAsync({ type: 'blob' });

    if (window.saveAs) {
        saveAs(content, zipName);
    } else {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
