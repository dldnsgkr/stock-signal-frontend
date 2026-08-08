// Stock Signal 웹푸시 서비스 워커

// 새 워커를 곧바로 활성화한다.
// 기본 동작은 열려 있는 탭이 전부 닫힐 때까지 새 워커가 'waiting' 으로 대기하는 것인데,
// 이 파일이 알림 표시 로직을 갖고 있어서 그동안 수정이 반영되지 않는다.
// (2026-08-09: 알림 아이콘을 추가했는데 서버 푸시에는 며칠간 안 나올 뻔했다)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
// 크롬의 앱 설치 조건에 'fetch 핸들러가 있는 서비스워커' 가 포함된다.
// 캐싱은 하지 않으므로 respondWith 를 호출하지 않는다 — 브라우저가 평소대로 네트워크로 간다.
// (핸들러 존재 자체가 조건이다. 지우면 설치 버튼이 사라질 수 있다.)
self.addEventListener('fetch', () => {});

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
