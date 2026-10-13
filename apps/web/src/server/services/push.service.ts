// 백엔드 alert/push.service.ts 의 이식판 — ConfigService 대신 process.env.
// 구독 등록/해지/공개키 조회만 1차 이식 (발송은 파이프라인=Actions 쪽 책임).
import * as webpush from 'web-push';
import { Logger } from '../http-errors';
import { PrismaService } from '../prisma';

export class PushService {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@stock-signal.local';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — web push disabled');
    }
  }

  getPublicKey(): string | null {
    return this.enabled ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
  }

  async subscribe(endpoint: string, p256dh: string, auth: string, userId?: number) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth, userId: userId ?? null },
      update: { p256dh, auth, ...(userId ? { userId } : {}) },
    });
    return { subscribed: true };
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { subscribed: false };
  }
}
