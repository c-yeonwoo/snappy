import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Home, ImagePlus, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const router = useRouter();
  const loc = useLocation();
  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }
  const tabs = [
    { to: "/feed", icon: Home, label: "피드" },
    { to: "/upload", icon: ImagePlus, label: "보내기" },
    { to: "/sent", icon: Send, label: "보낸함" },
    { to: "/profile", icon: User, label: "나" },
  ] as const;
  const active = (to: string) => loc.pathname === to;
  return (
    <div className="min-h-screen pb-24 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/feed" className="flex items-center gap-2 font-display font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-2xl bg-foreground text-background">
              <Camera className="h-4 w-4" />
            </span>
            SnapBuddy
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {tabs.map((t) => (
              <Link key={t.to} to={t.to}>
                <Button variant={active(t.to) ? "default" : "ghost"} size="sm" className="rounded-full">
                  <t.icon className="mr-1.5 h-4 w-4" />{t.label}
                </Button>
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut} className="rounded-full text-muted-foreground">로그아웃</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10"><Outlet /></main>
      {/* bottom tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-3 z-30 mx-auto flex max-w-xs items-center justify-around gap-1 rounded-full border border-white/70 bg-card/90 px-2 py-1.5 shadow-[0_20px_50px_-20px_rgba(125,160,200,0.5)] backdrop-blur-xl sm:hidden">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={`flex flex-1 flex-col items-center rounded-full px-2 py-1.5 text-[10px] font-semibold ${active(t.to) ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}