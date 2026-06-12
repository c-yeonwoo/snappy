import { useEffect, useState } from "react";

/** active일 때 1초마다 리렌더를 유발해 카운트다운이 갱신되게 한다. */
export function useNow(active: boolean, intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}
