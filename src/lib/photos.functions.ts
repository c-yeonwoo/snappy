import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EARNING_RATE = 0.7;

// DB/스토리지 오류는 사용자에겐 한글 일반 메시지로 노출하고, 원본은 서버 로그로 남긴다.
function dbError(e: { message?: string } | null | undefined) {
  console.error("[supabase]", e?.message);
  return new Error("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

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
    if (error) throw dbError(error);
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
        batch_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.subject_id === context.userId) {
      throw new Error("자기 자신에게는 보낼 수 없어요");
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
        batch_id: data.batch_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw dbError(error);
    return { id: row.id };
  });

export const getMyFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: photos, error } = await context.supabase
      .from("photos")
      .select("id, uploader_id, watermarked_path, original_path, price_won, status, note, created_at, batch_id")
      .eq("subject_id", context.userId)
      .neq("status", "removed")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw dbError(error);

    const uploaderIds = Array.from(new Set((photos ?? []).map((p) => p.uploader_id)));
    const profilesMap: Record<string, { handle: string; display_name: string; avatar_url: string | null }> = {};
    if (uploaderIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", uploaderIds);
      for (const p of profs ?? []) profilesMap[p.id] = { handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url };
    }

    // signed urls — batch 호출 (N+1 방지)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const list = photos ?? [];
    // 워터마크 미리보기 (전체)
    const wm = list.length
      ? (await supabaseAdmin.storage.from("photos-watermarked").createSignedUrls(list.map((p) => p.watermarked_path), 60 * 60)).data ?? []
      : [];
    // 원본 (이미 구매=sold 인 것만 — 내가 원본을 소유하므로 앨범에서 워터마크 없이 표시)
    const soldIdx = list.map((p, i) => (p.status === "sold" ? i : -1)).filter((i) => i >= 0);
    const og = soldIdx.length
      ? (await supabaseAdmin.storage.from("photos-original").createSignedUrls(soldIdx.map((i) => list[i].original_path), 60 * 60)).data ?? []
      : [];
    const ogByIdx: Record<number, string | null> = {};
    soldIdx.forEach((idx, k) => { ogByIdx[idx] = og[k]?.signedUrl ?? null; });
    const enriched = list.map((p, i) => {
      const { original_path, ...rest } = p; // 원본 경로는 클라에 노출하지 않음
      return {
        ...rest,
        preview_url: wm[i]?.signedUrl ?? null,
        original_url: ogByIdx[i] ?? null, // sold 가 아니면 null
        uploader: profilesMap[p.uploader_id] ?? null,
      };
    });
    return { photos: enriched };
  });

export const getMySent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: photos, error } = await context.supabase
      .from("photos")
      .select("id, subject_id, original_path, price_won, status, created_at, batch_id")
      .eq("uploader_id", context.userId)
      .neq("uploader_hidden" as any, true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw dbError(error);

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
    // 보낸 사람은 원본(워터마크 없는) 이미지로 썸네일 표시
    const signed = list.length
      ? (await supabaseAdmin.storage.from("photos-original").createSignedUrls(list.map((p) => p.original_path), 60 * 60)).data ?? []
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
    if (error || !photo) throw new Error("사진을 찾을 수 없어요");

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
    if (error || !photo) throw new Error("사진을 찾을 수 없어요");
    if (photo.subject_id !== context.userId) throw new Error("받는 사람만 소장할 수 있어요");
    if (photo.status !== "available") throw new Error("이미 소장되었거나 받을 수 없는 사진이에요");

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
    if (insErr) throw dbError(insErr);

    await supabaseAdmin.from("photos").update({ status: "sold" }).eq("id", photo.id);

    const { data: signed } = await supabaseAdmin.storage
      .from("photos-original")
      .createSignedUrl(photo.original_path, 60 * 10);

    return { original_url: signed?.signedUrl ?? null };
  });

