// @ts-nocheck
// 크레딧 충전 모달 (1크레딧 = 200원). mock 모드에선 즉시 충전.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { chargeCredits } from "@/lib/photos.functions";
import { toast } from "sonner";
import { Coins, Check } from "lucide-react";

const CREDIT_PRICE_WON = 200;
const PACKS = [10, 30, 50, 100];

export function ChargeCreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const chargeFn = useServerFn(chargeCredits);
  const [credits, setCredits] = useState(30);
  const [busy, setBusy] = useState(false);

  if (!open || typeof document === "undefined") return null;

  async function charge() {
    setBusy(true);
    try {
      const res = await chargeFn({ data: { credits } });
      if (res.status === "completed") {
        // mock 모드 — 즉시 적립
        toast.success(`${credits} 크레딧 충전 완료!`);
        qc.invalidateQueries({ queryKey: ["profile"] });
        onClose();
        return;
      }
      // real 모드 — 토스 결제창으로
      const { loadTossPayments } = await import("@tosspayments/payment-sdk");
      const toss = await loadTossPayments(res.client_key);
      await toss.requestPayment("카드", {
        amount: res.won,
        orderId: res.order_id,
        orderName: res.order_name,
        successUrl: `${window.location.origin}/payments/success`,
        failUrl: `${window.location.origin}/payments/fail`,
      });
      // requestPayment 는 리다이렉트 → 이후 흐름은 /payments/success 에서
    } catch (e: any) {
      toast.error(e?.message ?? "충전 실패");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] mx-auto flex max-w-[480px] items-center justify-center bg-foreground/40 px-6 backdrop-blur-md" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-[400px] rounded-[1.75rem] border border-white/60 bg-card p-5 shadow-[0_30px_80px_-30px_rgba(10,10,10,0.35)]" onClick={(e) => e.stopPropagation()}>
        <span className="chip"><Coins className="h-3.5 w-3.5" /> 크레딧 충전</span>
        <h2 className="font-display mt-3 text-lg font-extrabold">크레딧 충전</h2>
        <p className="mt-1 text-sm text-muted-foreground">1 크레딧 = {CREDIT_PRICE_WON}원</p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {PACKS.map((c) => (
            <button
              key={c}
              onClick={() => setCredits(c)}
              className={`relative rounded-2xl border-2 p-3 text-left transition ${credits === c ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <p className="font-display text-xl font-extrabold">{c} <span className="text-sm font-bold text-muted-foreground">크레딧</span></p>
              <p className="mt-0.5 text-xs text-muted-foreground">{(c * CREDIT_PRICE_WON).toLocaleString("ko-KR")}원</p>
              {credits === c && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold">닫기</button>
          <button onClick={charge} disabled={busy} className="flex-1 rounded-full bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-50">
            {busy ? "처리 중…" : `${(credits * CREDIT_PRICE_WON).toLocaleString("ko-KR")}원 충전`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
