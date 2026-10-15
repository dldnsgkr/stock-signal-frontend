// 이식된 서비스 싱글턴 — 라우트 핸들러들이 여기서 가져다 쓴다.
import { prisma } from './prisma';
import { PerformanceService } from './services/performance.service';
import { RecommendationsService } from './services/recommendations.service';
import { StocksService } from './services/stocks.service';
import { MarketService } from './services/market.service';
import { WatchlistService } from './services/watchlist.service';
import { SubscriptionService } from './services/subscription.service';
import { UserSettingsService } from './services/user-settings.service';
import { NotificationsService } from './services/notifications.service';
import { PushService } from './services/push.service';
import { BriefingService } from './services/briefing.service';
import { TechnicalLevelsService } from './services/technical-levels.service';

export const performanceService = new PerformanceService(prisma);
export const recommendationsService = new RecommendationsService(prisma);
export const stocksService = new StocksService(prisma);
export const marketService = new MarketService(prisma);
export const watchlistService = new WatchlistService(prisma);
export const subscriptionService = new SubscriptionService(prisma);
export const userSettingsService = new UserSettingsService(prisma);
export const notificationsService = new NotificationsService(prisma);
export const pushService = new PushService(prisma);
export const briefingService = new BriefingService(prisma);
export const technicalLevelsService = new TechnicalLevelsService(prisma);
