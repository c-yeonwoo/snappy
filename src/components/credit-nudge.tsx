// 크레딧 부족 시 호혜 루프로 유도하는 넛지 — "친구 찍어주러 가기" + 빠른 충전.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Coins, Camera } from "lucide-react";
import { ChargeCreditsModal } from "@/components/charge-credits-modal";

export function CreditNudge({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [chargeOpen, setChargeOpen] = useState(false);
  if ((!open && !chargeOpen) || typeof document === "undefined") return null;
  if (chargeOpen) return <ChargeCreditsModal open={chargeOpen} onClose={() => { setChargeOpen(false); onClose(); }} />;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] mx-auto flex max-w-[480px] items-center justify-center bg-foreground/40 px-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="w-full max-w-[400px] rounded-[1.75rem] border border-white/60 bg-card p-5 shadow-[0_30px_80px_-30px_rgba(10,10,10,0.35)]" onClick={(e) => e.stopPropagation()}>
        <span className="chip"><Coins className="h-3.5 w-3.5" /> 크레딧 부족</span>
        <h2 className="font-display mt-3 text-lg font-extrabold">크레딧이 부족해요</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          친구를 찍어주고 그 사진이 <b className="text-foreground">소장</b>되면 <b className="text-primary">+1 크레딧</b>이 쌓여요.
          모은 크레딧으로 소장·AI 보정을 쓸 수 있어요.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => { onClose(); navigate({ to: "/upload" }); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground py-3 text-sm font-semibold text-background"
          >
            <Camera className="h-4 w-4" /> 찍어주러 가기
          </button>
          <button
            onClick={() => setChargeOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-3 text-sm font-semibold"
          >
            <Coins className="h-4 w-4" /> 충전하기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
