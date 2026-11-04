-- Pruebas de seguridad (RLS) y de reglas del CRM.
-- Se ejecutan en un Postgres de pruebas con: npm run test:sql
-- Si algo falla, el script se para y muestra "FALLO: ...".
\set ON_ERROR_STOP 1
\set QUIET 1

-- Usuarios de prueba
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'miguel@prueba.test'),
  ('00000000-0000-0000-0000-00000000000b', 'valentina@prueba.test'),
  ('00000000-0000-0000-0000-00000000000c', 'agente@prueba.test'),
  ('00000000-0000-0000-0000-00000000000d', 'harvey@prueba.test'),
  ('00000000-0000-0000-0000-00000000000e', 'intruso@prueba.test');

select public.alta_equipo('miguel@prueba.test', 'Miguel', 'admin');
select public.alta_equipo('valentina@prueba.test', 'Valentina', 'comercial');
select public.alta_equipo('agente@prueba.test', 'Agente Antigravity', 'agente');
select public.alta_equipo('harvey@prueba.test', 'Harvey', 'harvey');

create or replace function public.prueba(condicion boolean, mensaje text) returns void language plpgsql as $$
begin
  if not coalesce(condicion, false) then raise exception 'FALLO: %', mensaje; end if;
end $$;
grant execute on function public.prueba(boolean, text) to anon, authenticated;

create or replace function public.debe_fallar(sentencia text, mensaje text) returns void language plpgsql as $$
begin
  begin
    execute sentencia;
  exception when others then
    return;
  end;
  raise exception 'FALLO: debería haber fallado: %', mensaje;
