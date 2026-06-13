-- 포인트 지갑(충전/출금/적립) + 결제 세션 + 접근 로그

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_won INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('earn', 'spend', 'charge', 'withdraw', 'refund')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  related_photo_id UUID REFERENCES public.photos(id) ON DELETE SET NULL,
  session_id TEXT NULL,
  note TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_transactions_session_idx ON public.wallet_transactions(session_id);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet select own" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.photo_purchase_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE,
  total_amount_won INTEGER NOT NULL DEFAULT 0,
  photos UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  provider TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock', 'toss')),
  payment_key TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS photo_purchase_sessions_buyer_idx ON public.photo_purchase_sessions(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photo_purchase_sessions_order_idx ON public.photo_purchase_sessions(order_id);
GRANT SELECT ON public.photo_purchase_sessions TO authenticated;
GRANT ALL ON public.photo_purchase_sessions TO service_role;
ALTER TABLE public.photo_purchase_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo_purchase_sessions select own" ON public.photo_purchase_sessions FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.point_charge_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('charge', 'withdraw')),
  order_id TEXT NOT NULL UNIQUE,
  amount_won INTEGER NOT NULL CHECK (amount_won >= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  provider TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock', 'toss')),
  payment_key TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS point_charge_sessions_user_idx ON public.point_charge_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS point_charge_sessions_order_idx ON public.point_charge_sessions(order_id);
GRANT SELECT ON public.point_charge_sessions TO authenticated;
GRANT ALL ON public.point_charge_sessions TO service_role;
ALTER TABLE public.point_charge_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "point_charge_sessions select own" ON public.point_charge_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.photo_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'uploaded',
      'preview',
      'detail_view',
      'download',
      'purchase',
      'share',
      'report'
    )
  ),
  ip INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photo_access_logs_photo_idx ON public.photo_access_logs(photo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photo_access_logs_actor_idx ON public.photo_access_logs(actor_id, created_at DESC);
GRANT INSERT ON public.photo_access_logs TO service_role;
GRANT SELECT ON public.photo_access_logs TO authenticated;
ALTER TABLE public.photo_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo_access_logs select own" ON public.photo_access_logs FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR EXISTS (
    SELECT 1
    FROM public.photos p
    WHERE p.id = photo_id AND (p.uploader_id = auth.uid() OR p.subject_id = auth.uid())
  ));

-- 구매 ↔ 결제 세션 연결 컬럼
-- completePurchaseSession()이 session_id로 purchases 행을 completed 처리하므로 필요.
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS session_id UUID;
CREATE INDEX IF NOT EXISTS purchases_session_idx ON public.purchases(session_id);
