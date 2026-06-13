-- 친구 비공개 A/B(다지선다) 사진 투표
--  - 후보 사진 2~4장을 올리고 친구들이 한 표씩 → 어떤 컷이 best인지 추천받음
--  - 공개 범위: 본인 + (수락된) 친구. 읽기/쓰기는 서버함수(service_role)로 친구 검증.

-- 투표 후보 이미지 버킷 (private, 서명 URL로만 노출)
INSERT INTO storage.buckets (id, name, public)
VALUES ('poll-images', 'poll-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT CHECK (question IS NULL OR length(question) <= 140),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS polls_owner_idx ON public.polls(owner_id, created_at DESC);
GRANT SELECT ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls select own" ON public.polls FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS poll_options_poll_idx ON public.poll_options(poll_id, position);
GRANT SELECT ON public.poll_options TO authenticated;
GRANT ALL ON public.poll_options TO service_role;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_options select via poll" ON public.poll_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_id)
);
CREATE INDEX IF NOT EXISTS poll_votes_poll_idx ON public.poll_votes(poll_id);
GRANT SELECT ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_votes select via poll owner or self" ON public.poll_votes FOR SELECT TO authenticated
  USING (
    voter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.owner_id = auth.uid())
  );
