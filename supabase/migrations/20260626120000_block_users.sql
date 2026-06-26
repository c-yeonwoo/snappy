-- App Store 1.2 (UGC) 대응: 유저 차단 기능
-- 차단하면 차단 대상이 보낸 사진이 받은함/피드에서 숨겨진다.

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;

-- 본인 차단 목록만 조회/추가/삭제 가능
drop policy if exists "own blocks select" on public.blocked_users;
create policy "own blocks select" on public.blocked_users
  for select using (auth.uid() = blocker_id);

drop policy if exists "own blocks insert" on public.blocked_users;
create policy "own blocks insert" on public.blocked_users
  for insert with check (auth.uid() = blocker_id);

drop policy if exists "own blocks delete" on public.blocked_users;
create policy "own blocks delete" on public.blocked_users
  for delete using (auth.uid() = blocker_id);

create index if not exists idx_blocked_users_blocker on public.blocked_users (blocker_id);
