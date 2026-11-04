// Arranque del CRM: elige el motor de datos, gestiona la sesión y muestra
// la pantalla que toca según la dirección (#/hoy, #/negocios, #/negocio/<id>...).
import { CONFIG } from '../config.js';
import { AJUSTES } from './ajustes.js';
import { crearMotorSupabase } from './datos.js';
import { crearMotorPrueba } from './datos-prueba.js';
import { cargarFestivos } from './festivos.js';
import { unirPlantillas } from './plantillas-base.js';
import { el, montar, avisar } from './dom.js';
import { vistaAcceso, vistaNuevaClave, vistaSinPermiso } from './vistas/acceso.js';
import { vistaHoy } from './vistas/hoy.js';
import { vistaNegocios } from './vistas/negocios.js';
import { vistaFicha } from './vistas/ficha.js';
import { vistaDemos } from './vistas/demos.js';
import { vistaPlantillas } from './vistas/plantillas.js';
import { vistaEstadisticas } from './vistas/estadisticas.js';
import { vistaAyuda } from './vistas/ayuda.js';

const RUTAS = {
  hoy: { vista: vistaHoy, titulo: 'Hoy' },
  negocios: { vista: vistaNegocios, titulo: 'Negocios' },
  negocio: { vista: vistaFicha, titulo: 'Negocio', menu: 'negocios' },
  demos: { vista: vistaDemos, titulo: 'Demos' },
  plantillas: { vista: vistaPlantillas, titulo: 'Plantillas' },
  estadisticas: { vista: vistaEstadisticas, titulo: 'Cifras' },
  ayuda: { vista: vistaAyuda, titulo: 'Ayuda' },
};

const principal = document.getElementById('principal');
const cabecera = document.getElementById('cabecera');

function crearMotor() {
  if (CONFIG.url && CONFIG.clavePublica) {
    if (/sb_secret_|service_role/.test(CONFIG.clavePublica)) {
      throw new Error('crm/config.js tiene una clave SECRETA. Pon la "publishable key" y cambia la secreta en Supabase YA.');
    }
    if (!window.supabase?.createClient) {
      throw new Error('Falta la librería de Supabase (crm/vendor/supabase.js). Ejecuta: npm run build:crm');
    }
    const sb = window.supabase.createClient(CONFIG.url, CONFIG.clavePublica, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return crearMotorSupabase(sb);
  }
  return crearMotorPrueba();
}

const ctx = {
  motor: null,
  ajustes: AJUSTES,
  festivos: [],
  plantillas: unirPlantillas([]),
  usuario: () => ctx.motor.usuario(),
  esAdmin: () => ctx.motor.usuario()?.rol === 'admin',
  irA: (ruta) => {
    if (location.hash === ruta) navegar();
    else location.hash = ruta;
  },
  recargar: () => navegar(),
  async recargarPlantillas() {
    try {
      ctx.plantillas = unirPlantillas(await ctx.motor.listarPlantillas());
    } catch {
      ctx.plantillas = unirPlantillas([]);
    }
  },
};

function leerRuta() {
  const [ruta, consulta = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [nombre = 'hoy', parametro = ''] = ruta.split('/');
  return { nombre: RUTAS[nombre] ? nombre : 'hoy', parametro: decodeURIComponent(parametro), consulta: new URLSearchParams(consulta) };
}

let navegando = 0;

async function navegar() {
  const usuario = ctx.motor.usuario();
  if (!usuario) return mostrarAcceso();
  if (!['admin', 'comercial'].includes(usuario.rol)) {
    cabecera.hidden = true;
    montar(principal, vistaSinPermiso(ctx, usuario));
    return;
  }
  cabecera.hidden = false;
  document.getElementById('nombre-usuario').textContent = usuario.nombre;

  const { nombre, parametro, consulta } = leerRuta();
  const ruta = RUTAS[nombre];
  for (const a of document.querySelectorAll('.navegacion a')) {
    if (a.dataset.ruta === (ruta.menu ?? nombre)) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const turno = ++navegando;
  try {
    const nodo = await ruta.vista(ctx, parametro, consulta);
    if (turno !== navegando) return; // el usuario ya se ha ido a otra pantalla
    montar(principal, nodo);
    document.title = `${ruta.titulo} · CRM Valentina`;
    principal.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    if (turno !== navegando) return;
    montar(principal, el('div', { class: 'tarjeta' },
      el('h1', {}, 'Algo ha fallado'),
      el('p', {}, e.message ?? String(e)),
      el('button', { type: 'button', class: 'boton', onclick: () => navegar() }, 'Reintentar'),
    ));
  }
}

function mostrarAcceso() {
  cabecera.hidden = true;
  montar(principal, vistaAcceso(ctx, async () => {
    await ctx.recargarPlantillas();
    navegar();
  }));
}

async function arrancar() {
  try {
    ctx.motor = crearMotor();
  } catch (e) {
    montar(principal, el('div', { class: 'tarjeta' }, el('h1', {}, 'Configuración incorrecta'), el('p', {}, e.message)));
    return;
  }
  document.getElementById('banda-prueba').hidden = !ctx.motor.modoPrueba;
  document.getElementById('boton-salir').addEventListener('click', async () => {
    await ctx.motor.salir();
    if (ctx.motor.modoPrueba) avisar('Has salido del modo prueba.');
    mostrarAcceso();
  });

  ctx.motor.alCambiarSesion((evento) => {
    if (evento === 'PASSWORD_RECOVERY') {
      cabecera.hidden = true;
      montar(principal, vistaNuevaClave(ctx, () => navegar()));
    } else if (evento === 'SIGNED_OUT') {
      mostrarAcceso();
    }
  });

  cargarFestivos().then((fechas) => {
    ctx.festivos = fechas;
  });

  if (ctx.motor.modoPrueba) await ctx.motor.entrar();
  else await ctx.motor.cargarUsuario();
  if (ctx.motor.usuario()) await ctx.recargarPlantillas();
  window.addEventListener('hashchange', () => {
    if (!/access_token|type=recovery/.test(location.hash)) navegar();
  });
  if (/type=recovery/.test(location.hash)) return; // lo gestiona el aviso PASSWORD_RECOVERY
  navegar();
}

arrancar();
