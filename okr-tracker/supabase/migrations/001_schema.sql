-- =====================================================================
-- OKR Tracker 2027 – Living Goods · schéma Postgres / Supabase
-- Hiérarchie : global_objectives → global_krs → contributions → entity_krs
--              → indicators → indicator_values (mesure des résultats, historique)
--              → initiatives → milestones → milestone_updates (historique)
-- Cascade : entity_krs.department_id = département global auquel répond un KR pays.
-- Les identifiants sont des textes stables calculés à l'import (voir src/lib/import/ids.ts) :
-- un réimport de l'Excel retrouve les mêmes lignes et conserve les check-ins.
-- =====================================================================

create type entity_type as enum ('Country', 'GlobalTeam');
create type kr_role as enum ('Lead', 'Contributes');
create type kr_scope as enum ('Pays', 'Global');
create type metric_type as enum ('Numeric', 'Percentage', 'Yes/No', 'Date', 'Other');
create type milestone_status as enum ('not_started', 'in_progress', 'achieved', 'late', 'cancelled');
create type app_role as enum ('admin', 'country_lead', 'team_lead', 'viewer');

-- ---------------------------------------------------------------- référentiel
create table entities (
  id          text primary key,              -- 'kenya', 'gp-pei', 'gse'…
  name        text not null,
  type        entity_type not null,
  "group"     text,                          -- 'Global Programs' pour Innovations / PEI / PSE
  sheet       text
);

create table global_objectives (
  id     text primary key,                   -- 'O1'
  code   text not null,
  title  text not null,
  color  text not null
);

create table global_krs (
  id            text primary key,            -- 'KR1.1'
  objective_id  text not null references global_objectives(id) on delete cascade,
  title         text not null
);

create table entity_objectives (
  id         text primary key,
  entity_id  text not null references entities(id) on delete cascade,
  title      text not null
);

create table entity_krs (
  id             text primary key,
  entity_id      text not null references entities(id) on delete cascade,
  objective_id   text references entity_objectives(id) on delete set null,
  title          text not null,
  lead           text not null default '',
  team_unit      text,
  register_only  boolean not null default false,
  -- cascade : département global auquel répond ce KR pays (déduit de Team/Unit ou du registre, modifiable)
  department_id     text references entities(id) on delete set null,
  department_source text check (department_source in ('unit', 'ref', 'manual'))
);

-- Table de liaison KR global ↔ KR pays/équipe (onglet "1 OKR Register")
create table contributions (
  id            text primary key,
  global_kr_id  text not null references global_krs(id) on delete cascade,
  entity_kr_id  text not null references entity_krs(id) on delete cascade,
  entity_id     text not null references entities(id) on delete cascade,
  role          kr_role not null,
  weight        numeric check (weight is null or weight >= 0),  -- null = poids par défaut du rôle
  scope         kr_scope not null default 'Pays',
  inferred      boolean not null default false,
  unique (global_kr_id, entity_kr_id)
);

create table initiatives (
  id                 text primary key,
  entity_kr_id       text not null references entity_krs(id) on delete cascade,
  entity_id          text not null references entities(id) on delete cascade, -- dénormalisé pour la RLS
  title              text not null,
  lead               text not null default '',
  team_unit          text,
  baseline           text not null default '',
  metric             metric_type not null default 'Other',
  evidence_rule      text not null default '',
  budget             text not null default '',
  budget_value       numeric,
  target_country_ids text[] not null default '{}',
  "order"            int not null default 0
);

create table milestones (
  id             text primary key,           -- '<initiative>-q1'
  initiative_id  text not null references initiatives(id) on delete cascade,
  entity_id      text not null references entities(id) on delete cascade, -- dénormalisé pour la RLS
  quarter        smallint not null check (quarter between 1 and 4),
  description    text not null default '',
  status         milestone_status not null default 'not_started',
  evidence_url   text not null default '',
  comment        text not null default '',
  updated_at     timestamptz,
  updated_by     text
);

