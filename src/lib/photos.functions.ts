// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MOCK_PAYMENT_KEY = "mock_toss_payment_key_0000";
const TOSS_CLIENT_KEY =
  process.env.TOSS_CLIENT_KEY ?? process.env.VITE_TOSS_CLIENT_KEY ?? process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";
const POINT_CHARGE_CALLBACK_URL = process.env.POINT_CHARGE_CALLBACK_URL ?? "";
const WITHDRAW_CALLBACK_URL = process.env.POINT_WITHDRAW_CALLBACK_URL ?? "";

function isMockPayment(key: string) {
  return !key || key.includes("mock") || key.includes("test") || key.includes("YOUR_");
}

const PAYMENT_MODE = isMockPayment(TOSS_CLIENT_KEY) ? "mock" : "real";
const MAX_BATCH_SIZE = 20;
const MAX_CHARGE_AMOUNT = 200000;

// DB/스토리지 오류는 사용자에겐 한글 일반 메시지로 노출하고, 원본은 서버 로그로 남긴다.
function dbError(e: { message?: string } | null | undefined) {
  console.error("[supabase]", e?.message);
  return new Error("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

const ENHANCE_COST = 2; // AI 보정 1회 크레딧

// 원자적 포인트 구매 RPC가 RAISE 하는 예외를 사용자 메시지로 변환.
function purchaseRpcError(e: { message?: string } | null | undefined) {
  const msg = e?.message ?? "";
  if (msg.includes("INSUFFICIENT_POINTS")) return new Error("크레딧이 부족해요. 친구를 더 찍어주고 모아보세요.");
  if (msg.includes("NO_PURCHASABLE_PHOTOS")) return new Error("소장할 수 있는 사진이 없어요");
  return dbError(e);
}

function parseCallbackUrl(raw: string) {
  if (!raw) return undefined;
  try {
    return new URL(raw).toString();
  } catch {
    return undefined;
  }
}

function generateOrderId(prefix = "snp") {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

function getTossConfig() {
  return {
    mode: PAYMENT_MODE,
    client_key: PAYMENT_MODE === "mock" ? MOCK_PAYMENT_KEY : TOSS_CLIENT_KEY,
    secret_key_present: !!TOSS_SECRET_KEY,
    callback: {
      charge: parseCallbackUrl(POINT_CHARGE_CALLBACK_URL),
      withdraw: parseCallbackUrl(WITHDRAW_CALLBACK_URL),
    },
  };
}

async function getWalletBalance(supabaseAdmin: any, userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("wallet_transactions")
    .select("amount_won")
    .eq("user_id", userId)
    .eq("status", "completed");
  if (error) return 0;
  return (data ?? []).reduce((sum, r) => sum + (r.amount_won ?? 0), 0);
}

async function applyWalletCredit(
  supabaseAdmin: any,
  params: {
    user_id: string;
    amount_won: number;
    kind: "earn" | "spend" | "charge" | "withdraw" | "refund";
    related_photo_id?: string;
    session_id?: string;
    note: string;
  },
) {
  if (params.amount_won === 0) return;
  const { error } = await supabaseAdmin.from("wallet_transactions").insert({
    user_id: params.user_id,
    amount_won: params.amount_won,
    kind: params.kind,
    status: "completed",
    related_photo_id: params.related_photo_id ?? null,
    session_id: params.session_id ?? null,
    note: params.note,
  });
  if (error) throw dbError(error);
}

async function ensurePointSession(supabaseAdmin: any, orderId: string, userId: string) {
  const { data: session } = await supabaseAdmin
    .from("point_charge_sessions")
    .select("id, user_id, kind, amount_won, status")
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!session) throw new Error("결제 세션을 찾을 수 없어요.");
  return session;
}

function getClientIp() {
  const req = getRequest();
  if (!req) return null;
  return (
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    null
  );
}

async function logPhotoAccess(contextUserId: string, photoId: string, eventType: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const req = getRequest();
  await supabaseAdmin.from("photo_access_logs").insert({
    photo_id: photoId,
    actor_id: contextUserId,
    event_type: eventType,
    ip: getClientIp(),
    user_agent: req?.headers.get("user-agent"),
  });
}

// 포인트로 사진 구매 — 원자적 RPC(purchase_photos_with_points) 호출.
// 잔액 검증·차감·sold 처리·업로더 적립·구매/세션 기록이 단일 트랜잭션에서 처리된다.
async function buyPhotosWithPoints(supabaseAdmin: any, buyerId: string, photoIds: string[]) {
  const { data, error } = await supabaseAdmin.rpc("purchase_photos_with_points", {
    p_buyer: buyerId,
    p_photo_ids: photoIds,
  });
  if (error) throw purchaseRpcError(error);
  const rows = (data ?? []) as Array<{ id: string; original_path: string }>;
  for (const r of rows) await logPhotoAccess(buyerId, r.id, "purchase");
  return rows;
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
    await logPhotoAccess(context.userId, row.id, "uploaded");
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
    for (const item of list) await logPhotoAccess(context.userId, item.id, "preview");
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
    await logPhotoAccess(context.userId, photo.id, "detail_view");

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
    const rows = await buyPhotosWithPoints(supabaseAdmin, context.userId, [data.id]);
    if (rows.length === 0) throw new Error("이미 소장되었거나 받을 수 없는 사진이에요");
    const { data: signed } = await supabaseAdmin.storage
      .from("photos-original")
      .createSignedUrl(rows[0].original_path, 60 * 10);
    return { status: "completed", original_url: signed?.signedUrl ?? null };
  });

export const requestPointCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ amount_won: z.number().int().min(1000).max(MAX_CHARGE_AMOUNT) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const order_id = generateOrderId("chg");
    const { error } = await supabaseAdmin.from("point_charge_sessions").insert({
      id: crypto.randomUUID(),
      user_id: context.userId,
      kind: "charge",
      order_id,
      amount_won: data.amount_won,
      status: PAYMENT_MODE === "mock" ? "completed" : "pending",
      provider: PAYMENT_MODE === "mock" ? "mock" : "toss",
      metadata: { request_source: "profile_charge" },
    });
    if (error) throw dbError(error);

    if (PAYMENT_MODE === "mock") {
      await applyWalletCredit(supabaseAdmin, {
        user_id: context.userId,
        amount_won: data.amount_won,
        kind: "charge",
        session_id: order_id,
        note: `point charge mock: ${order_id}`,
      });
      return {
        status: "completed",
        order_id,
      };
    }

    return {
      status: "pending",
      order_id,
      amount_won: data.amount_won,
      payment: getTossConfig(),
    };
  });

