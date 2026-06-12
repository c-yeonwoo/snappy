import { Camera } from "lucide-react";

/**
 * Snappy 브랜드 워드마크. 라우팅 타입을 건드리지 않도록 presentational 컴포넌트로 두고,
 * 링크가 필요한 곳은 호출부에서 <Link>로 감싼다.
 * 표기는 항상 "Snappy" (대문자 S), 뱃지는 foreground/background 한 가지로 통일.
 */
export function Logo({
  className = "",
  badgeClassName = "h-8 w-8",
}: {
  className?: string;
  badgeClassName?: string;
}) {
  return (
    <span className={`flex items-center gap-2 font-display font-bold ${className}`}>
      <span className={`grid place-items-center rounded-2xl bg-foreground text-background ${badgeClassName}`}>
        <Camera className="h-4 w-4" />
      </span>
      Snappy
    </span>
  );
}