-- Historique des check-ins : insertion seule, jamais modifié
create table milestone_updates (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  text not null references milestones(id) on delete cascade,
  status        milestone_status not null,
  evidence_url  text not null default '',
  comment       text not null default '',
  created_at    timestamptz not null default now(),
  author        text not null default ''
);

-- Indicateurs de mesure des KR : avancement = (valeur − baseline) / (cible − baseline)
create table indicators (
  id               text primary key,
  entity_kr_id     text not null references entity_krs(id) on delete cascade,
  entity_id        text not null references entities(id) on delete cascade, -- dénormalisé pour la RLS
  initiative_id    text references initiatives(id) on delete set null,
  name             text not null,
  metric           metric_type not null default 'Numeric',
  unit             text not null default '',
  baseline         numeric,
  baseline_text    text not null default '',
  target           numeric,
  quarter_targets  numeric[] not null default '{null,null,null,null}',
  source           text not null default '',
  frequency        text not null default 'Trimestrielle',
  origin           text not null default 'manual' check (origin in ('import', 'manual')),
  "order"          int not null default 0
);

-- Valeurs trimestrielles (insertion seule : la plus récente par trimestre fait foi)
create table indicator_values (
  id            uuid primary key default gen_random_uuid(),
  indicator_id  text not null references indicators(id) on delete cascade,
  quarter       smallint not null check (quarter between 1 and 4),
  value         numeric,
  evidence_url  text not null default '',
  comment       text not null default '',
  created_at    timestamptz not null default now(),
  author        text not null default ''
);

create table annex_tables (
  id     text primary key,
  sheet  text not null,
  rows   jsonb not null
);

-- Paramètres (une seule ligne)
create table settings (
  id               int primary key default 1 check (id = 1),
  weight_lead      numeric not null default 2,
  weight_contrib   numeric not null default 1,
  rag_green        numeric not null default 70,
  rag_amber        numeric not null default 40,
  late_score       numeric not null default 0,
  current_quarter  smallint not null default 1 check (current_quarter between 1 and 4),
  kr_method        text not null default 'mix' check (kr_method in ('mix', 'milestones', 'indicators')),
  last_import      jsonb
);
insert into settings (id) values (1);

-- ---------------------------------------------------------------- utilisateurs
create table profiles (
  id     uuid primary key references auth.users(id) on delete cascade,
  email  text not null,
  name   text not null default '',
  role   app_role not null default 'viewer'
);

-- Périmètre d'édition d'un Lead pays / Lead équipe
create table user_entities (
  user_id    uuid references profiles(id) on delete cascade,
  entity_id  text references entities(id) on delete cascade,
  primary key (user_id, entity_id)
);

-- Profil créé automatiquement à l'inscription (rôle Lecteur par défaut)
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- index
create index on entity_krs (entity_id);
create index on contributions (global_kr_id);
create index on contributions (entity_kr_id);
create index on initiatives (entity_kr_id);
create index on milestones (initiative_id);
create index on milestone_updates (milestone_id, created_at desc);
create index on indicators (entity_kr_id);
create index on indicator_values (indicator_id, quarter, created_at desc);
create index on entity_krs (department_id);

-- ---------------------------------------------------------------- fonctions de droits
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Lead pays : uniquement son pays ; Lead équipe : uniquement son équipe ; Admin : tout.
create function can_edit_entity(eid text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from profiles p join user_entities ue on ue.user_id = p.id
    where p.id = auth.uid() and p.role in ('country_lead', 'team_lead') and ue.entity_id = eid
  );
$$;

-- Un check-in met à jour l'état courant du jalon (l'historique reste dans milestone_updates)
create function apply_milestone_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update milestones set status = new.status,
    evidence_url = new.evidence_url, comment = new.comment, updated_at = new.created_at, updated_by = new.author
  where id = new.milestone_id;
  return new;
