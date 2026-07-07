/**
 * IndexedDB 封装 — 浏览器端历史记录存储。
 *
 * 数据库结构：
 *   数据库名: BlindWatermarkHistory
 *   对象存储: historyItems
 *     每条记录:
 *       id:            自增 (autoIncrement)
 *       original_name: string
 *       output_name:   string
 *       watermark_text: string (嵌入操作)
 *       has_password:  boolean
 *       image_blob:    Blob (图片二进制数据)
 *       wm_length:     number
 *       created_at:    string (ISO datetime)
 */

const DB_NAME = 'BlindWatermarkHistory';
const STORE_NAME = 'historyItems';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('original_name', 'original_name', { unique: false });
                store.createIndex('watermark_text', 'watermark_text', { unique: false });
                store.createIndex('created_at', 'created_at', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 添加一条历史记录。
 * @param {Object} item
 * @param {string} item.original_name
 * @param {string} item.output_name
 * @param {string} item.watermark_text
 * @param {boolean} item.has_password
 * @param {Blob} item.image_blob
 * @param {number} item.wm_length
 * @returns {Promise<number>} 新记录 id
 */
async function addHistory(item) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
        ...item,
        created_at: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 查询历史记录（支持分页和搜索）。
 * @param {string} keyword
 * @param {number} page
 * @param {number} pageSize
 * @returns {Promise<{items: Array, total: number, page: number, pageSize: number}>}
 */
async function searchHistory(keyword = '', page = 1, pageSize = 20) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });

    // 过滤
    let filtered = all;
    if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = all.filter(item =>
            (item.original_name || '').toLowerCase().includes(kw) ||
            (item.watermark_text || '').toLowerCase().includes(kw)
        );
    }

    // 排序（最新的在前）
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 分页
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    // 为每条记录生成 object URL（用于展示缩略图）
    items.forEach(item => {
        if (item.image_blob) {
            item.thumbnail_url = URL.createObjectURL(item.image_blob);
        }
    });

    return { items, total, page, pageSize };
}

/**
 * 根据 ID 获取图片 Blob（用于下载）。
 * @param {number} id
 * @returns {Promise<Blob|null>}
 */
async function getImageBlob(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => {
            const record = request.result;
            resolve(record ? record.image_blob : null);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * 删除一条历史记录。
 * @param {number} id
 * @returns {Promise<boolean>}
 */
async function deleteHistory(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 清空所有历史记录。
 * @returns {Promise<boolean>}
 */
async function clearAll() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 获取存储统计信息。
 * @returns {Promise<{count: number, totalSizeBytes: number, totalSizeMB: string}>}
 */
async function getStorageInfo() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
    const totalSize = all.reduce((sum, item) => {
        return sum + (item.image_blob ? item.image_blob.size : 0);
    }, 0);
    return {
        count: all.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
    };
}
