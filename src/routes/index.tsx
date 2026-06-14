import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ArrowRight, ImageDown, Vote, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snappy — 남이 찍어준 내 인생샷" },
      { name: "description", content: "친구가 찍어준 내 인생샷을 카톡 화질 말고 원본으로. 찍어준 만큼 크레딧이 쌓여요." },
      { property: "og:title", content: "Snappy — 남이 찍어준 내 인생샷" },
      { property: "og:description", content: "친구가 찍어준 내 사진을 원본으로 받아와, 친구 투표로 고르고 AI로 완성." },
    ],
  }),
  component: Index,
});

// Sample feed preview — overlapping polaroid stack to clearly differ from the in-app grid.
// 고정 너비 무대(STAGE) 위에 px 좌표로 배치 → 디바이스 폭과 무관하게 항상 동일한 구도.
const preview = [
  { tag: "@yuna", img: "/splash/sp1.jpg", left: 0, top: 10, rot: "-rotate-6", z: "z-10" },
  { tag: "@minho", img: "/splash/sp2.jpg", left: 100, top: 32, rot: "rotate-3", z: "z-20" },
  { tag: "@jiwoo", img: "/splash/sp3.jpg", left: 200, top: 4, rot: "rotate-[14deg]", z: "z-0" },
];

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-accent/60 blur-3xl opacity-70" />
      <div aria-hidden className="pointer-events-none absolute top-40 -left-24 h-80 w-80 rounded-full bg-brand blur-3xl opacity-80" />

      <header className="pt-safe relative mx-auto flex max-w-md items-center justify-between px-[18px] py-4">
        <Link to="/">
          <Logo className="text-2xl" />
        </Link>
      </header>

      <main className="relative mx-auto max-w-md px-[18px] pb-12">
        {/* Hero with overlapping polaroid stack — distinct from in-app grid */}
        <section className="pt-20">
          <div className="relative mx-auto h-[270px] w-[340px]">
            {preview.map((c) => (
              <div
                key={c.tag}
                style={{ left: c.left, top: c.top }}
                className={`absolute h-[200px] w-[140px] overflow-hidden rounded-[1.25rem] border-4 border-white ${c.rot} ${c.z} shadow-[0_20px_40px_-15px_rgba(10,10,10,0.25)] transition`}
              >
                <img src={c.img} alt={c.tag} className="h-full w-full object-cover object-top" />
                <div className="absolute left-2 top-2 chip !px-1.5 !py-0.5 !text-[10px] !bg-white/90">
                  <Camera className="h-2.5 w-2.5" /> {c.tag}
                </div>
              </div>
            ))}
          </div>

          <h1 className="font-display mt-6 text-[2.5rem] font-extrabold leading-[1.05]">
            친구가 찍어준<br />
            <span className="box-decoration-clone rounded-xl bg-accent/70 px-2 text-foreground">내 사진, 원본으로.</span>
          </h1>
          <p className="mt-5 text-sm text-muted-foreground">
            워터마크로 미리 보고, 마음에 드는 컷만 <b className="text-foreground">크레딧</b>으로 소장해요.
            카톡 화질 말고 <b className="text-foreground">원본</b>으로.
          </p>
        </section>

        {/* Trust row */}
        <section className="mt-8 grid grid-cols-3 gap-2">
          {[
            { icon: ImageDown, t: "원본 화질로" },
            { icon: Vote, t: "친구가 골라줌" },
            { icon: Sparkles, t: "AI로 완성" },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/70 bg-card/80 p-2.5 text-center backdrop-blur">
              <div className="mx-auto grid h-7 w-7 place-items-center rounded-xl bg-secondary"><f.icon className="h-3.5 w-3.5" /></div>
              <p className="mt-1 text-[11px] font-semibold">{f.t}</p>
            </div>
          ))}
        </section>

        {/* Single primary CTA */}
        <div className="mt-10">
          <Link to="/auth">
            <Button size="lg" className="h-14 w-full rounded-full text-base font-bold">
              시작하기 <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
