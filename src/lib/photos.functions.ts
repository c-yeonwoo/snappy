import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EARNING_RATE = 0.7;

export const searchProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const q = data.q.trim().toLowerCase();
    const { data: rows, error } = await context.supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq("id", context.userId)
      .limit(10);
    if (error) throw new Error(error.message);
    return { results: rows ?? [] };
  });

export const createPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        subject_id: z.string().uuid(),
        original_path: z.string().min(3).max(500),
        watermarked_path: z.string().min(3).max(500),
        price_won: z.number().int().min(1000).max(1000000),
        note: z.string().max(280).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.subject_id === context.userId) {
      throw new Error("Cannot send a photo to yourself");
    }

    // 전송 권한 검증: 받는 사람과 양방향 친구이거나, 받는 사람이 받기 설정을 열어둔 경우만.
    const { data: subj } = await context.supabase
      .from("profiles")
      .select("allow_until")
      .eq("id", data.subject_id)
      .single();
    const allowOpen = !!subj?.allow_until && new Date(subj.allow_until).getTime() > Date.now();
    if (!allowOpen) {
      const { data: fr } = await context.supabase
        .from("friendships")
        .select("id")
        .eq("status", "accepted")
        .or(
          `and(requester_id.eq.${context.userId},addressee_id.eq.${data.subject_id}),and(requester_id.eq.${data.subject_id},addressee_id.eq.${context.userId})`,
        )
        .maybeSingle();
      if (!fr) throw new Error("받는 사람과 친구가 아니거나, 받는 사람의 받기 설정이 닫혀 있어요");
    }

    const { data: row, error } = await context.supabase
      .from("photos")
      .insert({
        uploader_id: context.userId,
        subject_id: data.subject_id,
        original_path: data.original_path,
        watermarked_path: data.watermarked_path,
        price_won: data.price_won,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getMyFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: photos, error } = await context.supabase
      .from("photos")
      .select("id, uploader_id, watermarked_path, price_won, status, note, created_at")
      .eq("subject_id", context.userId)
      .neq("status", "removed")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const uploaderIds = Array.from(new Set((photos ?? []).map((p) => p.uploader_id)));
    const profilesMap: Record<string, { handle: string; display_name: string; avatar_url: string | null }> = {};
    if (uploaderIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", uploaderIds);
      for (const p of profs ?? []) profilesMap[p.id] = { handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url };
    }

    // signed urls for previews — 한 번의 batch 호출로 생성 (N+1 round-trip 방지)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const list = photos ?? [];
    const signed = list.length
      ? (await supabaseAdmin.storage.from("photos-watermarked").createSignedUrls(list.map((p) => p.watermarked_path), 60 * 60)).data ?? []
      : [];
    const enriched = list.map((p, i) => ({
      ...p,
      preview_url: signed[i]?.signedUrl ?? null,
      uploader: profilesMap[p.uploader_id] ?? null,
    }));
    return { photos: enriched };
  });

export const getMySent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: photos, error } = await context.supabase
      .from("photos")
      .select("id, subject_id, watermarked_path, price_won, status, created_at")
      .eq("uploader_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const subjectIds = Array.from(new Set((photos ?? []).map((p) => p.subject_id)));
    const profilesMap: Record<string, { handle: string; display_name: string }> = {};
    if (subjectIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, handle, display_name")
        .in("id", subjectIds);
      for (const p of profs ?? []) profilesMap[p.id] = { handle: p.handle, display_name: p.display_name };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const list = photos ?? [];
    const signed = list.length
      ? (await supabaseAdmin.storage.from("photos-watermarked").createSignedUrls(list.map((p) => p.watermarked_path), 60 * 60)).data ?? []
      : [];
    const enriched = list.map((p, i) => ({
      ...p,
      preview_url: signed[i]?.signedUrl ?? null,
      subject: profilesMap[p.subject_id] ?? null,
    }));

    // earnings
    const { data: earnRows } = await context.supabase
      .from("purchases")
      .select("uploader_earning_won, status")
      .eq("uploader_id", context.userId)
      .eq("status", "completed");
    const earnings_won = (earnRows ?? []).reduce((sum, r) => sum + (r.uploader_earning_won ?? 0), 0);

    return { photos: enriched, earnings_won };
  });

export const getPhotoDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: photo, error } = await context.supabase
      .from("photos")
      .select("id, uploader_id, subject_id, watermarked_path, price_won, status, note, created_at")
      .eq("id", data.id)
      .single();
    if (error || !photo) throw new Error("Photo not found");

    const { data: uploader } = await context.supabase
      .from("profiles")
      .select("handle, display_name, avatar_url")
      .eq("id", photo.uploader_id)
      .single();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signedPreview } = await supabaseAdmin.storage
      .from("photos-watermarked")
      .createSignedUrl(photo.watermarked_path, 60 * 60);

    // if user is subject and photo is sold, also give original
    let original_url: string | null = null;
    if (photo.subject_id === context.userId && photo.status === "sold") {
      const { data: purch } = await context.supabase
        .from("purchases")
        .select("id")
        .eq("photo_id", photo.id)
        .eq("buyer_id", context.userId)
        .eq("status", "completed")
        .maybeSingle();
      if (purch) {
        const { data: og } = await supabaseAdmin.storage
          .from("photos-original")
          .createSignedUrl((await getOriginalPath(photo.id)) ?? "", 60 * 10);
        original_url = og?.signedUrl ?? null;
      }
    }

    return {
      photo: {
        ...photo,
        preview_url: signedPreview?.signedUrl ?? null,
        uploader,
        original_url,
        is_subject: photo.subject_id === context.userId,
        is_uploader: photo.uploader_id === context.userId,
      },
    };
  });