end $$;
grant execute on function public.debe_fallar(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Sin sesión (anon) no se puede leer nada
-- ---------------------------------------------------------------------------
set role anon;
select public.debe_fallar('select * from public.negocios', 'anon lee negocios');
select public.debe_fallar('select * from public.equipo', 'anon lee equipo');
select public.debe_fallar('select public.importar_negocios(''[]''::jsonb)', 'anon importa');
reset role;

-- ---------------------------------------------------------------------------
-- 2. Un usuario con sesión pero fuera del equipo no ve ni crea nada
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e"}', false);
select public.prueba((select count(*) from public.equipo) = 0, 'intruso ve el equipo');
select public.debe_fallar($$insert into public.negocios (nombre) values ('X')$$, 'intruso crea negocio');
select public.debe_fallar($$select public.alta_equipo('intruso@prueba.test', 'Yo', 'admin')$$, 'intruso se da de alta');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Valentina importa negocios (duplicados fuera)
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select public.prueba(
  (select public.importar_negocios('[
     {"nombre":"Barbería Uno","telefono":"+34600000001","telefono_tipo":"movil","fuente":"serper","fuente_id":"serper:1"},
     {"nombre":"Taller Dos","telefono":"+34956000002","telefono_tipo":"fijo","fuente":"serper","fuente_id":"serper:2"},
     {"nombre":"Barbería Uno (repetida)","telefono":"+34600000001","fuente":"serper","fuente_id":"serper:99"},
     {"nombre":"Taller Dos otra vez","fuente":"serper","fuente_id":"serper:2"}
   ]'::jsonb)) = '{"insertados":2,"duplicados":2,"bloqueados":0}'::jsonb,
  'importar: 2 nuevos y 2 duplicados');
select public.prueba((select count(*) from public.negocios) = 2, 'Valentina ve los 2 negocios');
select public.prueba((select creado_por from public.negocios where fuente_id = 'serper:1') = '00000000-0000-0000-0000-00000000000b',
  'creado_por es quien importa');
-- No puede borrar
delete from public.negocios;
select public.prueba((select count(*) from public.negocios) = 2, 'Valentina no puede borrar');
reset role;

-- ---------------------------------------------------------------------------
-- 4. El agente prepara, pero no registra contactos ni cambia plantillas
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select public.prueba(
  (select (public.importar_negocios('[{"nombre":"Panadería Tres","telefono":"+34600000003","fuente":"osm","fuente_id":"osm:3"}]'::jsonb)) ->> 'insertados') = '1',
  'agente importa');
select public.debe_fallar(
  $$insert into public.actividades (negocio_id, tipo, resultado) select id, 'llamada', 'interesado' from public.negocios where fuente_id = 'osm:3'$$,
  'agente registra una llamada');
insert into public.actividades (negocio_id, tipo, detalle)
  select id, 'nota', 'Revisado por el agente' from public.negocios where fuente_id = 'osm:3';
select public.debe_fallar($$insert into public.plantillas (clave, canal, nombre, texto) values ('x1', 'whatsapp', 'X', 'Y')$$,
  'agente crea plantilla');
insert into public.busquedas (consulta, municipio, fuente, resultados, creditos) values ('panadería', 'Algeciras', 'osm', 1, 0);
reset role;

-- ---------------------------------------------------------------------------
-- 5. Demos: Valentina diseña, solo Miguel aprueba
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select public.debe_fallar(
  $$insert into public.demos (negocio_id, slug, estado) select id, 'barberia-uno', 'aprobada' from public.negocios where fuente_id = 'serper:1'$$,
  'crear demo ya aprobada');
insert into public.demos (negocio_id, slug, marca, estilo)
  select id, 'barberia-uno', 'Barbería Uno', 'editorial' from public.negocios where fuente_id = 'serper:1';
select public.prueba((select etapa from public.negocios where fuente_id = 'serper:1') = 'en_diseno', 'demo creada → en_diseno');
update public.demos set estado = 'revision' where slug = 'barberia-uno';
select public.debe_fallar($$update public.demos set estado = 'aprobada' where slug = 'barberia-uno'$$, 'Valentina aprueba');
select public.debe_fallar($$update public.demos set estado = 'publicada' where slug = 'barberia-uno'$$, 'publicar sin aprobar');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
update public.demos set estado = 'aprobada' where slug = 'barberia-uno';
select public.prueba((select aprobada_por from public.demos where slug = 'barberia-uno') = '00000000-0000-0000-0000-00000000000a',
  'aprobada_por = Miguel');
select public.prueba((select etapa from public.negocios where fuente_id = 'serper:1') = 'demo_lista', 'aprobada → demo_lista');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
update public.demos set estado = 'publicada', url = 'https://mavie-demos.pages.dev/barberia-uno/', aprobada_por = null
 where slug = 'barberia-uno';
select public.prueba((select aprobada_por from public.demos where slug = 'barberia-uno') = '00000000-0000-0000-0000-00000000000a',
  'el agente publica sin borrar quién aprobó');
select public.debe_fallar($$update public.demos set url = 'javascript:alert(1)' where slug = 'barberia-uno'$$, 'url no https');
reset role;

-- ---------------------------------------------------------------------------
-- 6. Contactos, etapas y BAJA
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
insert into public.actividades (negocio_id, tipo, resultado, modo, creado_por, creado_en)
  select id, 'whatsapp', 'enviado', 'frio', '00000000-0000-0000-0000-00000000000a', '2020-01-01'
    from public.negocios where fuente_id = 'serper:1';
select public.prueba((select etapa from public.negocios where fuente_id = 'serper:1') = 'contactado', 'WhatsApp enviado → contactado');
select public.prueba((select creado_por from public.actividades where tipo = 'whatsapp') = '00000000-0000-0000-0000-00000000000b',
  'no se puede firmar como otro');
select public.prueba((select creado_en from public.actividades where tipo = 'whatsapp') > now() - interval '1 minute',
  'no se puede cambiar la fecha');
update public.actividades set detalle = 'cambiado';
select public.prueba((select count(*) from public.actividades where detalle = 'cambiado') = 0, 'Valentina no reescribe el historial');

insert into public.actividades (negocio_id, tipo, resultado, proxima_accion_en, proxima_accion)
  select id, 'llamada', 'volver_a_llamar', now() + interval '2 days', 'Llamar a las 17:00'
    from public.negocios where fuente_id = 'serper:2';
select public.prueba((select proxima_accion from public.negocios where fuente_id = 'serper:2') = 'Llamar a las 17:00', 'próxima acción guardada');
insert into public.actividades (negocio_id, tipo, resultado)
  select id, 'llamada', 'acepta_whatsapp' from public.negocios where fuente_id = 'serper:2';
select public.prueba((select permiso_whatsapp and proxima_accion_en is null from public.negocios where fuente_id = 'serper:2'),
  'acepta WhatsApp: permiso guardado y tarea cumplida');

insert into public.actividades (negocio_id, tipo, resultado)
  select id, 'whatsapp', 'baja' from public.negocios where fuente_id = 'serper:1';
select public.prueba((select etapa = 'baja' and no_contactar from public.negocios where fuente_id = 'serper:1'), 'pide baja → baja');
select public.prueba(exists (select 1 from public.lista_no_contactar where telefono = '+34600000001' and motivo = 'baja'),
  'el teléfono entra en la lista de no contactar');
select public.debe_fallar(
  $$insert into public.actividades (negocio_id, tipo, resultado) select id, 'whatsapp', 'enviado' from public.negocios where fuente_id = 'serper:1'$$,
  'escribir a una baja');
select public.debe_fallar(
  $$update public.negocios set no_contactar = false, etapa = 'nuevo' where fuente_id = 'serper:1'$$,
  'Valentina deshace una baja');
update public.negocios set etapa = 'interesado' where fuente_id = 'serper:1';
select public.prueba((select etapa from public.negocios where fuente_id = 'serper:1') = 'baja', 'una baja no cambia de etapa');
select public.prueba(
  (select (public.importar_negocios('[{"nombre":"Barbería Uno nueva","telefono":"+34600000001","fuente":"serper","fuente_id":"serper:100"}]'::jsonb)) ->> 'bloqueados') = '1',
  'una baja no se vuelve a importar');
delete from public.lista_no_contactar;
select public.prueba((select count(*) from public.lista_no_contactar) = 1, 'Valentina no borra la lista de no contactar');
reset role;

-- ---------------------------------------------------------------------------
-- 7. Plantillas: Valentina las personaliza
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
insert into public.plantillas (clave, canal, modo, nombre, texto) values ('whatsapp_frio', 'whatsapp', 'frio', 'Mío', 'Hola {negocio}');
select public.prueba((select count(*) from public.plantillas) = 1, 'plantilla guardada');
reset role;

-- ---------------------------------------------------------------------------
-- 8. Puente con Harvey
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d"}', false);
select public.prueba((select count(*) from public.negocios) = 0, 'Harvey no lee la tabla de negocios');
select public.prueba(
  (select (public.harvey_enviar_negocios('[{"harvey_id":"55","nombre":"Estética Sin Web","telefono":"+34600000055","motivo":"sin web"}]'::jsonb)) ->> 'insertados') = '1',
  'Harvey envía un negocio sin web');
select public.prueba(
  (select public.harvey_no_contactar(array['+34600000003', '+34956000002', 'basura'], 'harvey'))
    = '{"marcados":2,"ya_contactados_por_valentina":["+34956000002"]}'::jsonb,
  'Harvey bloquea uno libre y avisa del que ya lleva Valentina');
select public.prueba((select count(*) from public.harvey_telefonos_ocupados() where telefono = '+34956000002') = 1,
  'Harvey ve los teléfonos que ya lleva Valentina');
select public.prueba((select count(*) from public.harvey_telefonos_ocupados() where telefono = '+34600000001' and motivo = 'baja') = 1,
  'Harvey ve las bajas');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select public.prueba((select no_contactar and motivo_no_contactar = 'Lo lleva Harvey' from public.negocios where fuente_id = 'osm:3'),
  'negocio no contactado aún queda bloqueado por Harvey');
select public.prueba((select not no_contactar from public.negocios where fuente_id = 'serper:2'),
  'el que ya llevaba Valentina sigue libre');
select public.prueba((select fuente from public.negocios where fuente_id = 'harvey:55') = 'harvey', 'el negocio de Harvey aparece');
select public.debe_fallar($$select public.harvey_telefonos_ocupados()$$, 'Valentina usa funciones de Harvey');
reset role;

-- ---------------------------------------------------------------------------
-- 9. Miguel (admin) puede deshacer una baja quitando el teléfono de la lista
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
delete from public.lista_no_contactar where telefono = '+34600000001';
update public.negocios set etapa = 'contactado', no_contactar = false, motivo_no_contactar = '' where fuente_id = 'serper:1';
select public.prueba((select etapa = 'contactado' and not no_contactar from public.negocios where fuente_id = 'serper:1'),
  'admin deshace la baja');
reset role;

select 'TODAS LAS PRUEBAS DE SEGURIDAD PASAN' as resultado;
