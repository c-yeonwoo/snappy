import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ArrowRight, Coins, CheckCheck, ShieldCheck } from "lucide-react";
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

      <header className="relative mx-auto flex max-w-md items-center justify-between px-[18px] py-4">
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
            찍어주고,<br />
            <span className="box-decoration-clone rounded-xl bg-accent/70 px-2 text-foreground">골라 받아요.</span>
          </h1>
          <p className="mt-5 text-sm text-muted-foreground">
            친구가 보낸 스냅에서 마음에 드는 컷만 소장하고, 원본을 가져가세요.
          </p>
        </section>

        {/* Trust row */}
        <section className="mt-8 grid grid-cols-3 gap-2">
          {[
            { icon: Coins, t: "찍을수록 수익" },
            { icon: CheckCheck, t: "마음에 드는 컷만" },
            { icon: ShieldCheck, t: "원본은 안전하게" },
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
