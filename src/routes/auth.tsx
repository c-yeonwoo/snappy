import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "로그인 — Snappy" }, { name: "description", content: "Snappy에 로그인하거나 새 계정을 만드세요." }] }),
  component: AuthPage,
});

// Supabase 인증 에러(영어/코드)를 한글로 변환
function authErrorKo(error: { code?: string; message?: string } | null, fallback: string): string {
  const code = error?.code ?? "";
  const msg = (error?.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "이메일 또는 비밀번호가 올바르지 않아요";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "이메일 인증이 필요해요. 메일함을 확인해 주세요";
  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already been registered")) return "이미 가입된 이메일이에요";
  if (code === "weak_password" || msg.includes("password should be")) return "비밀번호가 너무 짧아요 (8자 이상)";
  if (code === "over_request_rate_limit" || msg.includes("rate limit")) return "요청이 많아요. 잠시 후 다시 시도해 주세요";
  if (code === "validation_failed" || msg.includes("unable to validate email") || msg.includes("invalid email")) return "이메일 형식을 확인해 주세요";
  return fallback;
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(authErrorKo(error, "로그인에 실패했어요. 잠시 후 다시 시도해 주세요"));
    navigate({ to: "/feed" });
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/feed` },
    });
  }

  async function signInWithKakao() {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/feed` },
    });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
    setLoading(false);
    if (error) return toast.error(authErrorKo(error, "가입에 실패했어요. 잠시 후 다시 시도해 주세요"));
    toast.success("계정이 생성되었어요!");
    navigate({ to: "/feed" });
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-brand blur-3xl opacity-60" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 -left-20 h-80 w-80 rounded-full bg-accent/50 blur-3xl opacity-60" />
      <header className="pt-safe relative mx-auto w-full max-w-md px-[18px] py-5">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-[18px] pb-16">
        <div className="w-full max-w-md rounded-[1.75rem] border border-white/60 bg-card/90 p-7 shadow-[0_30px_80px_-30px_rgba(10,10,10,0.18)] backdrop-blur">
          <span className="chip">어서와요</span>
          <h1 className="font-display mt-3 text-3xl font-extrabold">시작해볼까요?</h1>
          <p className="mt-1 text-sm text-muted-foreground">친구가 찍어준 내 인생샷, 원본으로 받아와요.</p>
          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-secondary p-1">
              <TabsTrigger value="signin">로그인</TabsTrigger>
              <TabsTrigger value="signup">가입</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>로그인</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">이메일</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">비밀번호</Label>
                  <Input id="password2" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full rounded-full" disabled={loading}>가입하기</Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* OAuth */}
          <div className="relative my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">또는</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2.5">
            {/* 카카오 */}
            <button onClick={signInWithKakao} className="flex w-full items-center gap-3 rounded-2xl bg-[#FEE500] px-4 py-[9px] text-sm font-bold text-[#191919] transition active:scale-[0.99]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="#191919">
                <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.56 5.08 3.94 6.56L4.8 21l4.32-2.3c.9.24 1.86.37 2.88.37 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
              </svg>
              <span className="flex-1 text-center">카카오로 로그인</span>
            </button>
            {/* 구글 */}
            <button onClick={signInWithGoogle} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-4 py-[9px] text-sm font-bold text-foreground transition active:scale-[0.99]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="flex-1 text-center">구글로 로그인</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}