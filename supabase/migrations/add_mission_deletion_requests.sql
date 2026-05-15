-- 미션 삭제 요청 테이블
create table if not exists cad_mission_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references cad_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mission_deletion_requests_mission_id on cad_mission_deletion_requests(mission_id);
create index if not exists idx_mission_deletion_requests_user_id on cad_mission_deletion_requests(user_id);
create index if not exists idx_mission_deletion_requests_status on cad_mission_deletion_requests(status);

-- RLS
alter table cad_mission_deletion_requests enable row level security;

create policy "본인 요청 조회" on cad_mission_deletion_requests
  for select using (auth.uid() = user_id);

create policy "본인 요청 생성" on cad_mission_deletion_requests
  for insert with check (auth.uid() = user_id);