// 묶음 상세 — 받는 사람이 한 묶음(batch)의 사진들을 슬라이더로 보며 고른다.
export const getBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ batch_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: photos, error } = await context.supabase
      .from("photos")
      .select("id, uploader_id, subject_id, watermarked_path, original_path, price_won, status, note, created_at")
      .eq("batch_id", data.batch_id)
      .eq("subject_id", context.userId)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    if (error) throw dbError(error);
    const list = photos ?? [];
    if (list.length === 0) throw new Error("묶음을 찾을 수 없어요");

    const { data: uploader } = await context.supabase
      .from("profiles")
      .select("handle, display_name, avatar_url")
      .eq("id", list[0].uploader_id)
      .single();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wm = (await supabaseAdmin.storage.from("photos-watermarked").createSignedUrls(list.map((p) => p.watermarked_path), 60 * 60)).data ?? [];
    const soldIdx = list.map((p, i) => (p.status === "sold" ? i : -1)).filter((i) => i >= 0);
    const og = soldIdx.length
      ? (await supabaseAdmin.storage.from("photos-original").createSignedUrls(soldIdx.map((i) => list[i].original_path), 60 * 60)).data ?? []
      : [];
    const ogByIdx: Record<number, string | null> = {};
    soldIdx.forEach((idx, k) => { ogByIdx[idx] = og[k]?.signedUrl ?? null; });

    const items = list.map((p, i) => ({
      id: p.id,
      status: p.status,
      price_won: p.price_won,
      note: p.note,
      created_at: p.created_at,
      is_owned: p.status === "sold",
      preview_url: wm[i]?.signedUrl ?? null,
      original_url: ogByIdx[i] ?? null,
    }));
    return { uploader, photos: items };
  });

// 보낸 사람용 묶음 상세 — 내가 보낸 묶음의 컷·상태·가격 확인.
// id는 batch_id(묶음) 또는 photo_id(단건, batch_id가 없는 구형 데이터) 모두 허용.
export const getSentBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ batch_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // 1차: batch_id로 조회
    let { data: photos, error } = await context.supabase
      .from("photos")
      .select("id, subject_id, original_path, price_won, status, created_at")
      .eq("batch_id", data.batch_id)
      .eq("uploader_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw dbError(error);
    // 2차: 결과 없으면 photo_id로 fallback (batch_id가 null인 구형 단건 사진)
    if (!photos || photos.length === 0) {
      const { data: single, error: e2 } = await context.supabase
        .from("photos")
        .select("id, subject_id, original_path, price_won, status, created_at")
        .eq("id", data.batch_id)
        .eq("uploader_id", context.userId)
        .limit(1);
      if (e2) throw dbError(e2);
      photos = single ?? [];
    }
    const list = photos ?? [];
    if (list.length === 0) throw new Error("묶음을 찾을 수 없어요");

    const { data: subject } = await context.supabase
      .from("profiles")
      .select("handle, display_name, avatar_url")
      .eq("id", list[0].subject_id)
      .single();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // 보낸 사람용 — 원본 이미지로 표시
    const orig = (await supabaseAdmin.storage.from("photos-original").createSignedUrls(list.map((p) => p.original_path), 60 * 60)).data ?? [];
    const items = list.map((p, i) => ({ id: p.id, status: p.status, price_won: p.price_won, preview_url: orig[i]?.signedUrl ?? null }));
    return { subject, photos: items };
  });

// 묶음의 '대기 중' 컷 가격 일괄 변경 (소장된 컷은 유지).
export const updateBatchPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ batch_id: z.string().uuid(), price_won: z.number().int().min(1000).max(1000000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("photos")
      .update({ price_won: data.price_won })
      .eq("batch_id", data.batch_id)
      .eq("uploader_id", context.userId)
      .eq("status", "available");
    if (error) throw dbError(error);
    return { ok: true };
  });

// 묶음에서 선택한 사진들만 결제. 항목별로 검증 후 성공분만 반환.
export const purchasePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: { id: string; original_url: string | null }[] = [];
    for (const id of data.ids) {
      const { data: photo, error } = await supabaseAdmin
        .from("photos")
        .select("id, uploader_id, subject_id, price_won, status, original_path")
        .eq("id", id)
        .single();
      if (error || !photo) continue;
      if (photo.subject_id !== context.userId || photo.status !== "available") continue;
      const earning = Math.floor(photo.price_won * EARNING_RATE);
      const { error: insErr } = await supabaseAdmin.from("purchases").insert({
        photo_id: photo.id,
        buyer_id: context.userId,
        uploader_id: photo.uploader_id,
        amount_won: photo.price_won,
        uploader_earning_won: earning,
        status: "completed",
      });
      if (insErr) continue;
      await supabaseAdmin.from("photos").update({ status: "sold" }).eq("id", photo.id);
      const { data: signed } = await supabaseAdmin.storage.from("photos-original").createSignedUrl(photo.original_path, 60 * 10);
      results.push({ id: photo.id, original_url: signed?.signedUrl ?? null });
    }
    if (results.length === 0) throw new Error("소장할 수 있는 사진이 없어요");
    return { results };
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
    if (error) throw dbError(error);
    // 신고된 사진은 'reported' 상태 — 보낸 사람이 구별할 수 있게 분리
    await context.supabase.from("photos").update({ status: "reported" as any }).eq("id", data.id);
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
    if (error) throw dbError(error);
    return { ok: true };
  });

