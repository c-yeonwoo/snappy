import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Heart, ImagePlus, Sparkles, Play, Coins, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snappy — 친구가 찍어준 스냅샷" },
      { name: "description", content: "친구가 찍어준 사진·영상을 피드로 받고, 마음에 드는 컷만 골라 구매하세요." },
      { property: "og:title", content: "Snappy — 친구가 찍어준 스냅샷" },
      { property: "og:description", content: "ID 검색으로 빠르게 보내고, 피드에서 골라 받는 캐주얼 포토 마켓." },
    ],
  }),
  component: Index,
});

const mock = [
  { tag: "@yuna", emo: "🌊", price: 3, video: false },
  { tag: "@minho", emo: "🎞️", price: 5, video: true },
  { tag: "@jiwoo", emo: "🌸", price: 4, video: false },
  { tag: "@sora", emo: "☁️", price: 3, video: false },
  { tag: "@dan", emo: "🐬", price: 6, video: true },
  { tag: "@hye", emo: "🪩", price: 4, video: false },
];

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-accent/60 blur-3xl opacity-70" />
      <div aria-hidden className="pointer-events-none absolute top-40 -left-24 h-80 w-80 rounded-full bg-sky blur-3xl opacity-80" />

      <header className="relative mx-auto flex max-w-md items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Camera className="h-4 w-4" />
          </span>
          snappy
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm" className="rounded-full">로그인</Button></Link>
          <Link to="/auth"><Button size="sm" className="rounded-full px-4">시작</Button></Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-md px-5 pb-24">
        <section className="pt-3">
          <span className="chip"><Sparkles className="h-3.5 w-3.5" /> 친구가 찍어준 스냅</span>
          <h1 className="font-display mt-3 text-4xl font-extrabold leading-[1.05]">
            맘에 드는 컷만<br />
            <span className="bg-gradient-to-r from-primary to-sky-deep bg-clip-text text-transparent">가져가요.</span>
          </h1>
        </section>

        {/* Quick send — ID 검색 강조 */}
        <section className="mt-5 rounded-[1.75rem] border border-white/70 bg-card/90 p-4 shadow-[0_20px_50px_-25px_rgba(56,189,248,0.45)] backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground"><Send className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold">빠르게 보내기</p>
              <p className="text-[11px] text-muted-foreground">받는 사람 ID만 알면 끝</p>
            </div>
          </div>
          <Link to="/auth" className="mt-3 flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span className="truncate">@핸들 검색해서 톡 보내기</span>
            <kbd className="ml-auto rounded bg-card px-1.5 py-0.5 text-[10px] font-bold text-foreground">→</kbd>
          </Link>
        </section>

        {/* Sample feed mock */}
        <section className="mt-6">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="font-display text-sm font-bold">@me 의 피드 (예시)</p>
            <span className="text-[11px] text-muted-foreground">{mock.length} 컷</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {mock.map((c, i) => (
              <div key={c.tag + i} className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] border border-white/70 bg-gradient-to-br from-sky-soft to-sky shadow-[0_12px_30px_-15px_rgba(56,189,248,0.45)]">
                <div className="absolute inset-0 grid place-items-center text-4xl opacity-90">{c.emo}</div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_22px,rgba(255,255,255,0.4)_22px_24px)]" />
                <div className="absolute left-2 top-2 chip !px-1.5 !py-0.5 !text-[10px] !bg-white/90 !backdrop-blur">
                  {c.video ? <Play className="h-2.5 w-2.5" /> : <Camera className="h-2.5 w-2.5" />} {c.tag}
                </div>
                <div className="absolute bottom-2 right-2 rounded-full bg-foreground/85 px-1.5 py-0.5 text-[10px] font-bold text-background">${c.price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Tiny how it works */}
        <section className="mt-7 grid grid-cols-3 gap-2">
          {[
            { icon: ImagePlus, t: "보내기", b: "ID 검색" },
            { icon: Heart, t: "고르기", b: "워터마크" },
            { icon: Coins, t: "결제", b: "원본 GET" },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/70 bg-card/80 p-3 text-center backdrop-blur">
              <div className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-secondary"><f.icon className="h-4 w-4" /></div>
              <p className="font-display mt-1.5 text-xs font-bold">{f.t}</p>
              <p className="text-[10px] text-muted-foreground">{f.b}</p>
            </div>
          ))}
        </section>

        <div className="mt-7 flex flex-col gap-2">
          <Link to="/auth"><Button size="lg" className="w-full rounded-full">무료로 시작</Button></Link>
          <Link to="/auth"><Button size="lg" variant="outline" className="w-full rounded-full bg-card">로그인</Button></Link>
        </div>

        <footer className="mt-10 text-center text-xs text-muted-foreground">made by snappy</footer>
      </main>
    </div>
  );
}
