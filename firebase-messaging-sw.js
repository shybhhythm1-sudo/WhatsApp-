// firebase-messaging-sw.js
// لازم يكون في جذر الموقع (نفس مكان index.html) عشان يشتغل صح

importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCsgyf5xsedwsemKeb_rIv7S-lwdPdhcbM",
  authDomain: "heye-ee886.firebaseapp.com",
  databaseURL: "https://heye-ee886-default-rtdb.firebaseio.com",
  projectId: "heye-ee886",
  storageBucket: "heye-ee886.firebasestorage.app",
  messagingSenderId: "87245692179",
  appId: "1:87245692179:web:25dea241b80a669ea44ee6"
});

const messaging = firebase.messaging();

// الإشعار وقت ما التطبيق يكون مقفول أو في الخلفية
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "هيي";
  const options = {
    body: payload.notification?.body || "",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    dir: "rtl",
    lang: "ar",
    data: payload.data || {},
    vibrate: [200, 100, 200],
    tag: payload.data?.chatId || "heye-msg",
    renotify: true
  };
  self.registration.showNotification(title, options);
});

// لما المستخدم يدوس على الإشعار، يفتح التطبيق
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const urlToOpen = new URL('/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (chatId) client.postMessage({ type: 'OPEN_CHAT', chatId });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
