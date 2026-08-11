-- Phase 14: AI Camera + AI Business Intelligence (isolated service layer)

insert into public.permissions (key, module, action, description) values
  ('ai.recognize', 'ai', 'recognize', 'Use AI camera product recognition'),
  ('ai.insights', 'ai', 'insights', 'View AI business intelligence insights'),
  ('ai.manage', 'ai', 'manage', 'Configure AI thresholds and settings')
on conflict (key) do nothing;

create table if not exists public.ai_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  confidence_threshold numeric(5,4) not null default 0.7800
    check (confidence_threshold >= 0 and confidence_threshold <= 1),
  fast_days int not null default 30 check (fast_days > 0),
  slow_days int not null default 90 check (slow_days > 0),
  stagnant_days int not null default 180 check (stagnant_days > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

create table if not exists public.ai_recognition_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid null references public.branches(id),
  warehouse_id uuid null references public.warehouses(id),
  source text not null default 'api'
    check (source in ('pos','ai_camera','catalog','api')),
  status text not null
    check (status in ('exact','similar','uncertain','none','confirmed','rejected')),
  confidence_threshold numeric(5,4) not null,
  top_confidence numeric(5,4) not null default 0,
  signals_json jsonb not null default '{}'::jsonb,
  candidates_json jsonb not null default '[]'::jsonb,
  explanations_json jsonb not null default '[]'::jsonb,
  trace_json jsonb not null default '[]'::jsonb,
  selected_product_id uuid null references public.products(id),
  image_mime_type text null,
  image_byte_length int null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz null,
  confirm_action text null
    check (confirm_action is null or confirm_action in (
      'confirm_match','manual_select','manual_search','new_product'
    ))
);

create index if not exists ai_recognition_events_org_created_idx
  on public.ai_recognition_events (organization_id, created_at desc);

create table if not exists public.ai_insight_cache (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  kind text not null,
  branch_id uuid null,
  warehouse_id uuid null,
  params_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null,
  explanations_json jsonb not null default '[]'::jsonb,
  sources_json jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists ai_insight_cache_org_kind_idx
  on public.ai_insight_cache (organization_id, kind, generated_at desc);

alter table public.ai_settings enable row level security;
alter table public.ai_recognition_events enable row level security;
alter table public.ai_insight_cache enable row level security;

create policy ai_settings_org on public.ai_settings for all
  using (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
  with check (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

create policy ai_recognition_events_org on public.ai_recognition_events for all
  using (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
  with check (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

create policy ai_insight_cache_org on public.ai_insight_cache for all
  using (organization_id = (auth.jwt() ->> 'organization_id')::uuid)
  with check (organization_id = (auth.jwt() ->> 'organization_id')::uuid);
