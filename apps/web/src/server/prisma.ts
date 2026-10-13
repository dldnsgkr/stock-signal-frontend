// 서버리스용 Prisma 싱글턴 — 백엔드(NestJS)의 PrismaService 를 대체한다.
// 이식된 서비스 코드가 `PrismaService` 타입을 그대로 쓰도록 같은 이름을 유지한다.
import { PrismaClient } from '@prisma/client';

// $queryRaw 의 COUNT(*) 등이 BigInt 로 오므로 JSON 직렬화를 백엔드 main.ts 와
// 동일하게 맞춘다 (없으면 NextResponse.json 이 TypeError 를 낸다).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export class PrismaService extends PrismaClient {}

// Next dev 핫리로드·서버리스 재사용에서 커넥션이 불어나지 않도록 전역 캐시
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaService };

export const prisma: PrismaService =
  globalForPrisma.__prisma ?? (globalForPrisma.__prisma = new PrismaService());
