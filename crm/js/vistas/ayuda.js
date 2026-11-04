// Pantalla "Ayuda": el flujo de trabajo en una página.
import { el, avisar, enlaceFuera } from '../dom.js';
import { bloqueComando } from '../componentes.js';

export async function vistaAyuda(ctx) {
  const paso = (titulo, ...contenido) => el('li', {}, el('strong', {}, titulo), el('div', {}, ...contenido));
  return el('div', {},
    el('div', { class: 'titulo-vista' }, el('div', {}, el('h1', {}, 'Cómo se trabaja'),
      el('p', { class: 'subtitulo' }, 'Tú haces lo que hacía Harvey, con Antigravity como ayudante.'))),
    el('section', { class: 'tarjeta' },
      el('ol', { class: 'ayuda-pasos' },
        paso('1. Buscar negocios sin web (Antigravity)',
          el('p', {}, 'En el chat de Antigravity:'), bloqueComando('/buscar-negocios barberías en La Línea', avisar),
          el('p', { class: 'texto-peq texto-suave' }, 'Aparecen aquí, en Negocios → "Nuevo", ordenados por puntuación.')),
        paso('2. Elegir los buenos (CRM)',
          el('p', {}, 'Abre cada uno, mira Maps y sus redes. Si te gusta: Etapa → "Cualificado". Si ya tiene web: "Descartado".')),
        paso('3. Diseñar la demo (Antigravity + tableta)',
          bloqueComando('/nueva-demo Barbería El Faro', avisar),
          el('p', { class: 'texto-peq texto-suave' }, 'Tú pones el nombre de marca, eliges el estilo y dibujas el logo o la ilustración en la tableta. Antigravity monta la web animada.')),
        paso('4. Revisión de Miguel',
          bloqueComando('/publicar-demo barberia-el-faro', avisar),
          el('p', { class: 'texto-peq texto-suave' }, 'Se crea el Pull Request en GitHub con la vista previa. Miguel la aprueba aquí, en la ficha del negocio.')),
        paso('5. Contactar (CRM, desde el móvil)',
          el('p', {}, 'En la ficha: "📞 Llamar" (con guion) o "💬 WhatsApp" (con plantilla). El CRM comprueba horario, límite diario, que la demo cargue y que no haya pedido la baja.')),
        paso('6. Seguir',
          el('p', {}, 'Si no responde, el CRM te recuerda el seguimiento a los 4 días (solo uno). Si responde, "↩︎ Respuesta". Si dice que no: "Baja", y nunca más.')),
      ),
    ),
    el('section', { class: 'tarjeta' },
      el('h2', {}, 'Reglas que nunca se saltan'),
      el('ul', {},
        el('li', {}, 'Nada se envía sin que Miguel haya aprobado la demo.'),
        el('li', {}, 'Nunca precios por escrito: se hablan en persona.'),
        el('li', {}, 'Quien pide la baja no vuelve a recibir nada (ni de ti ni de Harvey).'),
        el('li', {}, 'Las demos usan datos reales públicos del negocio o textos de ejemplo. Nunca reseñas, premios o cifras inventadas.'),
        el('li', {}, 'Las claves (API keys, contraseñas) solo en .env.local y Bitwarden. Nunca en el chat ni en GitHub.'),
      ),
    ),
    ctx.motor.modoPrueba
      ? el('section', { class: 'tarjeta' },
        el('h2', {}, 'Modo prueba'),
        el('p', {}, 'Los datos de ejemplo se guardan solo en este navegador. Puedes romper lo que quieras.'),
        el('button', { type: 'button', class: 'boton', onclick: () => { ctx.motor.reiniciar(); avisar('Datos de ejemplo restaurados.'); ctx.irA('#/hoy'); } }, 'Restaurar datos de ejemplo'))
      : null,
    el('p', { class: 'texto-suave texto-peq' }, 'Guías completas en el repositorio, carpeta docs/. ',
      enlaceFuera('https://github.com/mavieiasolutions-a11y/valentina-call-dashboard/tree/main/docs', 'Abrir en GitHub')),
  );
}