export const requestPointWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ amount_won: z.number().int().min(1000).max(MAX_CHARGE_AMOUNT) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const balance = await getWalletBalance(supabaseAdmin, context.userId);
    if (balance < data.amount_won) throw new Error("출금 가능 포인트가 부족해요.");
    const order_id = generateOrderId("wd");
    const { error } = await supabaseAdmin.from("point_charge_sessions").insert({
      id: crypto.randomUUID(),
      user_id: context.userId,
      kind: "withdraw",
      order_id,
      amount_won: data.amount_won,
      status: PAYMENT_MODE === "mock" ? "completed" : "pending",
      provider: PAYMENT_MODE === "mock" ? "mock" : "toss",
      metadata: { request_source: "profile_withdraw" },
    });
    if (error) throw dbError(error);

    if (PAYMENT_MODE === "mock") {
      await applyWalletCredit(supabaseAdmin, {
        user_id: context.userId,
        amount_won: -data.amount_won,
        kind: "withdraw",
        session_id: order_id,
        note: `point withdraw mock: ${order_id}`,
      });
      return {
        status: "completed",
        order_id,
      };
    }

    return {
      status: "pending",
      order_id,
      amount_won: data.amount_won,
      payment: getTossConfig(),
    };
  });

export const confirmPointCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ order_id: z.string(), payment_key: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await ensurePointSession(supabaseAdmin, data.order_id, context.userId);
    if (session.kind !== "charge") throw new Error("충전 세션이 아니에요.");
    if (session.status === "completed") return { status: "completed", order_id: data.order_id };
    if (PAYMENT_MODE !== "mock" && !data.payment_key) throw new Error("결제 승인키가 필요해요.");
    const { error } = await supabaseAdmin
      .from("point_charge_sessions")
      .update({ status: "completed", payment_key: data.payment_key ?? null, completed_at: new Date().toISOString() })
      .eq("order_id", data.order_id);
    if (error) throw dbError(error);
    await applyWalletCredit(supabaseAdmin, {
      user_id: context.userId,
      amount_won: session.amount_won,
      kind: "charge",
      session_id: data.order_id,
      note: `point charge: ${data.order_id}`,
    });
    return { status: "completed", order_id: data.order_id };
  });

