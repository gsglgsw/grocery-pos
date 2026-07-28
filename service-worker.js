// ==========================================
// 🚀 PWA 離線核心引擎 (容錯與分離快取架構)
// ==========================================
const CACHE_NAME = 'pos-cache-v20260728-2'; // 🚀 升級版本號強制更新

// 1. 本地核心資源 (嚴格快取：少一個都不行)
const LOCAL_ASSETS = [
    './',
    './index.html',
    './customer.html',
    './css/style.css',
    './js/config.js',
    './js/model.js',
    './js/view.js',
    './js/controller.js',
    './js/customer.js',
    './js/app.js',
    './manifest.json'
];

// 2. 外部 CDN 資源 (寬鬆快取：使用 no-cors 模式)
const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/html5-qrcode',
    'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

// 安裝階段：分離快取策略
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[Service Worker] 📥 開始快取本地資源...');
            // 步驟 A：快取本地資源 (若失敗會直接中止安裝)
            await cache.addAll(LOCAL_ASSETS);
            
            console.log('[Service Worker] 📥 開始快取外部 CDN 資源 (no-cors 模式)...');
            // 步驟 B：快取外部資源 (允許 Opaque Response)
            for (const url of EXTERNAL_ASSETS) {
                try {
                    const req = new Request(url, { mode: 'no-cors' });
                    const res = await fetch(req);
                    await cache.put(req, res);
                } catch (e) {
                    console.warn('[Service Worker] ⚠️ 外部資源快取失敗，將於連網時重試:', url);
                }
            }
            console.log('[Service Worker] ✅ 核心檔案與 CDN 快取完成！');
        })
    );
    self.skipWaiting(); // 強制立刻接管
});

// 啟動階段：清除舊版快取
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] 🗑️ 清除舊快取:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 攔截請求階段：Cache First 策略
self.addEventListener('fetch', (event) => {
    // 嚴格排除 POST 請求與 API 呼叫 (如 GAS 寫入)，讓它們正常走網路
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('script.google.com')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // 如果快取裡有 (包含黑盒子的 opaque response)，直接秒回傳
            if (cachedResponse) return cachedResponse;
            // 否則向網路請求
            return fetch(event.request);
        }).catch(() => {
            console.warn('[Service Worker] 離線狀態，且找不到快取檔案:', event.request.url);
        })
    );
});