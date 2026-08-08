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

  // 세션 userId 주입을 위해 authed 라우트 경유 (로그인 시 관심종목 타겟 알림 활성)
  const res = await fetch('/api/push/subscribe', {
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

/**
 * 구독은 성공했는데 알림이 안 보이는 '조용한 실패' 를 잡기 위한 로컬 테스트.
 *
 * OS 레벨에서 브라우저 알림이 꺼져 있으면 `Notification.permission` 은 계속
 * 'granted' 이고 `showNotification()` 도 정상 resolve 하며
 * `registration.getNotifications()` 에도 등록된다. **그런데 화면에는 안 뜬다.**
 * 웹 표준에는 이걸 감지할 API 가 없다(2026-08 기준).
 *
 * 그래서 감지 대신 **보내보고 사용자에게 확인받는다.** 푸시 서버를 거치지 않고
 * 서비스워커가 직접 띄우므로, 이게 안 보이면 원인은 네트워크·VAPID 가 아니라
 * OS/브라우저 표시 설정이다.
 */
export async function sendTestNotification(): Promise<void> {
  if (!pushSupported()) throw new Error('이 브라우저는 알림을 지원하지 않습니다');
  if (Notification.permission !== 'granted') throw new Error('알림 권한이 없습니다');
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) throw new Error('서비스워커가 등록되어 있지 않습니다');
  await reg.showNotification('Stock Signal 테스트 알림', {
    body: '이 알림이 보이면 정상입니다. 안 보이면 아래 안내를 확인하세요.',
    tag: `test-${Date.now()}`,   // 같은 tag 는 기존 알림을 교체해 새로 안 뜬다
    requireInteraction: true,    // 자동으로 사라지지 않게 — 놓치는 걸 막는다
    data: { url: '/settings' },
  });
}

export interface OsGuide {
  os: string;
  steps: string[];
}

/** 알림이 안 보일 때 확인할 곳 — OS 마다 다르다. */
export function notificationGuide(): OsGuide {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform =
    (typeof navigator !== 'undefined' &&
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform) || '';
  const is = (s: string) => platform.toLowerCase().includes(s) || ua.toLowerCase().includes(s);

  if (is('android')) {
    return {
      os: 'Android',
      steps: [
        '설정 → 앱 → 브라우저(Chrome 등) → 알림 → 허용',
        '방해 금지 모드가 켜져 있는지 확인',
      ],
    };
  }
  if (is('iphone') || is('ipad') || is('ios')) {
    return {
      os: 'iOS',
      steps: [
        'iOS 는 홈 화면에 추가한 웹앱에서만 알림이 동작합니다 — 공유 → 홈 화면에 추가',
        '설정 → 알림 → 해당 웹앱 → 알림 허용',
      ],
    };
  }
  if (is('win')) {
    return {
      os: 'Windows',
      steps: [
        '설정 → 시스템 → 알림 → 브라우저(Chrome 등) 알림 켜기',
        '집중 지원(방해 금지)이 꺼져 있는지 확인',
      ],
    };
  }
  return {
    os: 'macOS',
    steps: [
      '시스템 설정 → 알림 → 목록에서 브라우저(Chrome 등) → "알림 허용" 켜기',
      '알림 스타일이 "없음" 이면 배너가 뜨지 않습니다 → "배너" 또는 "알림" 선택',
      '집중 모드(방해금지)가 꺼져 있는지 제어 센터에서 확인',
      '브라우저가 여러 개 설치돼 있으면 목록에 항목이 여러 개 보입니다 — 실제 사용 중인 쪽을 켜세요',
    ],
  };
}
