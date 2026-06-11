import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { formatDate } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<{ market?: string }>;
}

async function getData(market: string) {
  try {
    const [overview7d, overview30d, modelVersions] = await Promise.all([
      api.get<any>(`/performance/overview?market=${market}&period=7d`),
      api.get<any>(`/performance/overview?market=${market}&period=30d`),
      api.get<any>('/performance/model-versions'),
    ]);
    return { overview7d, overview30d, modelVersions };
  } catch {
    return { overview7d: null, overview30d: null, modelVersions: [] };
  }
}

export default async function PerformancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const market = params.market || 'US';

  const { overview7d, overview30d, modelVersions } = await getData(market);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">성과 리포트</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} · 시그널 적중률 및 수익률 분석
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="7일 적중률"
          value={overview7d?.hitRate7d != null ? `${(overview7d.hitRate7d * 100).toFixed(1)}%` : '-'}
          subtitle="BUY 시그널 기준"
        />
        <StatCard
          title="7일 평균 수익률"
          value={overview7d?.avgReturn7d != null ? `${(overview7d.avgReturn7d * 100).toFixed(2)}%` : '-'}
          trend={overview7d?.avgReturn7d}
        />
        <StatCard
          title="30일 적중률"
          value={overview30d?.hitRate30d != null ? `${(overview30d.hitRate30d * 100).toFixed(1)}%` : '-'}
          subtitle="BUY 시그널 기준"
        />
        <StatCard
          title="30일 평균 수익률"
          value={overview30d?.avgReturn30d != null ? `${(overview30d.avgReturn30d * 100).toFixed(2)}%` : '-'}
          trend={overview30d?.avgReturn30d}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>모델 버전별 성과 비교</CardTitle>
        </CardHeader>
        <CardContent>
          {modelVersions && modelVersions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">버전</th>
                    <th className="pb-2 pr-4">전략</th>
                    <th className="pb-2 pr-4">배포일</th>
                    <th className="pb-2 pr-4">실행 수</th>
                    <th className="pb-2 pr-4">추천 수</th>
                    <th className="pb-2 pr-4">7일 적중률</th>
                    <th className="pb-2">7일 수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {modelVersions.map((v: any) => (
                    <tr key={v.versionName} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        {v.versionName}
                        {v.isActive && (
                          <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                            활성
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{v.strategyType}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(v.deployedAt)}</td>
                      <td className="py-2 pr-4">{v.totalRuns}</td>
                      <td className="py-2 pr-4">{v.totalRecommendations}</td>
                      <td className="py-2 pr-4">
                        {v.hitRate7d != null ? `${(v.hitRate7d * 100).toFixed(1)}%` : '-'}
                      </td>
                      <td className={`py-2 font-medium ${
                        v.avgReturn7d > 0 ? 'text-green-600' : v.avgReturn7d < 0 ? 'text-red-600' : ''
                      }`}>
                        {v.avgReturn7d != null ? `${(v.avgReturn7d * 100).toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">
              성과 데이터가 아직 없습니다
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            * 적중률은 BUY 시그널 이후 해당 기간 내 수익이 발생한 비율입니다.
            과거 성과가 미래 수익을 보장하지 않습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