export const confirmPointWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ order_id: z.string(), payment_key: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await ensurePointSession(supabaseAdmin, data.order_id, context.userId);
    if (session.kind !== "withdraw") throw new Error("출금 세션이 아니에요.");
    if (session.status === "completed") return { status: "completed", order_id: data.order_id };
    if (PAYMENT_MODE !== "mock" && !data.payment_key) throw new Error("결제 승인키가 필요해요.");
    const balance = await getWalletBalance(supabaseAdmin, context.userId);
    if (balance < session.amount_won) throw new Error("출금 가능 포인트가 부족해요.");
    const { error } = await supabaseAdmin
      .from("point_charge_sessions")
      .update({ status: "completed", payment_key: data.payment_key ?? null, completed_at: new Date().toISOString() })
      .eq("order_id", data.order_id);
    if (error) throw dbError(error);
    await applyWalletCredit(supabaseAdmin, {
      user_id: context.userId,
      amount_won: -session.amount_won,
      kind: "withdraw",
      session_id: data.order_id,
      note: `point withdraw: ${data.order_id}`,
    });
    return { status: "completed", order_id: data.order_id };
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
    for (const item of list) await logPhotoAccess(context.userId, item.id, "preview");
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

// 묶음에서 선택한 사진들을 포인트로 일괄 소장 (원자적 RPC).
export const purchasePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).min(1).max(MAX_BATCH_SIZE) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uniqIds = Array.from(new Set(data.ids));
    const rows = await buyPhotosWithPoints(supabaseAdmin, context.userId, uniqIds);
    if (rows.length === 0) throw new Error("소장할 수 있는 사진이 없어요");
    const signed = (await supabaseAdmin.storage
      .from("photos-original")
      .createSignedUrls(rows.map((r) => r.original_path), 60 * 10)).data ?? [];
    return {
      status: "completed",
      results: rows.map((r, i) => ({ id: r.id, original_url: signed[i]?.signedUrl ?? null })),
    };
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

    const point_balance = await getWalletBalance(context.supabase, context.userId);

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

// ----------------- 친구 A/B 사진 투표 -----------------

