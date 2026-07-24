// 브라우저 웹푸시 구독 헬퍼.
// VAPID 공개키 조회·구독 등록/해지는 /api/proxy 를 통해 백엔드로 전달된다.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

/** 현재 브라우저가 구독 중인지 확인 */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/** 알림 권한 요청 → 구독 → 서버 등록. 성공 시 true. */
export async function subscribePush(): Promise<boolean> {
  if (!pushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다');

  const keyRes = await fetch('/api/proxy?endpoint=/push/public-key');
  const { publicKey } = await keyRes.json();
  if (!publicKey) throw new Error('서버에 푸시 키가 설정되지 않았습니다');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('알림 권한이 거부되었습니다');

  const reg = await getRegistration();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const res = await fetch('/api/proxy?endpoint=/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    await sub.unsubscribe().catch(() => {});
    throw new Error('구독 등록에 실패했습니다');
  }
  return true;
}

/** 구독 해지 (브라우저 + 서버 양쪽) */
export async function unsubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;

  await fetch('/api/proxy?endpoint=/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});

  await sub.unsubscribe();
}
