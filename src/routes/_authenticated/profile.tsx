import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  requestPointCharge,
  requestPointWithdraw,
  getMyProfile,
  getMyFeed,
  getFriends,
} from "@/lib/photos.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatRemaining, isWindowOpen, formatPoint } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { toast } from "sonner";
import { Settings, Users, ChevronRight, LogOut, BookmarkCheck, Copy, Coins, ArrowDownToLine, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "나 — Snappy" }] }),
  component: ProfilePage,
});

type PointMode = "charge" | "withdraw";

function ProfilePage() {
  const router = useRouter();
  const fetchProfile = useServerFn(getMyProfile);
  const feedFn = useServerFn(getMyFeed);
  const friendsFn = useServerFn(getFriends);
  const chargePointFn = useServerFn(requestPointCharge);
  const withdrawPointFn = useServerFn(requestPointWithdraw);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const { data: feedData } = useQuery({ queryKey: ["feed"], queryFn: () => feedFn() });
  const { data: friendsData } = useQuery({ queryKey: ["friends"], queryFn: () => friendsFn() });

  const [pointMode, setPointMode] = useState<PointMode>("charge");
  const [pointDialogOpen, setPointDialogOpen] = useState(false);
  const [pointAmountInput, setPointAmountInput] = useState("10000");
  const [pointBusy, setPointBusy] = useState(false);

  const friendCount = friendsData?.friends?.length ?? 0;
  const savedCount = (feedData?.photos ?? []).filter((p) => p.status === "sold").length;
  const pointBalance = data?.point_balance ?? 0;
  const allowUntil = data?.profile?.allow_until ?? null;
  const windowActive = isWindowOpen(allowUntil);
  const handle = data?.profile?.handle ?? "me";
  const displayName = data?.profile?.display_name ?? "내 이름";

  useNow(windowActive);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(`@${handle}`);
      toast.success(`@${handle} 복사됐어요`);
    } catch {
      toast.error("복사 실패");
    }
  }

  function openPointDialog(mode: PointMode) {
    setPointMode(mode);
    setPointAmountInput("10000");
    setPointDialogOpen(true);
  }

  function getCheckoutUrl(
    mode: PointMode,
    orderId: string,
    amountWon: number,
    payment?: { callback?: { charge?: string | null; withdraw?: string | null } },
  ) {
    const base = mode === "charge" ? payment?.callback?.charge : payment?.callback?.withdraw;
    if (!base) return "";
    try {
      const url = new URL(base);
      url.searchParams.set("type", mode);
      url.searchParams.set("order_id", orderId);
      url.searchParams.set("amount_won", String(amountWon));
      return url.toString();
    } catch {
      return "";
    }
  }

  async function requestPoint() {
    const amount = Number(pointAmountInput.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(amount) || amount < 1000 || amount > 200000) {
      toast.error("금액은 1,000원 ~ 200,000원 범위로 입력해야 해요.");
      return;
    }

    setPointBusy(true);
    try {
      const runner = pointMode === "charge" ? chargePointFn : withdrawPointFn;
      const res = await runner({ data: { amount_won: amount } });
      if (res.status === "completed") {
        toast.success(`${pointMode === "charge" ? "충전" : "출금"} 완료됐어요`);
        setPointDialogOpen(false);
        qc.invalidateQueries({ queryKey: ["profile"] });
        return;
      }

      const checkout = getCheckoutUrl(pointMode, res.order_id, res.amount_won ?? amount, res.payment);
      if (!checkout) {
        toast.error("결제 연동 URL이 등록되지 않았습니다. 운영 모드 설정을 먼저 완료해주세요.");
        return;
      }

      setPointDialogOpen(false);
      window.location.href = checkout;
    } catch (e: any) {
      toast.error(e?.message ?? `${pointMode === "charge" ? "충전" : "출금"} 실패`);
    } finally {
      setPointBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* Identity card */}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-gradient-to-br from-brand-soft via-card to-accent/40 p-6 backdrop-blur">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/30 blur-3xl" />
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-foreground text-2xl font-display font-extrabold text-background">
            {displayName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-xl font-extrabold">{displayName}</p>
            <button onClick={copyHandle} className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-sm font-semibold text-muted-foreground backdrop-blur active:scale-95">
              <span className="truncate">@{handle}</span>
              <Copy className="h-3 w-3 shrink-0 opacity-70" />
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground">친구에게 내 ID를 알려주면 사진을 받을 수 있어요</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="친구" value={friendCount} />
          <Stat label="보관" value={savedCount} />
          <Stat label="받기" value={windowActive ? "ON" : "친구만"} />
        </div>
      </section>

      {/* 포인트 섹션 */}
      <section className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 backdrop-blur">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary"><Coins className="h-4 w-4" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">내 포인트</p>
              <p className="font-digit text-lg font-semibold leading-tight">{formatPoint(pointBalance)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openPointDialog("charge")}
              className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition active:scale-95"
            >
              <Plus className="h-3 w-3" /> 충전
            </button>
            <button
              onClick={() => openPointDialog("withdraw")}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition active:scale-95"
            >
              <ArrowDownToLine className="h-3 w-3" /> 출금
            </button>
          </div>
        </div>
        <p className="px-5 py-2.5 text-[11px] text-muted-foreground">1P = 1원 · 친구가 내 사진을 소장하면 포인트로 적립돼요</p>
      </section>

      {/* Menu */}
      <nav className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 backdrop-blur">
        <Row to="/friends" icon={Users} label="친구" hint={`${friendCount}명`} />
        <Row to="/feed" icon={BookmarkCheck} label="내 앨범" hint={`${savedCount}컷`} />
        <Row to="/settings" icon={Settings} label="설정" hint={windowActive ? `받기 ON · ${formatRemaining(allowUntil!)}` : undefined} />
      </nav>

      <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card/70 px-4 py-3 text-sm font-semibold text-muted-foreground">
        <LogOut className="h-4 w-4" /> 로그아웃
      </button>

      <Dialog open={pointDialogOpen} onOpenChange={setPointDialogOpen}>
        <DialogContent className="w-[90vw] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{pointMode === "charge" ? "포인트 충전" : "포인트 출금"}</DialogTitle>
            <DialogDescription>
              {pointMode === "charge"
                ? "금액을 입력하고 진행해 주세요."
                : "출금 계좌 등록/본인 확인 후 진행될 수 있어요."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="point-amount">금액(원)</Label>
            <Input
              id="point-amount"
              inputMode="numeric"
              value={pointAmountInput}
              onChange={(e) => setPointAmountInput(e.target.value)}
              placeholder="1000~200000"
            />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button type="button" className="rounded-full border border-border px-3 py-2" onClick={() => setPointAmountInput("5000")}>5,000</button>
              <button type="button" className="rounded-full border border-border px-3 py-2" onClick={() => setPointAmountInput("10000")}>10,000</button>
              <button type="button" className="rounded-full border border-border px-3 py-2" onClick={() => setPointAmountInput("30000")}>30,000</button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPointDialogOpen(false)}
              className="flex-1 rounded-full border border-border px-3 py-2.5 text-sm font-semibold"
              disabled={pointBusy}
            >
              닫기
            </button>
            <button
              type="button"
              onClick={requestPoint}
              className="flex-1 rounded-full bg-foreground px-3 py-2.5 text-sm font-semibold text-background"
              disabled={pointBusy}
            >
              {pointBusy ? "요청 중…" : pointMode === "charge" ? "충전 진행" : "출금 진행"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-2 py-2.5 backdrop-blur">
      <p className="font-display text-lg font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ to, icon: Icon, label, hint }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; hint?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 border-b border-border/60 px-5 py-4 last:border-b-0 transition active:bg-secondary">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary"><Icon className="h-4 w-4" /></span>
      <span className="flex-1 font-semibold">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