// 두 유저가 수락된 친구인지
async function areFriends(supabase: any, a: string, b: string) {
  const { data } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`)
    .maybeSingle();
  return !!data;
}

async function signPollImages(paths: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("poll-images").createSignedUrls(paths, 60 * 60);
  return data ?? [];
}

// 투표 생성 — 후보 이미지 2~4장 (클라가 poll-images 버킷에 업로드한 경로)
export const createPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        question: z.string().max(140).optional(),
        image_paths: z.array(z.string().min(3).max(500)).min(2).max(4),
        duration_hours: z.number().int().min(1).max(168).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const poll_id = crypto.randomUUID();
    const expires_at = data.duration_hours
      ? new Date(Date.now() + data.duration_hours * 3600_000).toISOString()
      : null;
    const { error: e1 } = await supabaseAdmin.from("polls").insert({
      id: poll_id,
      owner_id: context.userId,
      question: data.question ?? null,
      status: "open",
      expires_at,
    });
    if (e1) throw dbError(e1);
    const { error: e2 } = await supabaseAdmin.from("poll_options").insert(
      data.image_paths.map((p, i) => ({ poll_id, image_path: p, position: i })),
    );
    if (e2) throw dbError(e2);
    return { id: poll_id };
  });

// 내가 만든 투표 목록 (+ 총 투표수)
export const getMyPolls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: polls } = await supabaseAdmin
      .from("polls")
      .select("id, question, status, expires_at, created_at, poll_options(id, image_path, position), poll_votes(id)")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    const list = polls ?? [];
    const firstPaths = list.map((p: any) => (p.poll_options ?? []).sort((a: any, b: any) => a.position - b.position)[0]?.image_path).filter(Boolean);
    const signed = await signPollImages(firstPaths);
    let si = 0;
    const items = list.map((p: any) => {
      const opts = (p.poll_options ?? []).sort((a: any, b: any) => a.position - b.position);
      const cover = opts[0] ? (signed[si++]?.signedUrl ?? null) : null;
      return {
        id: p.id,
        question: p.question,
        status: p.status,
        expires_at: p.expires_at,
        created_at: p.created_at,
        option_count: opts.length,
        vote_count: (p.poll_votes ?? []).length,
        cover_url: cover,
      };
    });
    return { polls: items };
  });

// 친구들이 만든 '열린' 투표 (내가 투표할 대상)
export const getFriendPolls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // 내 친구 id 수집
    const { data: fr } = await supabaseAdmin
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${context.userId},addressee_id.eq.${context.userId}`);
    const friendIds = (fr ?? []).map((f: any) => (f.requester_id === context.userId ? f.addressee_id : f.requester_id));
    if (friendIds.length === 0) return { polls: [] };

    const { data: polls } = await supabaseAdmin
      .from("polls")
      .select("id, owner_id, question, status, expires_at, created_at, poll_options(id, image_path, position), poll_votes(voter_id)")
      .in("owner_id", friendIds)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    const list = (polls ?? []).filter((p: any) => !(p.poll_votes ?? []).some((v: any) => v.voter_id === context.userId));

    const ownerIds = Array.from(new Set(list.map((p: any) => p.owner_id)));
    const { data: owners } = await supabaseAdmin.from("profiles").select("id, handle, display_name").in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
    const ownerMap: Record<string, any> = {};
    (owners ?? []).forEach((o: any) => { ownerMap[o.id] = o; });

    const firstPaths = list.map((p: any) => (p.poll_options ?? []).sort((a: any, b: any) => a.position - b.position)[0]?.image_path).filter(Boolean);
    const signed = await signPollImages(firstPaths);
    let si = 0;
    const items = list.map((p: any) => {
      const opts = (p.poll_options ?? []).sort((a: any, b: any) => a.position - b.position);
      return {
        id: p.id,
        question: p.question,
        created_at: p.created_at,
        option_count: opts.length,
        owner: ownerMap[p.owner_id] ?? null,
        cover_url: opts[0] ? (signed[si++]?.signedUrl ?? null) : null,
      };
    });
    return { polls: items };
  });

// 투표 상세 — 옵션·서명URL·내 투표·집계. 본인 또는 친구만.
export const getPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: poll } = await supabaseAdmin
      .from("polls")
      .select("id, owner_id, question, status, expires_at, created_at, poll_options(id, image_path, position), poll_votes(option_id, voter_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!poll) throw new Error("투표를 찾을 수 없어요");
    const isOwner = poll.owner_id === context.userId;
    if (!isOwner && !(await areFriends(supabaseAdmin, context.userId, poll.owner_id))) {
      throw new Error("이 투표를 볼 수 없어요");
    }

    const opts = (poll.poll_options ?? []).sort((a: any, b: any) => a.position - b.position);
    const votes = poll.poll_votes ?? [];
    const myVote = votes.find((v: any) => v.voter_id === context.userId)?.option_id ?? null;
    const revealed = isOwner || !!myVote || poll.status === "closed";
    const signed = await signPollImages(opts.map((o: any) => o.image_path));
    const countByOption: Record<string, number> = {};
    votes.forEach((v: any) => { countByOption[v.option_id] = (countByOption[v.option_id] ?? 0) + 1; });

    const { data: owner } = await supabaseAdmin.from("profiles").select("handle, display_name").eq("id", poll.owner_id).maybeSingle();

    return {
      id: poll.id,
      question: poll.question,
      status: poll.status,
      expires_at: poll.expires_at,
      is_owner: isOwner,
      my_vote: myVote,
      revealed,
      total_votes: votes.length,
      owner,
      options: opts.map((o: any, i: number) => ({
        id: o.id,
        image_url: signed[i]?.signedUrl ?? null,
        votes: revealed ? (countByOption[o.id] ?? 0) : null,
      })),
    };
  });

