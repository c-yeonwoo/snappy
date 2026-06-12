import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/photos.functions";
import { supabase } from "@/integrations/supabase/client";
import { useFriendsStore, formatRemaining } from "@/lib/friends-mock";
import { usePurchased, MOCK_PHOTOS } from "@/lib/mock-feed";
import { Settings, Users, ChevronRight, LogOut, BookmarkCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "나 — Snappy" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const router = useRouter();
  const fetchProfile = useServerFn(getMyProfile);
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const { friends, windowUntil } = useFriendsStore();
  const purchased = usePurchased();
  const savedCount = MOCK_PHOTOS.filter((p) => purchased.has(p.id)).length;

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  const handle = data?.profile?.handle ?? "me";
  const displayName = data?.profile?.display_name ?? "내 이름";

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* Identity card */}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-gradient-to-br from-sky-soft via-card to-accent/40 p-6 backdrop-blur">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/30 blur-3xl" />
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-foreground text-2xl font-display font-extrabold text-background">
            {displayName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-xl font-extrabold">{displayName}</p>
            <p className="truncate text-sm text-muted-foreground">@{handle}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="친구" value={friends.length} />
          <Stat label="보관" value={savedCount} />
          <Stat label="받기" value={windowUntil ? "ON" : "친구만"} />
        </div>
      </section>

      {/* Menu */}
      <nav className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 backdrop-blur">
        <Row to="/friends" icon={Users} label="친구" hint={`${friends.length}명`} />
        <Row to="/feed" icon={BookmarkCheck} label="내 앨범" hint={`${savedCount}컷`} />
        <Row to="/settings" icon={Settings} label="설정" hint={windowUntil ? `받기 ON · ${formatRemaining(windowUntil)}` : undefined} />
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