async function getOriginalPath(photoId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("photos").select("original_path").eq("id", photoId).single();
  return data?.original_path ?? null;
}

export const purchasePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: photo, error } = await supabaseAdmin
      .from("photos")
      .select("id, uploader_id, subject_id, price_won, status, original_path")
      .eq("id", data.id)
      .single();
    if (error || !photo) throw new Error("Photo not found");
    if (photo.subject_id !== context.userId) throw new Error("Only the photo subject can purchase");
    if (photo.status !== "available") throw new Error("Photo is not available");

    const earning = Math.floor(photo.price_won * EARNING_RATE);

    // NOTE: 토스페이먼츠 결제 연동은 다음 단계. MVP에서는 즉시 completed 처리.
    const { error: insErr } = await supabaseAdmin.from("purchases").insert({
      photo_id: photo.id,
      buyer_id: context.userId,
      uploader_id: photo.uploader_id,
      amount_won: photo.price_won,
      uploader_earning_won: earning,
      status: "completed",
    });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("photos").update({ status: "sold" }).eq("id", photo.id);

    const { data: signed } = await supabaseAdmin.storage
      .from("photos-original")
      .createSignedUrl(photo.original_path, 60 * 10);

    return { original_url: signed?.signedUrl ?? null };
  });

export const reportPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), reason: z.string().min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reports").insert({
      photo_id: data.id,
      reporter_id: context.userId,
      reason: data.reason,
    });
    if (error) throw new Error(error.message);
    // also remove from feed
    await context.supabase.from("photos").update({ status: "removed" }).eq("id", data.id);
    return { ok: true };
  });

export const removePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("photos")
      .update({ status: "removed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, allow_until")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return { profile: data };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        handle: z.string().min(2).max(32).regex(/^[a-z0-9_]+$/),
        display_name: z.string().min(1).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ handle: data.handle, display_name: data.display_name })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----------------- 친구 (D8: 양방향 친구) -----------------

type FriendProfile = { id: string; handle: string; display_name: string; avatar_url: string | null };

export const getFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = context.userId;
    const { data: rows, error } = await context.supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
    if (error) throw new Error(error.message);

    // 상대 id 모으기
    const otherOf = (r: { requester_id: string; addressee_id: string }) =>
      r.requester_id === me ? r.addressee_id : r.requester_id;
    const ids = Array.from(new Set((rows ?? []).map(otherOf)));
    const profilesMap: Record<string, FriendProfile> = {};
    if (ids.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", ids);
      for (const p of profs ?? []) profilesMap[p.id] = p as FriendProfile;
    }

    const friends: FriendProfile[] = [];
    const incoming: FriendProfile[] = []; // 내가 받은 요청 (수락 대기)
    const outgoing: FriendProfile[] = []; // 내가 보낸 요청 (상대 수락 대기)
    for (const r of rows ?? []) {
      const other = profilesMap[otherOf(r)];
      if (!other) continue;
      if (r.status === "accepted") friends.push(other);
      else if (r.addressee_id === me) incoming.push(other);
      else outgoing.push(other);
    }
    return { friends, incoming, outgoing };
  });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ to_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    if (data.to_id === me) throw new Error("자기 자신에게는 요청할 수 없어요");

    // 상대가 이미 나에게 요청해둔 게 있으면 → 바로 수락(양방향 성립)
    const { data: reverse } = await context.supabase
      .from("friendships")
      .select("id, status")
      .eq("requester_id", data.to_id)
      .eq("addressee_id", me)
      .maybeSingle();
    if (reverse) {
      if (reverse.status !== "accepted") {
        await context.supabase.from("friendships").update({ status: "accepted" }).eq("id", reverse.id);
      }
      return { status: "accepted" as const };
    }

    const { error } = await context.supabase
      .from("friendships")
      .upsert(
        { requester_id: me, addressee_id: data.to_id, status: "pending" },
        { onConflict: "requester_id,addressee_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { status: "pending" as const };
  });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ from_id: z.string().uuid(), accept: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    if (data.accept) {
      const { error } = await context.supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("requester_id", data.from_id)
        .eq("addressee_id", me)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("friendships")
        .delete()
        .eq("requester_id", data.from_id)
        .eq("addressee_id", me);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ other_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const { error } = await context.supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${me},addressee_id.eq.${data.other_id}),and(requester_id.eq.${data.other_id},addressee_id.eq.${me})`,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAllowWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ minutes: z.number().int().min(0).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const allow_until = data.minutes > 0 ? new Date(Date.now() + data.minutes * 60_000).toISOString() : null;
    const { error } = await context.supabase
      .from("profiles")
      .update({ allow_until })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { allow_until };
  });