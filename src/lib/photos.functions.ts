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
        price_cents: z.number().int().min(100).max(100000),
        note: z.string().max(280).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.subject_id === context.userId) {
      throw new Error("Cannot send a photo to yourself");
    }
    const { data: row, error } = await context.supabase
      .from("photos")
      .insert({
        uploader_id: context.userId,
        subject_id: data.subject_id,
        original_path: data.original_path,
        watermarked_path: data.watermarked_path,
        price_cents: data.price_cents,
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
      .select("id, uploader_id, watermarked_path, price_cents, status, note, created_at")
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

    // signed urls for previews
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const enriched = await Promise.all(
      (photos ?? []).map(async (p) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("photos-watermarked")
          .createSignedUrl(p.watermarked_path, 60 * 60);
        return {
          ...p,
          preview_url: signed?.signedUrl ?? null,
          uploader: profilesMap[p.uploader_id] ?? null,
        };
      }),
    );
    return { photos: enriched };
  });

export const getMySent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: photos, error } = await context.supabase
      .from("photos")
      .select("id, subject_id, watermarked_path, price_cents, status, created_at")
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
    const enriched = await Promise.all(
      (photos ?? []).map(async (p) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("photos-watermarked")
          .createSignedUrl(p.watermarked_path, 60 * 60);
        return {
          ...p,
          preview_url: signed?.signedUrl ?? null,
          subject: profilesMap[p.subject_id] ?? null,
        };
      }),
    );

    // earnings
    const { data: earnRows } = await context.supabase
      .from("purchases")
      .select("uploader_earning_cents, status")
      .eq("uploader_id", context.userId)
      .eq("status", "completed");
    const earnings_cents = (earnRows ?? []).reduce((sum, r) => sum + (r.uploader_earning_cents ?? 0), 0);

    return { photos: enriched, earnings_cents };
  });

export const getPhotoDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: photo, error } = await context.supabase
      .from("photos")
      .select("id, uploader_id, subject_id, watermarked_path, price_cents, status, note, created_at")
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
      .select("id, uploader_id, subject_id, price_cents, status, original_path")
      .eq("id", data.id)
      .single();
    if (error || !photo) throw new Error("Photo not found");
    if (photo.subject_id !== context.userId) throw new Error("Only the photo subject can purchase");
    if (photo.status !== "available") throw new Error("Photo is not available");

    const earning = Math.floor(photo.price_cents * EARNING_RATE);

    // NOTE: Stripe will be wired in next. For MVP we mark as completed instantly.
    const { error: insErr } = await supabaseAdmin.from("purchases").insert({
      photo_id: photo.id,
      buyer_id: context.userId,
      uploader_id: photo.uploader_id,
      amount_cents: photo.price_cents,
      uploader_earning_cents: earning,
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
      .select("id, handle, display_name, avatar_url")
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