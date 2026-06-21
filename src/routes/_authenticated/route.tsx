import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, ImagePlus, Images, User, Bell, Vote } from "lucide-react";
import { getFriends, getMyFeed } from "@/lib/photos.functions";
import { isNew } from "@/lib/format";
import { Logo } from "@/components/logo";

const NOTIF_SEEN_KEY = "snappy_notif_seen_at";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const friendsFn = useServerFn(getFriends);

  // 로그아웃 상태에서 초대 링크를 열어 가입했으면, 로그인 후 클레임 페이지로 자동 복귀
  useEffect(() => {
    const t = localStorage.getItem("snappy_pending_claim");
    if (t) {
      localStorage.removeItem("snappy_pending_claim");
      navigate({ to: "/claim/$token", params: { token: t } });
    }
  }, []);
  const feedFn = useServerFn(getMyFeed);
  const { data: friendsData } = useQuery({ queryKey: ["friends"], queryFn: () => friendsFn() });
  const { data: feedData } = useQuery({ queryKey: ["feed"], queryFn: () => feedFn() });

  // 알림 페이지 방문 시각 추적 — 방문 후엔 배지 제거
  const [seenAt, setSeenAt] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(NOTIF_SEEN_KEY) ?? "0", 10); } catch { return 0; }
  });
  const onNotifPage = loc.pathname === "/notifications";
  useEffect(() => {
    if (onNotifPage) {
      const now = Date.now();
      try { localStorage.setItem(NOTIF_SEEN_KEY, String(now)); } catch {}
      setSeenAt(now);
    }
  }, [onNotifPage]);

  // 친구 요청: pending 수 그대로 (수락/거절하면 자연히 0)
  // 새 사진: seenAt 이후 도착한 것만 카운트
  const pendingFriendReqs = friendsData?.incoming?.length ?? 0;
  const newPhotos = (feedData?.photos ?? []).filter(
    (p) => p.status === "available" && isNew(p.created_at) && new Date(p.created_at).getTime() > seenAt,
  ).length;
  const notifCount = pendingFriendReqs + newPhotos;
  const tabs = [
    { to: "/feed", icon: Inbox, label: "받은함" },
    { to: "/upload", icon: ImagePlus, label: "보내기" },
    { to: "/polls", icon: Vote, label: "고민" },
    { to: "/sent", icon: Images, label: "보낸 사진" },
    { to: "/profile", icon: User, label: "나" },
  ] as const;
  const active = (to: string) => loc.pathname === to || loc.pathname.startsWith(to + "/");
  return (
    <div className="min-h-screen pb-32">
      <header className="pt-safe fixed left-1/2 top-0 z-40 w-full max-w-[480px] -translate-x-1/2 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-[18px] py-3">
          <Link to="/feed">
            <Logo />
          </Link>
          <Link to="/notifications" aria-label="알림" className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition active:scale-95 hover:bg-secondary">
            <Bell className="h-5 w-5" />
            {notifCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-[18px] pb-6 pt-[calc(env(safe-area-inset-top)+3.75rem)]"><Outlet /></main>
      {/* bottom tab bar (mobile-only nav) — 홈바 안전영역만큼 띄움 */}
      <nav className="fixed inset-x-0 z-30 mx-auto flex max-w-xs items-center justify-around gap-1 rounded-full border border-white/70 bg-card/90 px-2 py-1.5 shadow-[0_20px_50px_-20px_rgba(10,10,10,0.18)] backdrop-blur-xl" style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={`flex flex-1 flex-col items-center rounded-full px-2 py-1.5 text-[10px] font-semibold ${active(t.to) ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}