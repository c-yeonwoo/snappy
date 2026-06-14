// @ts-nocheck
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payments/fail")({
  validateSearch: (s: Record<string, unknown>) => ({
    message: typeof s.message === "string" ? s.message : "",
  }),
  component: PaymentFail,
});

function PaymentFail() {
  const { message } = useSearch({ from: "/payments/fail" });
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-md px-[18px] py-5"><Logo /></header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-[18px] pb-24 text-center">
        <h1 className="font-display text-xl font-bold">결제가 취소됐어요</h1>
        <p className="mt-1 text-sm text-muted-foreground">{message || "결제가 완료되지 않았어요."}</p>
        <Button className="mt-6 h-12 w-full rounded-full" onClick={() => navigate({ to: "/profile" })}>프로필로</Button>
      </main>
    </div>
  );
}
