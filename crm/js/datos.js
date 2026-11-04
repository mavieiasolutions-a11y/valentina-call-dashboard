// Acceso a los datos. Hay dos "motores" con las mismas funciones:
//   - Supabase (la base de datos de verdad), aquí.
//   - Modo prueba (datos de ejemplo en el navegador), en datos-prueba.js.
// Las pantallas no saben cuál están usando: llaman a estas funciones y ya.
//
// Toda la seguridad la pone la base de datos (RLS): aunque alguien cambie
// este archivo, no podría leer ni escribir nada que no le toque.

const LIMITE = 500;

function comprobar({ data, error }) {
  if (error) throw new Error(traducirError(error.message));
  return data;
}

function traducirError(mensaje = '') {
  if (/JWT expired|refresh_token/i.test(mensaje)) return 'La sesión ha caducado. Vuelve a entrar.';
  if (/row-level security|permission denied/i.test(mensaje)) return 'No tienes permiso para hacer esto.';
  if (/Failed to fetch|NetworkError/i.test(mensaje)) return 'Sin conexión con la base de datos. ¿Tienes internet?';
  if (/duplicate key.*telefono/i.test(mensaje)) return 'Ya hay otro negocio con ese teléfono.';
  if (/duplicate key.*slug/i.test(mensaje)) return 'Ya existe una demo con ese nombre de carpeta.';
  return mensaje;
}

export function crearMotorSupabase(sb) {
  let usuario = null;

  async function cargarUsuario() {
    const { data } = await sb.auth.getSession();
    const sesion = data.session;
    if (!sesion) {
      usuario = null;
      return null;
    }
    const { data: yo } = await sb.from('equipo').select('user_id, email, nombre, rol').eq('user_id', sesion.user.id).maybeSingle();
    usuario = yo ? { id: yo.user_id, email: yo.email, nombre: yo.nombre, rol: yo.rol } : { id: sesion.user.id, email: sesion.user.email, nombre: sesion.user.email, rol: null };
    return usuario;
  }

  return {
    modoPrueba: false,

    // --- Sesión ---------------------------------------------------------------
    usuario: () => usuario,
    cargarUsuario,
    alCambiarSesion(funcion) {
      sb.auth.onAuthStateChange((evento) => {
        // Se difiere para no llamar a Supabase dentro de su propio aviso.
        setTimeout(() => funcion(evento), 0);
      });
    },
    async entrar(email, clave) {
      const { error } = await sb.auth.signInWithPassword({ email, password: clave });
      if (error) throw new Error(/Invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message);
      return cargarUsuario();
    },
    async salir() {
      await sb.auth.signOut();
      usuario = null;
    },
    async recuperarClave(email) {
      const destino = `${location.origin}${location.pathname}`;
      comprobar(await sb.auth.resetPasswordForEmail(email, { redirectTo: destino }));
    },
    async cambiarClave(nueva) {
      comprobar(await sb.auth.updateUser({ password: nueva }));
    },

    // --- Negocios ------------------------------------------------------------
    async listarNegocios({ etapa = '', texto = '', municipio = '', orden = 'puntuacion' } = {}) {
      let q = sb.from('negocios').select('*').limit(LIMITE);
      if (etapa) q = q.eq('etapa', etapa);
      if (municipio) q = q.eq('municipio', municipio);
      if (texto) {
        const t = texto.replace(/[%_,()]/g, ' ').trim();
        if (t) q = q.or(`nombre.ilike.%${t}%,sector.ilike.%${t}%,telefono.ilike.%${t.replace(/\s/g, '')}%`);
      }
      if (orden === 'recientes') q = q.order('creado_en', { ascending: false });
      else if (orden === 'proxima') q = q.order('proxima_accion_en', { ascending: true, nullsFirst: false });
      else q = q.order('puntuacion', { ascending: false }).order('creado_en', { ascending: false });
      return comprobar(await q);
    },
    async obtenerNegocio(id) {
      return comprobar(await sb.from('negocios').select('*').eq('id', id).maybeSingle());
    },
    async crearNegocio(datos) {
      return comprobar(await sb.from('negocios').insert(datos).select().single());
    },
    async actualizarNegocio(id, cambios) {
      return comprobar(await sb.from('negocios').update(cambios).eq('id', id).select().single());
    },
    async contarPorEtapa() {
      const filas = comprobar(await sb.from('negocios').select('etapa').limit(10000));
      const cuenta = {};
      for (const { etapa } of filas) cuenta[etapa] = (cuenta[etapa] ?? 0) + 1;
      return cuenta;
    },
    async pendientes(hasta) {
      return comprobar(
        await sb.from('negocios').select('*').lte('proxima_accion_en', hasta.toISOString())
          .eq('no_contactar', false).order('proxima_accion_en').limit(100),
      );
    },

    // --- Actividades ---------------------------------------------------------
    async listarActividades(negocioId) {
      return comprobar(
        await sb.from('actividades').select('*').eq('negocio_id', negocioId).order('creado_en', { ascending: false }).limit(200),
      );
    },
    async actividadesDesde(desde) {
      return comprobar(
        await sb.from('actividades').select('id, negocio_id, tipo, resultado, modo, creado_en, creado_por')
          .gte('creado_en', desde.toISOString()).order('creado_en', { ascending: false }).limit(5000),
      );
    },
    async registrarActividad(actividad) {
      return comprobar(await sb.from('actividades').insert(actividad).select().single());
    },

    // --- Demos ---------------------------------------------------------------
    async listarDemos({ estado = '' } = {}) {
      let q = sb.from('demos').select('*, negocio:negocios(id, nombre, municipio, etapa)').order('actualizado_en', { ascending: false }).limit(LIMITE);
      if (estado) q = q.eq('estado', estado);
      return comprobar(await q);
    },
    async demoDeNegocio(negocioId) {
      return comprobar(
        await sb.from('demos').select('*').eq('negocio_id', negocioId).neq('estado', 'archivada').maybeSingle(),
      );
    },
    async actualizarDemo(id, cambios) {
      return comprobar(await sb.from('demos').update(cambios).eq('id', id).select().single());
    },

    // --- Plantillas ----------------------------------------------------------
    async listarPlantillas() {
      return comprobar(await sb.from('plantillas').select('*'));
    },
    async guardarPlantilla({ clave, canal, modo, nombre, texto }) {
      return comprobar(await sb.from('plantillas').upsert({ clave, canal, modo, nombre, texto }).select().single());
    },
    async borrarPlantilla(clave) {
      comprobar(await sb.from('plantillas').delete().eq('clave', clave));
    },

    // --- Búsquedas -----------------------------------------------------------
    async listarBusquedas(limite = 20) {
      return comprobar(await sb.from('busquedas').select('*').order('creado_en', { ascending: false }).limit(limite));
    },
  };
}
