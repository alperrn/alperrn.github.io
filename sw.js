const CACHE_NAME = 'yks-istasyonu-v2';
// Çevrimdışı çalışmasını istediğimiz tüm dosyalar
const ASSETS = [
  '/',
  '/index.html',
  '/tyt.html',
  '/ayt.html',
  '/kronometre.html',
  '/pomodoro.html',
  '/style.css',
  '/app.js',
  '/logo.svg',
  '/manifest.json'
];

// Uygulama yüklenirken dosyaları hafızaya al
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Dosya istendiğinde: Önce interneti dene, internet yoksa hafızadan (cache) getir
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});