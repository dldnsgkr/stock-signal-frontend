import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { useNeon } from '@/server/mode';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001/api';

const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // 최초 로그인 시에만 백엔드와 동기화
      if (account && profile) {
        const googleId = (profile as { sub?: string }).sub;
        if (useNeon() && token.email && googleId) {
          try {
            const { usersService } = await import('@/server');
            const user = await usersService.syncFromGoogle({
              email: token.email,
              name: token.name,
              googleId,
              avatarUrl: token.picture,
            });
            token.userId = user.id;
          } catch (err) {
            console.error('[NextAuth] 유저 동기화 실패:', err);
          }
          return token;
        }
        try {
          const res = await fetch(`${BACKEND_URL}/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: token.email,
              name: token.name,
              googleId,
              avatarUrl: token.picture,
            }),
          });
          if (res.ok) {
            const user = (await res.json()) as { id: number };
            token.userId = user.id;
          }
        } catch (err) {
          console.error('[NextAuth] 유저 동기화 실패:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = String(token.userId);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(config);
