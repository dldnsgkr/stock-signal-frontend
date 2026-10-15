import { PrismaService } from '../prisma';

export interface GoogleProfileDto {
  email: string;
  name?: string | null;
  googleId: string;
  avatarUrl?: string | null;
}

export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // 로그인 시 Google 프로필로 users 행을 맞춘다 (googleId 기준 upsert)
  syncFromGoogle(data: GoogleProfileDto) {
    return this.prisma.user.upsert({
      where: { googleId: data.googleId },
      update: {
        email: data.email,
        name: data.name ?? null,
        avatarUrl: data.avatarUrl ?? null,
      },
      create: {
        email: data.email,
        name: data.name ?? null,
        googleId: data.googleId,
        avatarUrl: data.avatarUrl ?? null,
      },
    });
  }
}
