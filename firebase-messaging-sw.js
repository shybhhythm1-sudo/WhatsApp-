// firebase-messaging-sw.js
// هذا الملف لازم يكون في نفس مجلد heye.html بالظبط (نفس المستوى)، وميتحطش جوا فولدر فرعي.
// هو المسؤول عن إظهار الإشعارات لما التطبيق يكون مقفول أو التبويب مقفول خالص.

importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

// ⚠️ لازم يكون نفس الإعدادات المستخدمة في heye.html بالظبط
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

// بيشتغل لما تيجي رسالة والتطبيق مقفول أو في الخلفية
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'هيي - Heye';
  const body = (payload.notification && payload.notification.body) || 'وصلتك رسالة جديدة';
  const chatId = (payload.data && payload.data.chatId) || '';

  const notificationOptions = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: chatId || 'heye-message',
    renotify: true,
    data: { chatId, url: './' }
  };

  self.registration.showNotification(title, notificationOptions);
});

// لما المستخدم يدوس على الإشعار، يفتح/يركز التطبيق
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
