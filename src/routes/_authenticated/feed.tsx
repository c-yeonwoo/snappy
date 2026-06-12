import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyFeed } from "@/lib/photos.functions";
import { ImageOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "내 피드 — SnapBuddy" }] }),
  component: FeedPage,
});

function FeedPage() {
  const fetchFeed = useServerFn(getMyFeed);
  const { data, isLoading } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });

  if (isLoading) return <p className="text-muted-foreground">불러오는 중…</p>;
  const photos = data?.photos ?? [];

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <ImageOff className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">아직 받은 사진이 없어요</h2>
        <p className="mt-1 text-sm text-muted-foreground">친구가 SnapBuddy로 사진을 보내면 여기 도착해요.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">내 피드</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <Link key={p.id} to="/photo/$id" params={{ id: p.id }} className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
            <div className="aspect-[4/5] overflow-hidden bg-muted">
              {p.preview_url ? (
                <img src={p.preview_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : null}
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="text-sm">
                <p className="font-medium">@{p.uploader?.handle ?? "?"}</p>
                <p className="text-xs text-muted-foreground">{p.status === "sold" ? "구매 완료" : "구매 가능"}</p>
              </div>
              <p className="font-semibold text-primary">${(p.price_cents / 100).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}