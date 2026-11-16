const CACHE_NAME = 'masarif-pwa-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/db.js',
    './js/sync.js',
    './js/ui.js',
    './js/app.js'
];

// تثبيت الـ Service Worker وتخزين الملفات
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// تفعيل النسخة الجديدة وحذف الكاش القديم إن وجد
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// جلب الملفات من الكاش أولاً لضمان العمل بدون إنترنت
self.addEventListener('fetch', (event) => {
    // عدم تخزين طلبات Supabase في الكاش
    if (event.request.url.includes('supabase.co')) {
        return;
    }
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});