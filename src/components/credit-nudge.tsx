// 크레딧 부족 시 호혜 루프로 유도하는 넛지 — "친구 찍어주러 가기".
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Coins, Camera } from "lucide-react";

export function CreditNudge({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  if (!open || typeof document === "undefined") return null;
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
          <button onClick={onClose} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold">나중에</button>
          <button
            onClick={() => { onClose(); navigate({ to: "/upload" }); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground py-3 text-sm font-semibold text-background"
          >
            <Camera className="h-4 w-4" /> 친구 찍어주러 가기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
