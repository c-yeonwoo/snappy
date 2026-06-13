-- 버그픽스: purchase_photos_with_points 에서 "column reference id is ambiguous".
-- RETURNS TABLE 의 OUT 파라미터(id)와 _targets.id 가 충돌 → 모든 컬럼 참조를 한정한다.
CREATE OR REPLACE FUNCTION public.purchase_photos_with_points(
  p_buyer UUID,
  p_photo_ids UUID[]
)
RETURNS TABLE (id UUID, original_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count   INTEGER := 0;
  v_balance INTEGER := 0;
  v_session UUID := gen_random_uuid();
  v_order   TEXT := 'snp_' || (extract(epoch from now())::bigint)::text
                    || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 14);
  r RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer::text, 0));

  CREATE TEMP TABLE _targets ON COMMIT DROP AS
  SELECT p.id AS pid, p.uploader_id AS uploader_id, p.original_path AS original_path
  FROM public.photos p
  WHERE p.id = ANY(p_photo_ids)
    AND p.subject_id = p_buyer
    AND p.status = 'available'
  FOR UPDATE;

  SELECT count(*) INTO v_count FROM _targets;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'NO_PURCHASABLE_PHOTOS';
  END IF;

  SELECT COALESCE(sum(w.amount_won), 0) INTO v_balance
  FROM public.wallet_transactions w
  WHERE w.user_id = p_buyer AND w.status = 'completed';

  IF v_balance < v_count THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  INSERT INTO public.photo_purchase_sessions
    (id, buyer_id, order_id, total_amount_won, photos, status, provider, completed_at)
  SELECT v_session, p_buyer, v_order, v_count, array_agg(t.pid), 'completed', 'points', now()
  FROM _targets t;

  INSERT INTO public.wallet_transactions (user_id, amount_won, kind, status, session_id, note)
  VALUES (p_buyer, -v_count, 'spend', 'completed', v_session::text, 'photo unlock: ' || v_order);

  FOR r IN SELECT t.pid, t.uploader_id, t.original_path FROM _targets t LOOP
    UPDATE public.photos SET status = 'sold' WHERE public.photos.id = r.pid;

    INSERT INTO public.purchases
      (photo_id, buyer_id, uploader_id, amount_won, uploader_earning_won, status, session_id)
    VALUES
      (r.pid, p_buyer, r.uploader_id, 1, 1, 'completed', v_session);

    INSERT INTO public.wallet_transactions
      (user_id, amount_won, kind, status, related_photo_id, session_id, note)
    VALUES
      (r.uploader_id, 1, 'earn', 'completed', r.pid, v_session::text, 'photo collected: ' || r.pid::text);
  END LOOP;

  RETURN QUERY SELECT t.pid, t.original_path FROM _targets t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_photos_with_points(UUID, UUID[]) TO service_role;
