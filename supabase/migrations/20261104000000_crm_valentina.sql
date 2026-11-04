-- =============================================================================
-- CRM de Valentina · Mavie IA Solutions
-- -----------------------------------------------------------------------------
-- Qué hace este archivo: crea las tablas del CRM y sus reglas de seguridad.
-- Cómo se usa: Supabase → SQL Editor → pegar todo → Run. Se ejecuta UNA vez.
--
-- Seguridad (resumen):
--  * RLS (Row Level Security) activado en TODAS las tablas: nadie ve ni toca
--    nada si no está dado de alta en la tabla "equipo".
--  * Los visitantes sin sesión (rol "anon") no tienen ningún permiso.
--  * El agente de Antigravity tiene su propia cuenta con rol "agente": puede
--    buscar y preparar, pero no registrar llamadas/WhatsApp ni aprobar demos.
--  * Una demo solo se aprueba por alguien con rol "admin" (Miguel).
--  * Quien pide la BAJA entra en "lista_no_contactar" y no se le puede volver
--    a registrar un envío (la base de datos lo impide).
-- =============================================================================

create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

-- -----------------------------------------------------------------------------
-- Equipo: quién puede usar el CRM y con qué rol
--   admin     → Miguel: todo, incluido aprobar demos y borrar
--   comercial → Valentina: busca, diseña, llama, escribe
--   agente    → la cuenta que usa Antigravity: busca y prepara, no contacta
--   harvey    → la cuenta del puente con Harvey: solo sus funciones (harvey_*)
-- -----------------------------------------------------------------------------
create table public.equipo (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nombre text not null,
  rol text not null check (rol in ('admin', 'comercial', 'agente', 'harvey')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create or replace function privado.mi_rol()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.rol from public.equipo e where e.user_id = auth.uid() and e.activo
$$;

-- Personas y agente (no incluye la cuenta de Harvey, que solo usa sus funciones)
create or replace function privado.es_equipo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(privado.mi_rol() in ('admin', 'comercial', 'agente'), false)
$$;

create or replace function privado.es_persona()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(privado.mi_rol() in ('admin', 'comercial'), false)
$$;

create or replace function privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(privado.mi_rol() = 'admin', false)
$$;

-- -----------------------------------------------------------------------------
-- Reglas de etapas (las mismas que crm/js/reglas.js; un test comprueba que
-- coinciden)
-- -----------------------------------------------------------------------------
create or replace function privado.etapa_objetivo(p_tipo text, p_resultado text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo || ':' || p_resultado
    when 'llamada:volver_a_llamar' then 'contactado'
    when 'llamada:acepta_whatsapp' then 'contactado'
    when 'llamada:interesado' then 'interesado'
    when 'llamada:no_interesa' then 'baja'
    when 'llamada:cliente' then 'cliente'
    when 'whatsapp:enviado' then 'contactado'
    when 'whatsapp:respondio' then 'respondio'
    when 'whatsapp:interesado' then 'interesado'
    when 'whatsapp:baja' then 'baja'
    when 'visita:volver' then 'contactado'
    when 'visita:interesado' then 'interesado'
    when 'visita:no_interesa' then 'baja'
    when 'visita:cliente' then 'cliente'
    when 'email:enviado' then 'contactado'
    when 'email:respondio' then 'respondio'
    when 'email:baja' then 'baja'
    else null
  end
$$;

create or replace function privado.avanzar_etapa(p_actual text, p_objetivo text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  orden constant text[] := array['nuevo', 'cualificado', 'en_diseno', 'demo_lista',
                                 'contactado', 'respondio', 'interesado', 'cliente'];
  a int;
  o int;
begin
  if p_objetivo is null then return p_actual; end if;
  if p_actual in ('cliente', 'baja') then return p_actual; end if;
  if p_objetivo in ('baja', 'cliente') then return p_objetivo; end if;
  if p_actual = 'descartado' then
    return case when p_objetivo in ('respondio', 'interesado') then p_objetivo else p_actual end;
  end if;
  a := array_position(orden, p_actual);
  o := array_position(orden, p_objetivo);
  if o is null then return p_actual; end if;
  return case when o > coalesce(a, 0) then p_objetivo else p_actual end;
end
$$;

create or replace function privado.resultado_valido(p_tipo text, p_resultado text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'llamada' then p_resultado in ('no_contesta', 'buzon', 'volver_a_llamar', 'acepta_whatsapp',
                                        'interesado', 'no_interesa', 'numero_erroneo', 'cliente')
    when 'whatsapp' then p_resultado in ('enviado', 'respondio', 'interesado', 'baja')
    when 'visita' then p_resultado in ('no_estaba', 'volver', 'interesado', 'no_interesa', 'cliente')
    when 'email' then p_resultado in ('enviado', 'respondio', 'baja')
    when 'nota' then p_resultado = ''
    when 'sistema' then p_resultado = ''
    else false
  end
$$;

-- -----------------------------------------------------------------------------
-- Lista de NO contactar (bajas y negocios que ya lleva Harvey)
-- -----------------------------------------------------------------------------
create table public.lista_no_contactar (
  telefono text primary key check (telefono ~ '^\+[0-9]{8,15}$'),
  motivo text not null default 'baja' check (motivo in ('baja', 'harvey', 'cliente', 'otro')),
  origen text not null default 'valentina' check (origen in ('valentina', 'harvey')),
  nota text not null default '' check (char_length(nota) <= 500),
  creado_en timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Negocios (los "leads")
-- -----------------------------------------------------------------------------
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 200),
  sector text not null default '' check (char_length(sector) <= 100),
  direccion text not null default '' check (char_length(direccion) <= 300),
  municipio text not null default '' check (char_length(municipio) <= 100),
  codigo_postal text not null default '' check (codigo_postal ~ '^([0-9]{5})?$' or codigo_postal ~ '^GX'),
  telefono text check (telefono ~ '^\+[0-9]{8,15}$'),
  telefono_tipo text not null default 'otro' check (telefono_tipo in ('movil', 'fijo', 'otro')),
  email text not null default '' check (char_length(email) <= 200),
  web text not null default '' check (char_length(web) <= 500),
  web_tipo text not null default 'sin_web' check (web_tipo in ('sin_web', 'redes', 'directorio', 'propia')),
  posible_web text not null default '' check (char_length(posible_web) <= 500),
  instagram text not null default '' check (char_length(instagram) <= 300),
  maps_url text not null default '' check (char_length(maps_url) <= 1000),
  valoracion numeric(2, 1) check (valoracion between 0 and 5),
  num_resenas integer not null default 0 check (num_resenas >= 0),
  horario jsonb,
  lat double precision,
  lng double precision,
  fuente text not null default 'manual' check (fuente in ('serper', 'osm', 'manual', 'harvey')),
  fuente_id text unique check (char_length(fuente_id) <= 200),
  puntuacion integer not null default 0 check (puntuacion between 0 and 100),
  sanitario boolean not null default false,
  etapa text not null default 'nuevo' check (etapa in ('nuevo', 'cualificado', 'en_diseno', 'demo_lista',
    'contactado', 'respondio', 'interesado', 'cliente', 'descartado', 'baja')),
  no_contactar boolean not null default false,
  motivo_no_contactar text not null default '' check (char_length(motivo_no_contactar) <= 300),
  permiso_whatsapp boolean not null default false,
  proxima_accion_en timestamptz,
  proxima_accion text not null default '' check (char_length(proxima_accion) <= 300),
  notas text not null default '' check (char_length(notas) <= 5000),
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index negocios_telefono_unico on public.negocios (telefono) where telefono is not null;
create index negocios_etapa on public.negocios (etapa);
create index negocios_proxima on public.negocios (proxima_accion_en) where proxima_accion_en is not null;

create or replace function privado.antes_de_guardar_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bloqueo public.lista_no_contactar%rowtype;
begin
  new.actualizado_en := now();
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_en := now();
  end if;
  if tg_op = 'UPDATE' and old.no_contactar and not new.no_contactar and not privado.es_admin()
     and not (auth.uid() is null and session_user in ('postgres', 'supabase_admin')) then
    raise exception 'Solo un administrador puede volver a permitir el contacto con este negocio.';
  end if;
  if new.telefono is not null then
    select * into bloqueo from public.lista_no_contactar l where l.telefono = new.telefono;
    -- Una baja es para siempre: aunque alguien cambie la etapa, vuelve a "baja".
    -- Solo un admin puede deshacerla, quitando antes el teléfono de la lista.
    if found and bloqueo.motivo = 'baja' then
      new.no_contactar := true;
      new.motivo_no_contactar := 'Pidió la baja';
      new.etapa := 'baja';
    elsif found and (tg_op = 'INSERT' or new.telefono is distinct from old.telefono) then
      new.no_contactar := true;
      new.motivo_no_contactar := case bloqueo.motivo
        when 'harvey' then 'Lo lleva Harvey'
        when 'cliente' then 'Ya es cliente'
        else 'En la lista de no contactar' end;
    end if;
  end if;
  if new.etapa = 'baja' and not new.no_contactar then
    new.no_contactar := true;
    if new.motivo_no_contactar = '' then new.motivo_no_contactar := 'Pidió la baja'; end if;
  end if;
  return new;
end
$$;

create trigger negocios_antes_de_guardar
before insert or update on public.negocios
for each row execute function privado.antes_de_guardar_negocio();

-- Si un negocio pasa a "baja", su teléfono entra en la lista para siempre.
create or replace function privado.tras_guardar_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.etapa = 'baja' and new.telefono is not null
     and (tg_op = 'INSERT' or old.etapa is distinct from 'baja') then
    insert into public.lista_no_contactar (telefono, motivo, origen)
    values (new.telefono, 'baja', 'valentina')
    on conflict (telefono) do update set motivo = 'baja';
  end if;
  return null;
end
$$;

create trigger negocios_tras_guardar
after insert or update of etapa on public.negocios
for each row execute function privado.tras_guardar_negocio();

-- -----------------------------------------------------------------------------
-- Demos (una web de muestra por negocio)
--   diseno → revision → aprobada (solo admin) → publicada → archivada
-- -----------------------------------------------------------------------------
create table public.demos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  marca text not null default '' check (char_length(marca) <= 120),
  estilo text not null default '' check (char_length(estilo) <= 40),
  estado text not null default 'diseno' check (estado in ('diseno', 'revision', 'aprobada', 'publicada', 'archivada')),
  url text not null default '' check (url = '' or url ~ '^https://[^\s]+$'),
  notas_revision text not null default '' check (char_length(notas_revision) <= 2000),
  creada_por uuid default auth.uid() references auth.users (id) on delete set null,
  aprobada_por uuid references auth.users (id) on delete set null,
  aprobada_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index demos_una_activa_por_negocio on public.demos (negocio_id) where estado <> 'archivada';

create or replace function privado.antes_de_guardar_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desde_sql boolean := auth.uid() is null and session_user in ('postgres', 'supabase_admin');
begin
  new.actualizado_en := now();
  if tg_op = 'INSERT' then
    new.creada_por := coalesce(auth.uid(), new.creada_por);
    new.creado_en := now();
    if new.estado not in ('diseno', 'revision') and not desde_sql then
      raise exception 'Una demo nueva empieza en diseño o revisión; la aprobación la hace Miguel.';
    end if;
    new.aprobada_por := null;
    new.aprobada_en := null;
    return new;
  end if;

  if new.estado = 'aprobada' and old.estado is distinct from 'aprobada' then
    if not (privado.es_admin() or desde_sql) then
      raise exception 'Solo un administrador (Miguel) puede aprobar una demo.';
    end if;
    new.aprobada_por := auth.uid();
    new.aprobada_en := now();
  elsif new.estado = 'publicada' and old.estado not in ('aprobada', 'publicada') then
    raise exception 'La demo tiene que estar aprobada antes de publicarse.';
  elsif new.estado in ('diseno', 'revision') then
    new.aprobada_por := null;
    new.aprobada_en := null;
  else
    new.aprobada_por := old.aprobada_por;
    new.aprobada_en := old.aprobada_en;
  end if;
  return new;
end
$$;

create trigger demos_antes_de_guardar
before insert or update on public.demos
for each row execute function privado.antes_de_guardar_demo();

create or replace function privado.tras_guardar_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  objetivo text;
begin
  objetivo := case
    when new.estado in ('aprobada', 'publicada') then 'demo_lista'
    when new.estado in ('diseno', 'revision') then 'en_diseno'
    else null end;
  if objetivo is not null then
    update public.negocios n
       set etapa = privado.avanzar_etapa(n.etapa, objetivo)
     where n.id = new.negocio_id;
  end if;
  return null;
end
$$;

create trigger demos_tras_guardar
after insert or update of estado on public.demos
for each row execute function privado.tras_guardar_demo();

-- -----------------------------------------------------------------------------
-- Actividades: llamadas, WhatsApp, visitas, notas (historial de cada negocio)
-- -----------------------------------------------------------------------------
create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  tipo text not null check (tipo in ('llamada', 'whatsapp', 'visita', 'email', 'nota', 'sistema')),
  resultado text not null default '',
  modo text not null default '' check (modo in ('', 'frio', 'seguimiento', 'conversacion')),
  detalle text not null default '' check (char_length(detalle) <= 4000),
  proxima_accion_en timestamptz,
  proxima_accion text not null default '' check (char_length(proxima_accion) <= 300),
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint actividades_resultado_valido check (privado.resultado_valido(tipo, resultado))
);

create index actividades_negocio on public.actividades (negocio_id, creado_en desc);
create index actividades_fecha on public.actividades (creado_en desc);

create or replace function privado.antes_de_guardar_actividad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.negocios%rowtype;
begin
  new.creado_por := coalesce(auth.uid(), new.creado_por);
  new.creado_en := now();
  if new.tipo in ('llamada', 'whatsapp', 'visita', 'email') and privado.mi_rol() = 'agente' then
    raise exception 'El agente no registra contactos: las llamadas y los mensajes los hace una persona.';
  end if;
  select * into n from public.negocios where id = new.negocio_id;
  if found and n.no_contactar
     and ((new.tipo in ('whatsapp', 'email') and new.resultado = 'enviado')
          or (new.tipo = 'llamada' and new.resultado not in ('no_interesa'))) then
    raise exception 'No se puede contactar con este negocio: %.', n.motivo_no_contactar;
  end if;
  return new;
end
$$;

create trigger actividades_antes_de_guardar
before insert on public.actividades
for each row execute function privado.antes_de_guardar_actividad();

create or replace function privado.tras_guardar_actividad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  objetivo text := privado.etapa_objetivo(new.tipo, new.resultado);
  es_contacto boolean := new.tipo in ('llamada', 'whatsapp', 'visita', 'email');
begin
  update public.negocios n
     set etapa = privado.avanzar_etapa(n.etapa, objetivo),
         permiso_whatsapp = n.permiso_whatsapp or (new.tipo = 'llamada' and new.resultado = 'acepta_whatsapp'),
         motivo_no_contactar = case when objetivo = 'baja' then 'Pidió la baja' else n.motivo_no_contactar end,
         proxima_accion_en = case when es_contacto or new.proxima_accion_en is not null
                                  then new.proxima_accion_en else n.proxima_accion_en end,
         proxima_accion = case when es_contacto or new.proxima_accion_en is not null
                               then new.proxima_accion else n.proxima_accion end
   where n.id = new.negocio_id;
  return null;
end
$$;

create trigger actividades_tras_guardar
after insert on public.actividades
for each row execute function privado.tras_guardar_actividad();

-- -----------------------------------------------------------------------------
-- Plantillas de mensajes (las de serie están en crm/js/plantillas-base.js;
-- aquí se guardan solo las que se personalizan)
-- -----------------------------------------------------------------------------
create table public.plantillas (
  clave text primary key check (clave ~ '^[a-z0-9_]{2,40}$'),
  canal text not null check (canal in ('whatsapp', 'llamada', 'email')),
  modo text not null default '' check (modo in ('', 'frio', 'seguimiento', 'conversacion', 'llamada')),
  nombre text not null check (char_length(nombre) between 1 and 120),
  texto text not null check (char_length(texto) between 1 and 4000),
  actualizado_por uuid default auth.uid() references auth.users (id) on delete set null,
  actualizado_en timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Registro de búsquedas (para controlar los créditos gratis de la API)
-- -----------------------------------------------------------------------------
create table public.busquedas (
  id uuid primary key default gen_random_uuid(),
  consulta text not null check (char_length(consulta) <= 200),
  municipio text not null default '' check (char_length(municipio) <= 100),
  fuente text not null check (fuente in ('serper', 'osm', 'manual', 'harvey')),
  resultados integer not null default 0,
  nuevos integer not null default 0,
  sin_web integer not null default 0,
  creditos integer not null default 0,
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en timestamptz not null default now()
);

-- =============================================================================
-- Permisos: primero se quita todo, luego se da lo justo
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;

grant select on public.equipo to authenticated;
grant select, insert, update, delete on public.negocios to authenticated;
grant select, insert, update, delete on public.demos to authenticated;
grant select, insert, update, delete on public.actividades to authenticated;
grant select, insert, update, delete on public.plantillas to authenticated;
grant select, insert, update, delete on public.lista_no_contactar to authenticated;
grant select, insert on public.busquedas to authenticated;

alter table public.equipo enable row level security;
alter table public.negocios enable row level security;
alter table public.demos enable row level security;
alter table public.actividades enable row level security;
alter table public.plantillas enable row level security;
alter table public.lista_no_contactar enable row level security;
alter table public.busquedas enable row level security;

-- equipo: cada miembro ve al equipo; nadie lo cambia desde la web
create policy equipo_ver on public.equipo for select to authenticated
  using (privado.es_equipo() or user_id = auth.uid());

-- negocios
create policy negocios_ver on public.negocios for select to authenticated using (privado.es_equipo());
create policy negocios_crear on public.negocios for insert to authenticated with check (privado.es_equipo());
create policy negocios_editar on public.negocios for update to authenticated
  using (privado.es_equipo()) with check (privado.es_equipo());
create policy negocios_borrar on public.negocios for delete to authenticated using (privado.es_admin());

-- demos
create policy demos_ver on public.demos for select to authenticated using (privado.es_equipo());
create policy demos_crear on public.demos for insert to authenticated with check (privado.es_equipo());
create policy demos_editar on public.demos for update to authenticated
  using (privado.es_equipo()) with check (privado.es_equipo());
create policy demos_borrar on public.demos for delete to authenticated using (privado.es_admin());

-- actividades: el historial no se reescribe (solo admin puede corregir)
create policy actividades_ver on public.actividades for select to authenticated using (privado.es_equipo());
create policy actividades_crear on public.actividades for insert to authenticated with check (privado.es_equipo());
create policy actividades_editar on public.actividades for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());
create policy actividades_borrar on public.actividades for delete to authenticated using (privado.es_admin());

-- plantillas: las cambian las personas, el agente solo las lee
create policy plantillas_ver on public.plantillas for select to authenticated using (privado.es_equipo());
create policy plantillas_crear on public.plantillas for insert to authenticated with check (privado.es_persona());
create policy plantillas_editar on public.plantillas for update to authenticated
  using (privado.es_persona()) with check (privado.es_persona());
create policy plantillas_borrar on public.plantillas for delete to authenticated using (privado.es_admin());

-- lista de no contactar: cualquiera del equipo añade; solo admin quita
create policy nocontactar_ver on public.lista_no_contactar for select to authenticated using (privado.es_equipo());
create policy nocontactar_crear on public.lista_no_contactar for insert to authenticated with check (privado.es_equipo());
create policy nocontactar_editar on public.lista_no_contactar for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());
create policy nocontactar_borrar on public.lista_no_contactar for delete to authenticated using (privado.es_admin());

-- búsquedas
create policy busquedas_ver on public.busquedas for select to authenticated using (privado.es_equipo());
create policy busquedas_crear on public.busquedas for insert to authenticated with check (privado.es_equipo());

-- Funciones internas: nadie las llama directamente salvo las políticas
revoke all on all functions in schema privado from public, anon;
grant execute on function privado.mi_rol(), privado.es_equipo(), privado.es_persona(), privado.es_admin(),
  privado.resultado_valido(text, text) to authenticated;

-- =============================================================================
-- Funciones que se llaman desde la web o los scripts (RPC)
-- =============================================================================

-- Importa una lista de negocios encontrados. Respeta RLS (security invoker)
-- y se salta los duplicados (mismo teléfono o mismo id de Google Maps) y los
-- que están en la lista de no contactar.
create or replace function public.importar_negocios(lista jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  insertados int := 0;
  duplicados int := 0;
  bloqueados int := 0;
  filas int;
  tel text;
begin
  if not privado.es_equipo() then
    raise exception 'No tienes permiso.';
  end if;
  if jsonb_typeof(lista) <> 'array' or jsonb_array_length(lista) > 200 then
    raise exception 'Envía una lista de como mucho 200 negocios.';
  end if;
  for item in select * from jsonb_array_elements(lista) loop
    tel := nullif(item ->> 'telefono', '');
    if tel is not null and exists (select 1 from public.lista_no_contactar l where l.telefono = tel) then
      bloqueados := bloqueados + 1;
      continue;
    end if;
    insert into public.negocios (nombre, sector, direccion, municipio, codigo_postal, telefono, telefono_tipo,
      email, web, web_tipo, instagram, maps_url, valoracion, num_resenas, horario, lat, lng, fuente, fuente_id,
      puntuacion, sanitario, notas)
    values (
      item ->> 'nombre',
      coalesce(item ->> 'sector', ''),
      coalesce(item ->> 'direccion', ''),
      coalesce(item ->> 'municipio', ''),
      coalesce(item ->> 'codigo_postal', ''),
      tel,
      coalesce(item ->> 'telefono_tipo', 'otro'),
      coalesce(item ->> 'email', ''),
      coalesce(item ->> 'web', ''),
      coalesce(item ->> 'web_tipo', 'sin_web'),
      coalesce(item ->> 'instagram', ''),
      coalesce(item ->> 'maps_url', ''),
      (item ->> 'valoracion')::numeric,
      coalesce((item ->> 'num_resenas')::int, 0),
      item -> 'horario',
      (item ->> 'lat')::double precision,
      (item ->> 'lng')::double precision,
      coalesce(item ->> 'fuente', 'manual'),
      nullif(item ->> 'fuente_id', ''),
      coalesce((item ->> 'puntuacion')::int, 0),
      coalesce((item ->> 'sanitario')::boolean, false),
      coalesce(item ->> 'notas', '')
    )
    on conflict do nothing;
    get diagnostics filas = row_count;
    if filas = 1 then insertados := insertados + 1; else duplicados := duplicados + 1; end if;
  end loop;
  return jsonb_build_object('insertados', insertados, 'duplicados', duplicados, 'bloqueados', bloqueados);
end
$$;

revoke all on function public.importar_negocios(jsonb) from public, anon;
grant execute on function public.importar_negocios(jsonb) to authenticated;

-- Da de alta a alguien del equipo. Antes, crea su usuario en
-- Supabase → Authentication → Users → Add user.
-- Uso (SQL Editor): select public.alta_equipo('correo@ejemplo.com', 'Valentina', 'comercial');
create or replace function public.alta_equipo(p_email text, p_nombre text, p_rol text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if not (privado.es_admin() or (auth.uid() is null and session_user in ('postgres', 'supabase_admin'))) then
    raise exception 'Solo un administrador puede dar de alta al equipo.';
  end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    raise exception 'No existe ningún usuario con el correo %. Créalo primero en Authentication → Users.', p_email;
  end if;
  insert into public.equipo (user_id, email, nombre, rol)
  values (uid, lower(p_email), p_nombre, p_rol)
  on conflict (user_id) do update set nombre = excluded.nombre, rol = excluded.rol, activo = true;
  return format('%s dado de alta como %s', p_nombre, p_rol);
end
$$;

revoke all on function public.alta_equipo(text, text, text) from public, anon;
grant execute on function public.alta_equipo(text, text, text) to authenticated;

-- =============================================================================
-- Puente con Harvey (solo para la cuenta con rol "harvey")
-- Ver docs/06-puente-harvey.md
-- =============================================================================

-- Harvey envía negocios que ha encontrado SIN web (él vende apps; Valentina, webs).
create or replace function public.harvey_enviar_negocios(lista jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  insertados int := 0;
  duplicados int := 0;
  bloqueados int := 0;
  filas int;
  tel text;
begin
  if coalesce(privado.mi_rol(), '') <> 'harvey' then
    raise exception 'Solo la cuenta de Harvey puede usar esta función.';
  end if;
  if jsonb_typeof(lista) <> 'array' or jsonb_array_length(lista) > 200 then
    raise exception 'Envía una lista de como mucho 200 negocios.';
  end if;
  for item in select * from jsonb_array_elements(lista) loop
    tel := nullif(item ->> 'telefono', '');
    if tel is not null and exists (select 1 from public.lista_no_contactar l where l.telefono = tel) then
      bloqueados := bloqueados + 1;
      continue;
    end if;
    insert into public.negocios (nombre, sector, direccion, municipio, codigo_postal, telefono, telefono_tipo,
      web, web_tipo, maps_url, valoracion, num_resenas, fuente, fuente_id, notas)
    values (
      item ->> 'nombre',
      coalesce(item ->> 'sector', ''),
      coalesce(item ->> 'direccion', ''),
      coalesce(item ->> 'municipio', ''),
      coalesce(item ->> 'codigo_postal', ''),
      tel,
      coalesce(item ->> 'telefono_tipo', 'otro'),
      coalesce(item ->> 'web', ''),
      coalesce(item ->> 'web_tipo', 'sin_web'),
      coalesce(item ->> 'maps_url', ''),
      (item ->> 'valoracion')::numeric,
      coalesce((item ->> 'num_resenas')::int, 0),
      'harvey',
      'harvey:' || (item ->> 'harvey_id'),
      'Enviado por Harvey: ' || coalesce(item ->> 'motivo', 'sin web')
    )
    on conflict do nothing;
    get diagnostics filas = row_count;
    if filas = 1 then insertados := insertados + 1; else duplicados := duplicados + 1; end if;
  end loop;
  return jsonb_build_object('insertados', insertados, 'duplicados', duplicados, 'bloqueados', bloqueados);
end
$$;

-- Harvey avisa de teléfonos que no hay que tocar: los que él lleva ('harvey')
-- o los que le pidieron la baja ('baja').
create or replace function public.harvey_no_contactar(telefonos text[], p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
  marcados int := 0;
  conflictos text[] := '{}';
begin
  if coalesce(privado.mi_rol(), '') <> 'harvey' then
    raise exception 'Solo la cuenta de Harvey puede usar esta función.';
  end if;
  if p_motivo not in ('harvey', 'baja') then
    raise exception 'El motivo tiene que ser harvey o baja.';
  end if;
  if coalesce(array_length(telefonos, 1), 0) > 500 then
    raise exception 'Como mucho 500 teléfonos por llamada.';
  end if;
  foreach t in array coalesce(telefonos, '{}') loop
    if t !~ '^\+[0-9]{8,15}$' then continue; end if;
    insert into public.lista_no_contactar (telefono, motivo, origen)
    values (t, p_motivo, 'harvey')
    on conflict (telefono) do update
      set motivo = case when public.lista_no_contactar.motivo = 'baja' then 'baja' else excluded.motivo end;
    marcados := marcados + 1;
    -- Si Valentina aún no ha contactado, se bloquea. Si ya lo hizo, se avisa.
    if p_motivo = 'baja' then
      update public.negocios set etapa = 'baja' where telefono = t;
    else
      update public.negocios
         set no_contactar = true, motivo_no_contactar = 'Lo lleva Harvey'
       where telefono = t and etapa in ('nuevo', 'cualificado');
      if exists (select 1 from public.negocios where telefono = t
                 and etapa not in ('nuevo', 'cualificado', 'descartado', 'baja')) then
        conflictos := conflictos || t;
      end if;
    end if;
  end loop;
  return jsonb_build_object('marcados', marcados, 'ya_contactados_por_valentina', to_jsonb(conflictos));
end
$$;

-- Teléfonos que Harvey NO debe contactar porque ya los trabaja Valentina o
-- pidieron la baja.
create or replace function public.harvey_telefonos_ocupados()
returns table (telefono text, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(privado.mi_rol(), '') <> 'harvey' then
    raise exception 'Solo la cuenta de Harvey puede usar esta función.';
  end if;
  return query
    select n.telefono, 'valentina'::text
      from public.negocios n
     where n.telefono is not null
       and n.etapa not in ('nuevo', 'descartado', 'baja')
    union
    select l.telefono, 'baja'::text
      from public.lista_no_contactar l
     where l.motivo = 'baja';
end
$$;

revoke all on function public.harvey_enviar_negocios(jsonb) from public, anon;
revoke all on function public.harvey_no_contactar(text[], text) from public, anon;
revoke all on function public.harvey_telefonos_ocupados() from public, anon;
grant execute on function public.harvey_enviar_negocios(jsonb) to authenticated;
grant execute on function public.harvey_no_contactar(text[], text) to authenticated;
grant execute on function public.harvey_telefonos_ocupados() to authenticated;
