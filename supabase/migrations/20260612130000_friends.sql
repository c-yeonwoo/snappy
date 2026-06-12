-- D8: 양방향 친구(friend request/accept) + 받기 설정(allow window)

-- 받기 설정: 이 시각까지는 친구가 아닌 사람도 나에게 보낼 수 있음 (없거나 과거면 친구만)
ALTER TABLE public.profiles ADD COLUMN allow_until TIMESTAMPTZ;

-- 친구관계: requester가 addressee에게 요청, accepted가 되면 양방향 친구
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted');

CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);
CREATE INDEX friendships_requester_idx ON public.friendships(requester_id, status);
CREATE INDEX friendships_addressee_idx ON public.friendships(addressee_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- 나와 관련된 관계만 조회
CREATE POLICY "friendships select own" ON public.friendships FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
-- 요청은 본인이 requester일 때만 생성
CREATE POLICY "friendships insert requester" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
-- 수락(상태 변경)은 요청 받은 사람(addressee)만
CREATE POLICY "friendships accept addressee" ON public.friendships FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid());
-- 취소/거절/삭제는 양쪽 다 가능
CREATE POLICY "friendships delete own" ON public.friendships FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
