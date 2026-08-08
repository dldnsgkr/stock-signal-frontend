/**
 * 전략 일치도 표시 — 예전의 '신뢰도 XX%'.
 *
 * 왜 이름과 단위를 바꿨나 (2026-08 검증 결과):
 *  1) **적중 확률이 아니다.** 값은
 *     `(|점수-50| × 1.5 + 전략 일치 보너스) × 데이터 품질` 로, 세 전략이 같은 방향을
 *     가리키는 정도와 점수가 중립에서 벗어난 폭을 합친 지표다. 확률과 무관하다.
 *     툴팁만 달아두면 숫자가 시각적으로 주장하는 '78%' 를 되돌리지 못해 표기를 바꿨다.
 *  2) **한국 시장에서는 방향이 뒤집혀 있다.** 값이 높을수록 알파가 낮았다
 *     (<20 −5.75% / 20-40 −6.82% / 40-60 −11.91%). 종목 선택 근거로 쓰면 안 된다.
 *     미국은 v2.1 데이터에서 적중률이 단조 증가해(41.5%→61.6%) 참고 가치가 있다.
 *  3) **스케일이 눌려 있다.** 5~95 로 클램프되지만 실측 최대가 KR 59 / US 78 이고
 *     평균은 KR 16 / US 36 이다. '%' 로 보이면 상단이 비어 있는 걸 알 수 없다.
 */

export const AGREEMENT_LABEL = '전략 일치도';

/** 시장별 설명 — 한국은 역전 사실을 명시한다. */
export function agreementTooltip(market?: string | null): string {
  const base =
    '모멘텀·가치·감성 세 전략이 같은 방향을 가리키는 정도입니다(5~95, 실제로는 대부분 60 미만). ' +
    '적중 확률이 아닙니다.';
  return market === 'KR'
    ? `${base} 한국 시장에서는 이 값이 높을수록 성과가 오히려 낮았으므로 종목 선택 근거로 쓰지 마세요.`
    : base;
}

interface AgreementScoreProps {
  value: number | null | undefined;
  market?: string | null;
  /** 라벨을 함께 보여줄지 (표 안에서는 헤더가 라벨 역할을 하므로 끔) */
  withLabel?: boolean;
  className?: string;
}

export function AgreementScore({ value, market, withLabel = false, className = '' }: AgreementScoreProps) {
  const text = value != null ? String(value) : '-';
  return (
    <span className={`cursor-help ${className}`} title={agreementTooltip(market)}>
      {withLabel ? `${AGREEMENT_LABEL} ${text}` : text}
    </span>
  );
}
