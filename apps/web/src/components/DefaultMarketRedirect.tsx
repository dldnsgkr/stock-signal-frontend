'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

// 홈(/)에 ?market 없이 들어온 로그인 유저를 개인 설정의 기본 마켓으로 이동.
// 명시적 ?market 이 있으면 사용자의 선택을 존중해 건드리지 않는다.
export function DefaultMarketRedirect() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (status !== 'authenticated') return;
    if (searchParams.get('market')) return; // 명시적 선택 존중

    done.current = true;
    fetch('/api/user-settings')
      .then(r => (r.ok ? r.json() : null))
      .then((s: { defaultMarket?: string } | null) => {
        if (s?.defaultMarket && s.defaultMarket !== 'US') {
          router.replace(`/?market=${s.defaultMarket}`);
        }
      })
      .catch(() => {});
  }, [status, searchParams, router]);

  return null;
}
