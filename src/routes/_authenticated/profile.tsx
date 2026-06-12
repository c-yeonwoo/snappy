import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, getMyFeed, getFriends } from "@/lib/photos.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatRemaining, isWindowOpen } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { toast } from "sonner";
import { Settings, Users, ChevronRight, LogOut, BookmarkCheck, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "나 — Snappy" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const router = useRouter();
  const fetchProfile = useServerFn(getMyProfile);
  const feedFn = useServerFn(getMyFeed);
  const friendsFn = useServerFn(getFriends);
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const { data: feedData } = useQuery({ queryKey: ["feed"], queryFn: () => feedFn() });
  const { data: friendsData } = useQuery({ queryKey: ["friends"], queryFn: () => friendsFn() });
  const friendCount = friendsData?.friends?.length ?? 0;
  const savedCount = (feedData?.photos ?? []).filter((p) => p.status === "sold").length;
  const allowUntil = data?.profile?.allow_until ?? null;
  const windowActive = isWindowOpen(allowUntil);
  useNow(windowActive);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  const handle = data?.profile?.handle ?? "me";
  const displayName = data?.profile?.display_name ?? "내 이름";

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(`@${handle}`);
      toast.success(`@${handle} 복사됐어요`);
    } catch {
      toast.error("복사 실패");
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

      {/* Menu */}
      <nav className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 backdrop-blur">
        <Row to="/friends" icon={Users} label="친구" hint={`${friendCount}명`} />
        <Row to="/feed" icon={BookmarkCheck} label="내 앨범" hint={`${savedCount}컷`} />
        <Row to="/settings" icon={Settings} label="설정" hint={windowActive ? `받기 ON · ${formatRemaining(allowUntil!)}` : undefined} />
      </nav>

      <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card/70 px-4 py-3 text-sm font-semibold text-muted-foreground">
        <LogOut className="h-4 w-4" /> 로그아웃
      </button>
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