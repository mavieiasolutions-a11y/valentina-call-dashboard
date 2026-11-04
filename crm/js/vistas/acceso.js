// Pantallas de entrada: login, nueva contraseña y "sin permiso".
import { el, avisar } from '../dom.js';

function marca() {
  return el('div', { class: 'marca' }, el('img', { src: 'favicon.svg', alt: '', width: 32, height: 32 }), el('span', {}, 'CRM ', el('strong', {}, 'Valentina')));
}

export function vistaAcceso(ctx, alEntrar) {
  if (ctx.motor.modoPrueba) {
    return el('div', { class: 'acceso tarjeta' },
      marca(),
      el('p', {}, 'Estás en modo prueba: no hace falta contraseña.'),
      el('button', { type: 'button', class: 'boton boton-principal', onclick: async () => { await ctx.motor.entrar(); alEntrar(); } }, 'Entrar con datos de ejemplo'),
    );
  }

  const email = el('input', { id: 'email', type: 'email', autocomplete: 'username', required: true });
  const clave = el('input', { id: 'clave', type: 'password', autocomplete: 'current-password', required: true });
  const enviar = el('button', { type: 'submit', class: 'boton boton-principal' }, 'Entrar');
  const formulario = el('form', { class: 'acceso tarjeta', novalidate: true },
    marca(),
    el('div', { class: 'campo' }, el('label', { for: 'email' }, 'Correo'), email),
    el('div', { class: 'campo' }, el('label', { for: 'clave' }, 'Contraseña'), clave),
    el('div', { class: 'acciones' },
      enviar,
      el('button', {
        type: 'button',
        class: 'boton boton-suave',
        onclick: async () => {
          if (!email.value.trim()) {
            avisar('Escribe tu correo y vuelve a pulsar.', 'error');
            email.focus();
            return;
          }
          try {
            await ctx.motor.recuperarClave(email.value.trim());
            avisar('Te hemos enviado un correo para crear una contraseña nueva.');
          } catch (e) {
            avisar(e.message, 'error');
          }
        },
      }, 'He olvidado la contraseña'),
    ),
  );
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    enviar.disabled = true;
    try {
      await ctx.motor.entrar(email.value.trim(), clave.value);
      clave.value = '';
      alEntrar();
    } catch (err) {
      avisar(err.message, 'error');
    } finally {
      enviar.disabled = false;
    }
  });
  setTimeout(() => email.focus(), 0);
  return formulario;
}

export function vistaNuevaClave(ctx, alTerminar) {
  const clave = el('input', { id: 'nueva', type: 'password', autocomplete: 'new-password', minlength: 12, required: true });
  const formulario = el('form', { class: 'acceso tarjeta' },
    marca(),
    el('h1', {}, 'Nueva contraseña'),
    el('div', { class: 'campo' },
      el('label', { for: 'nueva' }, 'Contraseña nueva'),
      clave,
      el('p', { class: 'campo-ayuda' }, 'Mínimo 12 caracteres. Mejor si la genera Bitwarden.'),
    ),
    el('button', { type: 'submit', class: 'boton boton-principal' }, 'Guardar'),
  );
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (clave.value.length < 12) {
      avisar('La contraseña tiene que tener al menos 12 caracteres.', 'error');
      return;
    }
    try {
      await ctx.motor.cambiarClave(clave.value);
      avisar('Contraseña cambiada.');
      await ctx.motor.cargarUsuario();
      history.replaceState(null, '', '#/hoy');
      alTerminar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  });
  return formulario;
}

export function vistaSinPermiso(ctx, usuario) {
  const esScript = usuario.rol === 'agente' || usuario.rol === 'harvey';
  return el('div', { class: 'acceso tarjeta' },
    marca(),
    el('h1', {}, esScript ? 'Esta cuenta es para scripts' : 'Aún no tienes acceso'),
    esScript
      ? el('p', {}, 'La cuenta del agente (o de Harvey) solo se usa desde Antigravity o desde Harvey, no en la web. Entra con tu propia cuenta.')
      : el('p', {}, `Tu usuario (${usuario.email}) existe, pero no está dado de alta en el equipo. Miguel tiene que hacerlo en Supabase (docs/01-puesta-en-marcha.md, paso 3).`),
    el('button', { type: 'button', class: 'boton', onclick: async () => { await ctx.motor.salir(); location.reload(); } }, 'Salir'),
  );
}