end $$;
create trigger on_milestone_update after insert on milestone_updates
  for each row execute function apply_milestone_update();

-- ---------------------------------------------------------------- Row Level Security
alter table entities           enable row level security;
alter table global_objectives  enable row level security;
alter table global_krs         enable row level security;
alter table entity_objectives  enable row level security;
alter table entity_krs         enable row level security;
alter table contributions      enable row level security;
alter table initiatives        enable row level security;
alter table milestones         enable row level security;
alter table milestone_updates  enable row level security;
alter table annex_tables       enable row level security;
alter table indicators         enable row level security;
alter table indicator_values   enable row level security;
alter table settings           enable row level security;
alter table profiles           enable row level security;
alter table user_entities      enable row level security;

-- Lecture : tout utilisateur connecté (Lecteur compris)
do $$
declare t text;
begin
  foreach t in array array['entities','global_objectives','global_krs','entity_objectives','entity_krs',
    'contributions','initiatives','milestones','milestone_updates','annex_tables','settings','user_entities',
    'indicators','indicator_values']
  loop
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Référentiel global, liens, pondérations, annexes, paramètres : Admin uniquement
do $$
declare t text;
begin
  foreach t in array array['entities','global_objectives','global_krs','contributions','annex_tables','settings']
  loop
    execute format('create policy admin_write on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Objets propres à une entité : Admin, ou Lead de cette entité
create policy entity_write on entity_objectives for all to authenticated
  using (can_edit_entity(entity_id)) with check (can_edit_entity(entity_id));
create policy entity_write on entity_krs for all to authenticated
  using (can_edit_entity(entity_id)) with check (can_edit_entity(entity_id));
create policy entity_write on initiatives for all to authenticated
  using (can_edit_entity(entity_id)) with check (can_edit_entity(entity_id));
create policy entity_write on milestones for update to authenticated
  using (can_edit_entity(entity_id)) with check (can_edit_entity(entity_id));
create policy admin_write on milestones for all to authenticated
  using (is_admin()) with check (is_admin());

create policy entity_write on indicators for all to authenticated
  using (can_edit_entity(entity_id)) with check (can_edit_entity(entity_id));
create policy value_insert on indicator_values for insert to authenticated
  with check (can_edit_entity((select i.entity_id from indicators i where i.id = indicator_id)));

-- Check-in : insertion par un Lead de l'entité du jalon ; l'historique n'est ni modifié ni supprimé
create policy checkin_insert on milestone_updates for insert to authenticated
  with check (can_edit_entity((select m.entity_id from milestones m where m.id = milestone_id)));

-- Profils : chacun lit le sien, l'Admin lit et gère tout
create policy own_profile on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy admin_profiles on profiles for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_user_entities on user_entities for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- import (réimport idempotent)
-- Reçoit le jeu de données calculé côté client (voir src/lib/store/supabaseStore.ts).
-- Les lignes absentes du nouveau fichier sont supprimées ; les jalons existants gardent
-- leur statut, leur valeur réelle et leur historique ; les poids personnalisés sont conservés.
create function import_dataset(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à l''administrateur'; end if;

  -- indicateurs importés absents du nouveau fichier : supprimés ; indicateurs ajoutés à la main : conservés
  delete from indicators where origin = 'import' and id not in (select x->>'id' from jsonb_array_elements(payload->'indicators') x);
  delete from contributions where id not in (select x->>'id' from jsonb_array_elements(payload->'contributions') x);
  delete from milestones where id not in (select x->>'id' from jsonb_array_elements(payload->'milestones') x);
  delete from initiatives where id not in (select x->>'id' from jsonb_array_elements(payload->'initiatives') x);
  delete from entity_krs where id not in (select x->>'id' from jsonb_array_elements(payload->'entity_krs') x);
  delete from entity_objectives where id not in (select x->>'id' from jsonb_array_elements(payload->'entity_objectives') x);
  delete from global_krs where id not in (select x->>'id' from jsonb_array_elements(payload->'global_krs') x);
  delete from global_objectives where id not in (select x->>'id' from jsonb_array_elements(payload->'global_objectives') x);
  delete from annex_tables;

  insert into entities select * from jsonb_populate_recordset(null::entities, payload->'entities')
    on conflict (id) do update set name = excluded.name, type = excluded.type, "group" = excluded."group", sheet = excluded.sheet;
  insert into global_objectives select * from jsonb_populate_recordset(null::global_objectives, payload->'global_objectives')
    on conflict (id) do update set code = excluded.code, title = excluded.title, color = excluded.color;
  insert into global_krs select * from jsonb_populate_recordset(null::global_krs, payload->'global_krs')
    on conflict (id) do update set objective_id = excluded.objective_id, title = excluded.title;
  insert into entity_objectives select * from jsonb_populate_recordset(null::entity_objectives, payload->'entity_objectives')
    on conflict (id) do update set entity_id = excluded.entity_id, title = excluded.title;
  insert into entity_krs select * from jsonb_populate_recordset(null::entity_krs, payload->'entity_krs')
    on conflict (id) do update set entity_id = excluded.entity_id, objective_id = excluded.objective_id,
      title = excluded.title, lead = excluded.lead, team_unit = excluded.team_unit, register_only = excluded.register_only,
      -- un rattachement manuel au département n'est pas écrasé par le réimport
      department_id = case when entity_krs.department_source = 'manual' then entity_krs.department_id else excluded.department_id end,
      department_source = case when entity_krs.department_source = 'manual' then 'manual' else excluded.department_source end;
  insert into contributions select * from jsonb_populate_recordset(null::contributions, payload->'contributions')
    on conflict (id) do update set role = excluded.role, scope = excluded.scope, inferred = excluded.inferred; -- weight conservé
  insert into initiatives select * from jsonb_populate_recordset(null::initiatives, payload->'initiatives')
    on conflict (id) do update set title = excluded.title, lead = excluded.lead, team_unit = excluded.team_unit,
      baseline = excluded.baseline, metric = excluded.metric,
      evidence_rule = excluded.evidence_rule, budget = excluded.budget, budget_value = excluded.budget_value,
      target_country_ids = excluded.target_country_ids, "order" = excluded."order";
  insert into milestones select * from jsonb_populate_recordset(null::milestones, payload->'milestones')
    on conflict (id) do update set description = excluded.description; -- statut, preuve conservés
  insert into indicators select * from jsonb_populate_recordset(null::indicators, payload->'indicators')
    on conflict (id) do update set entity_kr_id = excluded.entity_kr_id, entity_id = excluded.entity_id,
      initiative_id = excluded.initiative_id, metric = excluded.metric, baseline_text = excluded.baseline_text; -- nom, cibles, valeurs conservés
  insert into annex_tables select * from jsonb_populate_recordset(null::annex_tables, payload->'annex_tables');

  update settings set last_import = payload->'report' where id = 1;
end $$;

-- ---------------------------------------------------------------- vue registre (équivalent de "1 OKR Register")
create view okr_register as
select go.id as objective_id, go.title as objective, gk.id as ref, gk.title as global_kr,
       e.name as entity, e.type as entity_type, c.role, eo.title as entity_objective,
       ek.title as entity_kr, ek.lead as kr_lead, c.scope, e.sheet as go_to_plan, d.name as department
from contributions c
join global_krs gk on gk.id = c.global_kr_id
join global_objectives go on go.id = gk.objective_id
join entity_krs ek on ek.id = c.entity_kr_id
join entities e on e.id = c.entity_id
left join entity_objectives eo on eo.id = ek.objective_id
left join entities d on d.id = ek.department_id;
alter view okr_register set (security_invoker = on);
