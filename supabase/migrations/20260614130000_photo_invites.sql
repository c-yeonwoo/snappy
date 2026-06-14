-- 초대-수령(invite-to-claim) 바이럴 루프
--  - 비가입 친구에게 링크로 사진 보내기 → 토큰으로 초대 생성
--  - 링크 받은 사람이 가입 후 클레임 → photos 생성(소장 대기) + 자동 친구 + 양쪽 +5 크레딧

CREATE TABLE IF NOT EXISTS public.photo_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  note TEXT,
  photos JSONB NOT NULL DEFAULT '[]',          -- [{ original_path, watermarked_path }]
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed')),
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS photo_invites_inviter_idx ON public.photo_invites(inviter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photo_invites_token_idx ON public.photo_invites(token);
GRANT SELECT ON public.photo_invites TO authenticated;
GRANT ALL ON public.photo_invites TO service_role;
ALTER TABLE public.photo_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo_invites select own" ON public.photo_invites FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR claimed_by = auth.uid());

-- 원자적 클레임: photos 생성 + 초대 완료 + 친구 자동수락 + 양쪽 +5(클레이머 1회 한정)
CREATE OR REPLACE FUNCTION public.claim_photo_invite(p_token TEXT, p_claimer UUID)
RETURNS TABLE (batch_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter UUID;
  v_note    TEXT;
  v_photos  JSONB;
  v_batch   UUID := gen_random_uuid();
  v_rec     JSONB;
  v_already BOOLEAN;
BEGIN
  SELECT inviter_id, note, photos INTO v_inviter, v_note, v_photos
  FROM public.photo_invites
  WHERE token = p_token AND status = 'open'
  FOR UPDATE;

  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;
  IF v_inviter = p_claimer THEN
    RAISE EXCEPTION 'CANNOT_CLAIM_OWN';
  END IF;

  -- photos 생성 (소장 대기)
  FOR v_rec IN SELECT * FROM jsonb_array_elements(v_photos) LOOP
    INSERT INTO public.photos (uploader_id, subject_id, original_path, watermarked_path, price_won, status, note, batch_id)
    VALUES (
      v_inviter, p_claimer,
      v_rec->>'original_path', v_rec->>'watermarked_path',
      1000, 'available', v_note, v_batch
    );
  END LOOP;

  -- 초대 완료 처리
  UPDATE public.photo_invites
  SET status = 'claimed', claimed_by = p_claimer, claimed_at = now()
  WHERE token = p_token;

  -- 자동 친구 (수락 상태)
  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (v_inviter, p_claimer, 'accepted')
  ON CONFLICT DO NOTHING;

  -- 추천 보너스: 클레이머가 처음 받는 경우에만 양쪽 +5
  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions WHERE user_id = p_claimer AND note = 'referral'
  ) INTO v_already;
  IF NOT v_already THEN
    INSERT INTO public.wallet_transactions (user_id, amount_won, kind, status, note)
    VALUES (p_claimer, 5, 'earn', 'completed', 'referral'),
           (v_inviter, 5, 'earn', 'completed', 'referral');
  END IF;

  RETURN QUERY SELECT v_batch;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_photo_invite(TEXT, UUID) TO service_role;
