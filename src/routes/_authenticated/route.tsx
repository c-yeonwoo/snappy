import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
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
  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/feed" className="flex items-center gap-2 font-semibold">
            <Camera className="h-5 w-5 text-primary" /> SnapBuddy
          </Link>
          <nav className="hidden gap-1 sm:flex">
            <Link to="/feed"><Button variant="ghost" size="sm"><Home className="h-4 w-4 mr-1.5" />피드</Button></Link>
            <Link to="/upload"><Button variant="ghost" size="sm"><ImagePlus className="h-4 w-4 mr-1.5" />업로드</Button></Link>
            <Link to="/sent"><Button variant="ghost" size="sm"><Send className="h-4 w-4 mr-1.5" />보낸 사진</Button></Link>
            <Link to="/profile"><Button variant="ghost" size="sm"><User className="h-4 w-4 mr-1.5" />프로필</Button></Link>
          </nav>
          <Button variant="outline" size="sm" onClick={signOut}>로그아웃</Button>
        </div>
        <nav className="flex justify-around border-t border-border px-2 py-1 sm:hidden">
          <Link to="/feed" className="flex flex-col items-center p-2 text-xs"><Home className="h-4 w-4" />피드</Link>
          <Link to="/upload" className="flex flex-col items-center p-2 text-xs"><ImagePlus className="h-4 w-4" />업로드</Link>
          <Link to="/sent" className="flex flex-col items-center p-2 text-xs"><Send className="h-4 w-4" />보낸</Link>
          <Link to="/profile" className="flex flex-col items-center p-2 text-xs"><User className="h-4 w-4" />프로필</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8"><Outlet /></main>
    </div>
  );
}