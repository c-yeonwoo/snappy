// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getMyProfile, updateMyProfile, setAllowWindow, getBlockedUsers, unblockUser, deleteMyAccount } from "@/lib/photos.functions";
import { ConfirmModal } from "@/components/confirm-modal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatRemaining, isWindowOpen } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Radio, ShieldCheck, UserX, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "설정 — Snappy" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const fetchProfile = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const setWindow = useServerFn(setAllowWindow);
  const fetchBlocked = useServerFn(getBlockedUsers);
  const unblock = useServerFn(unblockUser);
  const deleteAccount = useServerFn(deleteMyAccount);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const { data: blocked } = useQuery({ queryKey: ["blocked-users"], queryFn: () => fetchBlocked() });
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleUnblock(userId: string) {
    try {
      await unblock({ data: { user_id: userId } });
      qc.invalidateQueries({ queryKey: ["blocked-users"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success("차단을 해제했어요");
    } catch (e: any) {
      toast.error(e?.message ?? "해제 실패");
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      toast.success("계정이 삭제됐어요");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
      setDeleting(false);
    }
  }

  const allowUntil = data?.profile?.allow_until ?? null;
  const windowActive = isWindowOpen(allowUntil);
  useNow(windowActive); // 카운트다운 갱신

  useEffect(() => {
    if (data?.profile) {
      setHandle(data.profile.handle);
      setDisplayName(data.profile.display_name);
    }
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update({ data: { handle, display_name: displayName } });
      toast.success("저장됐어요");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    }
  }

  async function toggleWindow(on: boolean) {
    try {
      await setWindow({ data: { minutes: on ? 10 : 0 } });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e: any) {
      toast.error(e?.message ?? "변경 실패");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 나
      </Link>
      <h1 className="font-display text-3xl font-extrabold">설정</h1>

      <form onSubmit={save} className="space-y-4 rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">프로필</p>
        <div>
          <Label htmlFor="handle">핸들 (영문/숫자/_)</Label>
          <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} pattern="[a-z0-9_]+" minLength={2} maxLength={32} required className="mt-2 rounded-full" />
        </div>
        <div>
          <Label htmlFor="dn">표시 이름</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={64} className="mt-2 rounded-full" />
        </div>
        <Button type="submit" className="w-full rounded-full">저장</Button>
      </form>

      <section className="rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> 받기 설정</p>
            <h2 className="font-display mt-1 text-base font-extrabold">친구가 아닌 사람도 10분 동안 받기</h2>
            <p className="mt-1 text-xs text-muted-foreground">기본은 친구만. 켜는 동안만 누구나 보낼 수 있어요.</p>
          </div>
          <Switch checked={windowActive} onCheckedChange={toggleWindow} />
        </div>
        {windowActive && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> 열려 있음</span>
            <span className="font-display text-lg font-extrabold tabular-nums">{formatRemaining(allowUntil!)}</span>
          </div>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-white/70 bg-card/90 p-5 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><UserX className="h-3.5 w-3.5" /> 차단한 사용자</p>
        {(blocked?.users?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">차단한 사용자가 없어요. 받은 사진 상세에서 부적절한 사용자를 차단할 수 있어요.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {blocked!.users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.display_name}</p>
                  {u.handle && <p className="truncate text-xs text-muted-foreground">@{u.handle}</p>}
                </div>
                <button onClick={() => handleUnblock(u.id)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
                  차단 해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-destructive/30 bg-card/90 p-5 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-wide text-destructive flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> 계정 삭제</p>
        <p className="mt-1 text-xs text-muted-foreground">계정과 업로드한 모든 사진·데이터가 영구 삭제돼요. 되돌릴 수 없어요.</p>
        <button onClick={() => setConfirmDelete(true)} className="mt-3 w-full rounded-full border border-destructive py-2.5 text-sm font-semibold text-destructive">
          계정 삭제(탈퇴)
        </button>
      </section>

      <ConfirmModal
        open={confirmDelete}
        title="정말 계정을 삭제할까요?"
        description="계정과 업로드한 모든 사진·크레딧·기록이 영구적으로 삭제되고 복구할 수 없어요."
        confirmLabel="삭제하기"
        cancelLabel="취소"
        destructive
        busy={deleting}
        onConfirm={handleDeleteAccount}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
