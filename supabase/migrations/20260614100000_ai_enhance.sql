-- AI 보정 (크레딧 sink)
--  - 보정본 저장 버킷 + 기록 테이블 + 원자적 크레딧 차감 RPC
--  - 실제 픽셀 처리는 현재 클라이언트 auto-enhance(mock). 추후 서버 AI API로 교체.

-- 보정본 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos-enhanced', 'photos-enhanced', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "enhanced insert owner" ON storage.objects;
CREATE POLICY "enhanced insert owner" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'photos-enhanced' AND owner = auth.uid());

DROP POLICY IF EXISTS "enhanced select owner" ON storage.objects;
CREATE POLICY "enhanced select owner" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'photos-enhanced' AND owner = auth.uid());

-- 보정 기록
CREATE TABLE IF NOT EXISTS public.photo_enhancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_photo_id UUID REFERENCES public.photos(id) ON DELETE SET NULL,
  enhanced_path TEXT NOT NULL,
  style TEXT,
  cost INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photo_enhancements_user_idx ON public.photo_enhancements(user_id, created_at DESC);
GRANT SELECT ON public.photo_enhancements TO authenticated;
GRANT ALL ON public.photo_enhancements TO service_role;
ALTER TABLE public.photo_enhancements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo_enhancements select own" ON public.photo_enhancements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 원자적 크레딧 차감 (잔액 부족 시 INSUFFICIENT_POINTS). 구매 RPC와 동일 advisory lock 키로 직렬화.
CREATE OR REPLACE FUNCTION public.spend_credits(p_user UUID, p_amount INT, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER := 0;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  SELECT COALESCE(sum(amount_won), 0) INTO v_balance
  FROM public.wallet_transactions WHERE user_id = p_user AND status = 'completed';
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;
  INSERT INTO public.wallet_transactions (user_id, amount_won, kind, status, note)
  VALUES (p_user, -p_amount, 'spend', 'completed', p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.spend_credits(UUID, INT, TEXT) TO service_role;
