-- 사진 구매를 "포인트 차감"으로 단일 트랜잭션에서 원자적으로 처리.
-- (충전/출금은 토스 PG, 사진 구매는 포인트 전용 — confirmPhotoPurchase 갈래 제거)

-- 1) 구매 ↔ 결제 세션 연결 컬럼
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS session_id UUID;
CREATE INDEX IF NOT EXISTS purchases_session_idx ON public.purchases(session_id);

-- 2) 사진 결제 세션 provider 에 'points' 허용 (포인트 결제)
ALTER TABLE public.photo_purchase_sessions DROP CONSTRAINT IF EXISTS photo_purchase_sessions_provider_check;
ALTER TABLE public.photo_purchase_sessions ADD CONSTRAINT photo_purchase_sessions_provider_check
  CHECK (provider IN ('mock', 'toss', 'points'));

-- 3) 원자적 포인트 사진 구매 함수
--    - 동일 구매자 동시 결제는 advisory lock 으로 직렬화 (이중 차감 방지)
--    - 대상 사진은 FOR UPDATE 로 잠금 (이중 판매 방지)
--    - 잔액 < 합계면 INSUFFICIENT_POINTS 예외
--    - 사진 sold 처리 + 구매자 차감 + 업로더 적립 + 구매/세션 기록을 한 트랜잭션에서 수행
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
  v_total   INTEGER := 0;
  v_balance INTEGER := 0;
  v_session UUID := gen_random_uuid();
  v_order   TEXT := 'snp_' || (extract(epoch from now())::bigint)::text
                    || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 14);
  v_rate    NUMERIC := 0.7;
  r RECORD;
BEGIN
  -- 동일 구매자 결제 직렬화
  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer::text, 0));

  -- 대상 사진 잠금 + 검증 (받는 사람 본인 + 구매 가능 상태)
  CREATE TEMP TABLE _targets ON COMMIT DROP AS
  SELECT p.id, p.uploader_id, p.price_won, p.original_path
  FROM public.photos p
  WHERE p.id = ANY(p_photo_ids)
    AND p.subject_id = p_buyer
    AND p.status = 'available'
  FOR UPDATE;

  IF (SELECT count(*) FROM _targets) = 0 THEN
    RAISE EXCEPTION 'NO_PURCHASABLE_PHOTOS';
  END IF;

  SELECT COALESCE(sum(price_won), 0) INTO v_total FROM _targets;

  -- 현재 잔액 = 완료된 지갑 거래 합계
  SELECT COALESCE(sum(amount_won), 0) INTO v_balance
  FROM public.wallet_transactions
  WHERE user_id = p_buyer AND status = 'completed';

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  -- 결제 세션 기록
  INSERT INTO public.photo_purchase_sessions
    (id, buyer_id, order_id, total_amount_won, photos, status, provider, completed_at)
  SELECT v_session, p_buyer, v_order, v_total, array_agg(id), 'completed', 'points', now()
  FROM _targets;

  -- 구매자 포인트 차감 (1건)
  INSERT INTO public.wallet_transactions (user_id, amount_won, kind, status, session_id, note)
  VALUES (p_buyer, -v_total, 'spend', 'completed', v_session::text, 'photo purchase: ' || v_order);

  -- 사진별: sold 처리 + 구매 기록 + 업로더 적립
  FOR r IN SELECT * FROM _targets LOOP
    UPDATE public.photos SET status = 'sold' WHERE photos.id = r.id;

    INSERT INTO public.purchases
      (photo_id, buyer_id, uploader_id, amount_won, uploader_earning_won, status, session_id)
    VALUES
      (r.id, p_buyer, r.uploader_id, r.price_won, floor(r.price_won * v_rate)::int, 'completed', v_session);

    INSERT INTO public.wallet_transactions
      (user_id, amount_won, kind, status, related_photo_id, session_id, note)
    VALUES
      (r.uploader_id, floor(r.price_won * v_rate)::int, 'earn', 'completed', r.id, v_session::text,
       'photo sale: ' || r.id::text);
  END LOOP;

  RETURN QUERY SELECT t.id, t.original_path FROM _targets t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_photos_with_points(UUID, UUID[]) TO service_role;
