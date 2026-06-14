// @ts-nocheck
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { confirmTossPayment } from "@/lib/photos.functions";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/payments/success")({
  validateSearch: (s: Record<string, unknown>) => ({
    paymentKey: typeof s.paymentKey === "string" ? s.paymentKey : "",
    orderId: typeof s.orderId === "string" ? s.orderId : "",
    amount: s.amount ? Number(s.amount) : 0,
  }),
  component: PaymentSuccess,
});

function PaymentSuccess() {
  const { paymentKey, orderId, amount } = useSearch({ from: "/payments/success" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmTossPayment);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) { setState("error"); setMsg("결제 정보가 올바르지 않아요"); return; }
    confirmFn({ data: { payment_key: paymentKey, order_id: orderId, amount } })
      .then(() => { setState("done"); qc.invalidateQueries({ queryKey: ["profile"] }); })
      .catch((e: any) => { setState("error"); setMsg(e?.message ?? "결제 승인 실패"); });
  }, [paymentKey, orderId, amount]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-md px-[18px] py-5"><Logo /></header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-[18px] pb-24 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">결제를 확인하고 있어요…</p>
          </>
        )}
        {state === "done" && (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary"><Check className="h-8 w-8" /></div>
            <h1 className="font-display mt-4 text-2xl font-extrabold">충전 완료!</h1>
            <p className="mt-1 text-sm text-muted-foreground">크레딧이 적립됐어요.</p>
            <Button className="mt-6 h-12 w-full rounded-full" onClick={() => navigate({ to: "/profile" })}>내 크레딧 보기</Button>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="font-display text-xl font-bold">결제를 확인하지 못했어요</h1>
            <p className="mt-1 text-sm text-muted-foreground">{msg}</p>
            <Button variant="outline" className="mt-6 h-12 w-full rounded-full" onClick={() => navigate({ to: "/profile" })}>프로필로</Button>
          </>
        )}
      </main>
    </div>
  );
}
