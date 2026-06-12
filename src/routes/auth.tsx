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
      <header className="relative mx-auto w-full max-w-6xl px-4 py-5">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md rounded-[1.75rem] border border-white/60 bg-card/90 p-7 shadow-[0_30px_80px_-30px_rgba(10,10,10,0.18)] backdrop-blur">
          <span className="chip">어서와요</span>
          <h1 className="font-display mt-3 text-3xl font-extrabold">시작해볼까요?</h1>
          <p className="mt-1 text-sm text-muted-foreground">이메일로 가입하고 사진을 주고받아요.</p>
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
        </div>
      </main>
    </div>
  );
}