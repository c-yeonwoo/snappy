-- 크레딧 호혜 모델 전환
--  - 현금/가격 제거: 사진 1장 = 1 크레딧
--  - 찍어준 사진이 소장되면 업로더 +1 크레딧 (좋은 사진 = 선택받음 = 보상)
--  - 신규 가입 시드 +5 크레딧
-- wallet_transactions 원장 구조는 그대로 두고 금액 단위만 '크레딧 수'로 해석한다.

-- 1) 신규 가입 보너스: handle_new_user 확장 (+5 크레딧)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_handle TEXT;
  final_handle TEXT;
  suffix INT := 0;
BEGIN
  base_handle := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'handle', split_part(NEW.email, '@', 1), 'user'), '[^a-z0-9_]', '', 'g'));
  IF base_handle = '' OR base_handle IS NULL THEN base_handle := 'user'; END IF;
  final_handle := base_handle;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) LOOP
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (id, handle, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_handle,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_handle),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  -- 가입 시드 크레딧
  INSERT INTO public.wallet_transactions (user_id, amount_won, kind, status, note)
  VALUES (NEW.id, 5, 'earn', 'completed', 'signup_bonus');
  RETURN NEW;
END;
$$;

-- 2) 사진 소장 RPC를 크레딧(1장 = 1크레딧) 기준으로 재정의.
--    함수명은 유지(서버 코드 호환). 동작만 가격 → 크레딧으로 변경.
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
  SELECT p.id, p.uploader_id, p.original_path
  FROM public.photos p
  WHERE p.id = ANY(p_photo_ids)
    AND p.subject_id = p_buyer
    AND p.status = 'available'
  FOR UPDATE;

  SELECT count(*) INTO v_count FROM _targets;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'NO_PURCHASABLE_PHOTOS';
  END IF;

  -- 잔액 = 완료된 크레딧 거래 합계
  SELECT COALESCE(sum(amount_won), 0) INTO v_balance
  FROM public.wallet_transactions
  WHERE user_id = p_buyer AND status = 'completed';

  IF v_balance < v_count THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';  -- (= 크레딧 부족)
  END IF;

  -- 결제 세션 기록 (1장 = 1크레딧 → total = 장수)
  INSERT INTO public.photo_purchase_sessions
    (id, buyer_id, order_id, total_amount_won, photos, status, provider, completed_at)
  SELECT v_session, p_buyer, v_order, v_count, array_agg(id), 'completed', 'points', now()
  FROM _targets;

  -- 소장자 크레딧 차감 (장당 1)
  INSERT INTO public.wallet_transactions (user_id, amount_won, kind, status, session_id, note)
  VALUES (p_buyer, -v_count, 'spend', 'completed', v_session::text, 'photo unlock: ' || v_order);

  -- 사진별: sold 처리 + 구매 기록 + 업로더 +1 크레딧
  FOR r IN SELECT * FROM _targets LOOP
    UPDATE public.photos SET status = 'sold' WHERE photos.id = r.id;

    INSERT INTO public.purchases
      (photo_id, buyer_id, uploader_id, amount_won, uploader_earning_won, status, session_id)
    VALUES
      (r.id, p_buyer, r.uploader_id, 1, 1, 'completed', v_session);

    INSERT INTO public.wallet_transactions
      (user_id, amount_won, kind, status, related_photo_id, session_id, note)
    VALUES
      (r.uploader_id, 1, 'earn', 'completed', r.id, v_session::text, 'photo collected: ' || r.id::text);
  END LOOP;

  RETURN QUERY SELECT t.id, t.original_path FROM _targets t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_photos_with_points(UUID, UUID[]) TO service_role;