// 투표하기 — 친구만, 열린 투표, 1인 1표
export const votePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ poll_id: z.string().uuid(), option_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: poll } = await supabaseAdmin
      .from("polls")
      .select("id, owner_id, status, expires_at, poll_options(id)")
      .eq("id", data.poll_id)
      .maybeSingle();
    if (!poll) throw new Error("투표를 찾을 수 없어요");
    if (poll.owner_id === context.userId) throw new Error("내 투표에는 투표할 수 없어요");
    if (poll.status !== "open" || (poll.expires_at && new Date(poll.expires_at).getTime() < Date.now())) {
      throw new Error("이미 마감된 투표예요");
    }
    if (!(await areFriends(supabaseAdmin, context.userId, poll.owner_id))) throw new Error("친구만 투표할 수 있어요");
    if (!(poll.poll_options ?? []).some((o: any) => o.id === data.option_id)) throw new Error("잘못된 선택지예요");

    const { error } = await supabaseAdmin
      .from("poll_votes")
      .upsert({ poll_id: data.poll_id, option_id: data.option_id, voter_id: context.userId }, { onConflict: "poll_id,voter_id" });
    if (error) throw dbError(error);
    return { ok: true };
  });

// 투표 마감 (소유자)
export const closePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("polls")
      .update({ status: "closed" })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw dbError(error);
    return { ok: true };
  });

// ----------------- AI 보정 (크레딧 sink) -----------------

// 원본 접근 권한이 있는 사진인지 (수집한 피사체 or 업로더)
async function canAccessOriginal(supabaseAdmin: any, userId: string, photoId: string) {
  const { data: p } = await supabaseAdmin
    .from("photos")
    .select("uploader_id, subject_id, status")
    .eq("id", photoId)
    .maybeSingle();
  if (!p) return false;
  if (p.uploader_id === userId) return true;
  if (p.subject_id === userId && p.status === "sold") return true;
  return false;
}

// 보정 비용 안내 (UI에서 모달 띄울 때 사용)
export const getEnhanceInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const balance = await getWalletBalance(supabaseAdmin, context.userId);
    return { cost: ENHANCE_COST, balance };
  });

// 보정본 커밋 — 클라가 보정한 이미지를 photos-enhanced 에 업로드한 뒤 호출.
// 크레딧을 원자적으로 차감하고 기록 후 서명 URL 반환.
export const commitEnhancement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        source_photo_id: z.string().uuid(),
        enhanced_path: z.string().min(3).max(500),
        style: z.string().max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await canAccessOriginal(supabaseAdmin, context.userId, data.source_photo_id))) {
      throw new Error("이 사진을 보정할 권한이 없어요");
    }
    // 크레딧 차감 (원자적)
    const { error: spendErr } = await supabaseAdmin.rpc("spend_credits", {
      p_user: context.userId,
      p_amount: ENHANCE_COST,
      p_note: `ai enhance: ${data.source_photo_id}`,
    });
    if (spendErr) throw purchaseRpcError(spendErr);

    const { error: insErr } = await supabaseAdmin.from("photo_enhancements").insert({
      user_id: context.userId,
      source_photo_id: data.source_photo_id,
      enhanced_path: data.enhanced_path,
      style: data.style ?? null,
      cost: ENHANCE_COST,
    });
    if (insErr) throw dbError(insErr);

    await logPhotoAccess(context.userId, data.source_photo_id, "download");
    const { data: signed } = await supabaseAdmin.storage
      .from("photos-enhanced")
      .createSignedUrl(data.enhanced_path, 60 * 10);
    return { ok: true, enhanced_url: signed?.signedUrl ?? null };
  });