// 전송 취소 — 보낸 사람이 '구매 전(available)'에만 회수. 사진을 완전히 삭제해
// 받는 사람의 받은함에서도 사라지게(동기화)한다.
export const cancelPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: photo, error } = await supabaseAdmin
      .from("photos")
      .select("id, uploader_id, status, original_path, watermarked_path")
      .eq("id", data.id)
      .single();
    if (error || !photo) throw new Error("사진을 찾을 수 없어요");
    if (photo.uploader_id !== context.userId) throw new Error("내가 보낸 사진만 취소할 수 있어요");
    if (photo.status !== "available") throw new Error("이미 소장되었거나 취소할 수 없는 상태예요");

    // 스토리지 원본/워터마크 제거 후 행 삭제 (양쪽 목록에서 사라짐)
    await supabaseAdmin.storage.from("photos-original").remove([photo.original_path]);
    await supabaseAdmin.storage.from("photos-watermarked").remove([photo.watermarked_path]);
    const { error: delErr } = await supabaseAdmin.from("photos").delete().eq("id", photo.id);
    if (delErr) throw dbError(delErr);
    return { ok: true };
  });

// 묶음 단위 취소 — 보낸 사람이 '구매 전(available)' 사진들을 한 번에 회수.
export const cancelPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let canceled = 0;
    for (const id of data.ids) {
      const { data: photo } = await supabaseAdmin
        .from("photos")
        .select("id, uploader_id, status, original_path, watermarked_path")
        .eq("id", id)
        .single();
      if (!photo || photo.uploader_id !== context.userId || photo.status !== "available") continue;
      await supabaseAdmin.storage.from("photos-original").remove([photo.original_path]);
      await supabaseAdmin.storage.from("photos-watermarked").remove([photo.watermarked_path]);
      const { error: delErr } = await supabaseAdmin.from("photos").delete().eq("id", photo.id);
      if (!delErr) canceled++;
    }
    if (canceled === 0) throw new Error("취소할 수 있는 사진이 없어요");
    return { canceled };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, allow_until")
      .eq("id", context.userId)
      .single();
    if (error) throw dbError(error);

    // 포인트 잔액 = 적립된 업로더 수익 합계 (출금 기능 연동 전 단순 집계)
    const { data: earnRows } = await context.supabase
      .from("purchases")
      .select("uploader_earning_won")
      .eq("uploader_id", context.userId)
      .eq("status", "completed");
    const point_balance = (earnRows ?? []).reduce((s, r) => s + (r.uploader_earning_won ?? 0), 0);

    return { profile: data, point_balance };
  });

// 보낸 사진 이력 숨기기 — 더 이상 액션이 없는 묶음을 내 목록에서 삭제
export const hideSentBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ batch_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // batch_id가 일치하는 사진 또는 단건(photo_id) 소프트 삭제
    const { error } = await supabaseAdmin
      .from("photos")
      .update({ uploader_hidden: true } as any)
      .eq("uploader_id", context.userId)
      .or(`batch_id.eq.${data.batch_id},id.eq.${data.batch_id}`);
    if (error) throw dbError(error);
    return { ok: true };
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
    if (error) throw dbError(error);
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
    if (error) throw dbError(error);

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
    if (error) throw dbError(error);
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
      if (error) throw dbError(error);
    } else {
      const { error } = await context.supabase
        .from("friendships")
        .delete()
        .eq("requester_id", data.from_id)
        .eq("addressee_id", me);
      if (error) throw dbError(error);
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
    if (error) throw dbError(error);
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
    if (error) throw dbError(error);
    return { allow_until };
  });