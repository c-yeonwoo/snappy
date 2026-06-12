import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Play, Send, ArrowRight, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snappy — 친구들이 찍어준 스냅샷" },
      { name: "description", content: "친구들이 찍어준 사진을 피드로 받고, 마음에 드는 컷만 골라 소장하세요." },
      { property: "og:title", content: "Snappy — 친구들이 찍어준 스냅샷" },
      { property: "og:description", content: "ID 검색으로 빠르게 보내고, 피드에서 골라 받는 캐주얼 포토 마켓." },
    ],
  }),
  component: Index,
});

// Sample feed preview — overlapping polaroid stack to clearly differ from the in-app grid.
const preview = [
  { tag: "@yuna", tone: "from-brand-soft to-brand", rot: "-rotate-6 -translate-x-6", z: "z-10", video: false },
  { tag: "@minho", tone: "from-brand to-accent", rot: "rotate-3 translate-x-2", z: "z-20", video: false },
  { tag: "@jiwoo", tone: "from-accent/70 to-brand-deep/40", rot: "rotate-12 translate-x-10 translate-y-3", z: "z-0", video: false },
];

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-accent/60 blur-3xl opacity-70" />
      <div aria-hidden className="pointer-events-none absolute top-40 -left-24 h-80 w-80 rounded-full bg-brand blur-3xl opacity-80" />

      <header className="relative mx-auto flex max-w-md items-center justify-between px-4 py-4">
        <Link to="/">
          <Logo className="text-lg" />
        </Link>
        <Link to="/auth" className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
          로그인
        </Link>
      </header>

      <main className="relative mx-auto max-w-md px-4 pb-24">
        {/* Hero with overlapping polaroid stack — distinct from in-app grid */}
        <section className="pt-2">
          <div className="relative mx-auto h-[280px] w-full">
            {preview.map((c, i) => (
              <div
                key={c.tag}
                style={{ left: `${10 + i * 22}%`, top: `${10 + (i % 2) * 18}px` }}
                className={`absolute h-[210px] w-[150px] rounded-[1.25rem] border-4 border-white bg-gradient-to-br ${c.tone} ${c.rot} ${c.z} shadow-[0_20px_40px_-15px_rgba(10,10,10,0.18)] transition`}
              >
                <div className="absolute inset-0 rounded-[0.85rem] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_55%)]" />
                <div className="absolute left-2 top-2 chip !px-1.5 !py-0.5 !text-[10px] !bg-white/90">
                  {c.video ? <Play className="h-2.5 w-2.5" /> : <Camera className="h-2.5 w-2.5" />} {c.tag}
                </div>
              </div>
            ))}
          </div>

          <h1 className="font-display mt-2 text-[2.5rem] font-extrabold leading-[1.05]">
            친구들이 찍어준<br />
            <span className="box-decoration-clone rounded-xl bg-accent/70 px-2 text-foreground">스냅을 모아요.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            ID로 빠르게 보내고, 받은 컷에서 마음에 드는 것만 골라 원본을 가져가세요.
          </p>
        </section>

        {/* Trust row */}
        <section className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Send, t: "ID 한 줄로" },
            { icon: Lock, t: "워터마크 보호" },
            { icon: Users, t: "친구만 받기" },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/70 bg-card/80 p-2.5 text-center backdrop-blur">
              <div className="mx-auto grid h-7 w-7 place-items-center rounded-xl bg-secondary"><f.icon className="h-3.5 w-3.5" /></div>
              <p className="mt-1 text-[11px] font-semibold">{f.t}</p>
            </div>
          ))}
        </section>

        {/* Single primary CTA */}
        <div className="mt-7">
          <Link to="/auth">
            <Button size="lg" className="w-full rounded-full text-base font-bold">
              시작하기 <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            이미 계정이 있으세요? <Link to="/auth" className="font-semibold text-foreground underline-offset-4 hover:underline">로그인</Link>
          </p>
        </div>

        <footer className="mt-10 text-center text-xs text-muted-foreground">made by Snappy</footer>
      </main>
    </div>
  );
}
