// Stock Signal 웹푸시 서비스 워커
self.addEventListener('push', (event) => {
  let payload = { title: 'Stock Signal', body: '', url: '/', tag: undefined };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data ? event.data.text() : '';
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      // 안 넣으면 브라우저 기본 아이콘(크롬 로고)이 뜬다.
      // icon = 알림 본문 옆 큰 아이콘, badge = 안드로이드 상태바용 단색 아이콘.
      icon: payload.icon || '/icon-192.png',
      badge: '/badge-96.png',
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    }),
  );
});
