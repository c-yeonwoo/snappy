/**
 * Snappy 브랜드 워드마크. 라우팅 타입을 건드리지 않도록 presentational 컴포넌트로 두고,
 * 링크가 필요한 곳은 호출부에서 <Link>로 감싼다.
 * 표기는 항상 "Snappy" (대문자 S). 라임 S 아이콘은 앱 아이콘/파비콘 전용이라
 * 헤더에서는 워드마크만 노출(아이콘+이름 중복 방지).
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-xl font-bold tracking-tight ${className}`}>
      Snappy
    </span>
  );
}
