/* 每日打卡学习 - Service Worker */
const CACHE = 'dk-checkin-v6';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 数据文件单独缓存，离线也能加载最新已缓存版本
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 数据文件：网络优先，失败回退缓存
  if (req.url.includes('/data/modules.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./data/modules.json', copy));
          return res;
        })
        .catch(() => caches.match('./data/modules.json'))
    );
    return;
  }
  // 其他：缓存优先
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});