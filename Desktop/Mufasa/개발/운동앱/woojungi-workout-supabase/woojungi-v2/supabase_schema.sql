-- ① profiles 테이블
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  color text default '#FF4D6D',
  routines text,        -- JSON string
  ex_library text,      -- JSON string
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "본인만 읽기" on profiles for select using (auth.uid() = id);
create policy "본인만 수정" on profiles for all using (auth.uid() = id);
-- 피드용: 다른 유저 프로필도 읽을 수 있음
create policy "전체 읽기" on profiles for select using (true);

-- ② sessions 테이블
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  date date not null,
  data text not null,   -- JSON string (groups, condition, bodyWeight)
  created_at timestamptz default now()
);
alter table sessions enable row level security;
create policy "본인 세션 관리" on sessions for all using (auth.uid() = user_id);
-- 피드용: 팔로우 없이 전체 공개 (프라이버시는 앱에서 처리)
create policy "전체 세션 읽기" on sessions for select using (true);

-- ③ drafts 테이블 (운동 중 임시저장)
create table if not exists drafts (
  user_id uuid primary key references auth.users on delete cascade,
  data text,
  updated_at timestamptz default now()
);
alter table drafts enable row level security;
create policy "본인 드래프트만" on drafts for all using (auth.uid() = user_id);

-- ④ 신규 가입 시 profiles 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '운동러'),
    '#FF4D6D'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
