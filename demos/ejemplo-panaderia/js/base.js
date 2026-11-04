/* ==========================================================================
   BASE COMÚN DE TODAS LAS DEMOS (Mavie IA Solutions)
   --------------------------------------------------------------------------
   Se copia igual en todas las demos. Se encarga de:
   1. Decidir si hay animaciones (no las hay si GSAP no carga o si la persona
      ha pedido "reducir movimiento" en su móvil u ordenador).
   2. Esconder los bloques sin dato (data-si / data-no), marcar el día de hoy
      en el horario, cerrar el menú del móvil, etc.
   3. Cargar el dibujo de Valentina (img/dibujo.svg) dentro de la página para
      que sus trazos puedan "dibujarse solos" con GSAP (DrawSVGPlugin).
   4. Dejar a mano funciones que usa js/animaciones.js (window.Demo).

   Reglas de seguridad que se cumplen aquí (y que hay que mantener):
   - No se construye HTML a partir de texto ni se ejecuta código generado:
     los textos se ponen siempre con textContent.
   - El dibujo SVG se "limpia" antes de meterlo en la página: solo se copian
     formas y atributos de una lista permitida (nada de scripts ni enlaces).
   ========================================================================== */
(() => {
  'use strict';

  const raiz = document.documentElement;
  const gsap = window.gsap;
  const consulta = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reducido = Boolean(consulta && consulta.matches);
  const animar = Boolean(gsap) && !reducido;

  raiz.classList.add('js');
  if (reducido) raiz.classList.add('movimiento-reducido');

  // Registrar los plugins de GSAP que estén cargados.
  if (gsap) {
    const plugins = [window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin].filter(Boolean);
    if (plugins.length) gsap.registerPlugin(...plugins);
  }

  // Solo escondemos contenido para animarlo si de verdad vamos a animar.
  let temporizador = 0;
  if (animar) {
    raiz.classList.add('js-listo');
    // Red de seguridad: si en 4 segundos las animaciones no han arrancado,
    // se enseña todo tal cual para que nadie vea una página vacía.
    temporizador = window.setTimeout(() => {
      if (!raiz.classList.contains('anim-ok')) raiz.classList.remove('js-listo');
    }, 4000);
  }

  // ------------------------------------------------------------------------
  // Bloques sin dato (refuerzo del CSS de base.css)
  // ------------------------------------------------------------------------
  const vacio = (valor) => !valor || !valor.trim() || valor.trim().startsWith('{');
  document.querySelectorAll('[data-si]').forEach((el) => {
    if (vacio(el.getAttribute('data-si'))) el.hidden = true;
  });
  document.querySelectorAll('[data-no]').forEach((el) => {
    if (!vacio(el.getAttribute('data-no'))) el.hidden = true;
  });

  // ------------------------------------------------------------------------
  // Horario: marcar el día de hoy. Cada fila lleva data-dias="1-5" (lunes a
  // viernes), "6" (sábado), "7" (domingo) o una lista "1,3,5".
  // ------------------------------------------------------------------------
  const hoy = ((new Date().getDay() + 6) % 7) + 1; // 1 = lunes ... 7 = domingo
  const incluyeHoy = (texto) =>
    String(texto)
      .split(',')
      .some((parte) => {
        const [desde, hasta] = parte.split('-').map((n) => Number.parseInt(n, 10));
        if (Number.isNaN(desde)) return false;
        // "6" es un solo día; "1-5" es de lunes a viernes.
        return hasta === undefined || Number.isNaN(hasta) ? hoy === desde : hoy >= desde && hoy <= hasta;
      });
  document.querySelectorAll('[data-dias]').forEach((fila) => {
    if (!incluyeHoy(fila.getAttribute('data-dias'))) return;
    fila.classList.add('es-hoy');
    // La etiqueta "Hoy" solo se añade donde haya un hueco marcado con data-hoy.
    const destino = fila.matches('[data-hoy]') ? fila : fila.querySelector('[data-hoy]');
    if (!destino) return;
    const marca = document.createElement('span');
    marca.className = 'hoy';
    marca.textContent = 'Hoy';
    destino.appendChild(marca);
  });

  // ------------------------------------------------------------------------
  // Cabecera: cambia de aspecto al bajar. Menú del móvil: se cierra al elegir.
  // ------------------------------------------------------------------------
  const cabecera = document.querySelector('[data-cabecera]');
  if (cabecera) {
    let pendiente = false;
    const marcar = () => {
      pendiente = false;
      cabecera.classList.toggle('con-scroll', window.scrollY > 12);
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!pendiente) {
          pendiente = true;
          window.requestAnimationFrame(marcar);
        }
      },
      { passive: true },
    );
    marcar();
  }

  document.querySelectorAll('details[data-menu]').forEach((menu) => {
    menu.addEventListener('click', (evento) => {
      if (evento.target.closest('a')) menu.open = false;
    });
    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && menu.open) {
        menu.open = false;
        const resumen = menu.querySelector('summary');
        if (resumen) resumen.focus();
      }
    });
  });

  // ------------------------------------------------------------------------
  // Aviso de "web de muestra": su altura real (1, 2 o 3 líneas según el
  // nombre del negocio) se guarda en --alto-aviso para que no tape nada.
  // ------------------------------------------------------------------------
  const aviso = document.querySelector('.aviso-demo');
  if (aviso) {
    const medirAviso = () => {
      const fijoAbajo = window.getComputedStyle(aviso).left === '0px';
      if (fijoAbajo) raiz.style.setProperty('--alto-aviso', `${Math.ceil(aviso.getBoundingClientRect().height)}px`);
      else raiz.style.removeProperty('--alto-aviso');
    };
    medirAviso();
    if ('ResizeObserver' in window) new ResizeObserver(medirAviso).observe(aviso);
    else window.addEventListener('resize', medirAviso);
  }

  // ------------------------------------------------------------------------
  // Botón flotante de WhatsApp: aparece cuando ya no se ve la portada.
  // ------------------------------------------------------------------------
  const flotante = document.querySelector('.boton-flotante');
  const portada = document.getElementById('inicio');
  if (flotante && portada && 'IntersectionObserver' in window) {
    const observador = new IntersectionObserver(
      ([entrada]) => {
        const visible = !entrada.isIntersecting;
        flotante.classList.toggle('visible', visible);
        if (visible) flotante.removeAttribute('tabindex');
        else flotante.setAttribute('tabindex', '-1');
      },
      { rootMargin: '0px 0px -40% 0px' },
    );
    observador.observe(portada);
  } else if (flotante) {
    flotante.classList.add('visible');
  }

  // ------------------------------------------------------------------------
  // Títulos que deben caber en una línea por palabra (data-ajustar).
  // Si la marca tiene una palabra muy larga, se reduce la letra para que no
  // se salga de la pantalla del móvil.
  // ------------------------------------------------------------------------
  const ajustables = Array.from(document.querySelectorAll('[data-ajustar]'));
  const ajustarTitulos = () => {
    ajustables.forEach((el) => {
      el.style.removeProperty('font-size');
      const texto = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (!texto) return;
      const ancho = el.clientWidth;
      if (!ancho) return;
      const medidor = document.createElement('span');
      medidor.setAttribute('aria-hidden', 'true');
      medidor.className = 'medidor-ajuste';
      el.appendChild(medidor);
      let maximo = 0;
      texto.split(/\s+/).forEach((palabra) => {
        medidor.textContent = palabra;
        maximo = Math.max(maximo, medidor.getBoundingClientRect().width);
      });
      medidor.remove();
      if (maximo > ancho) {
        const tamano = Number.parseFloat(window.getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.floor(tamano * (ancho / maximo) * 0.97)}px`;
      }
    });
  };
  if (ajustables.length) {
    ajustarTitulos();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarTitulos);
    let espera = 0;
    let anchoAnterior = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === anchoAnterior) return;
      anchoAnterior = window.innerWidth;
      window.clearTimeout(espera);
      espera = window.setTimeout(ajustarTitulos, 150);
    });
  }

  // ------------------------------------------------------------------------
  // Dibujo de Valentina: se lee img/dibujo.svg y se mete en la página ya
  // limpio, para poder animar sus trazos. Si no se puede (por ejemplo, al
  // abrir el archivo con doble clic, sin servidor), se queda la imagen fija.
  // ------------------------------------------------------------------------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ETIQUETAS_PERMITIDAS = new Set([
    'svg', 'g', 'path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect',
    'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'title', 'desc',
  ]);
  const ATRIBUTOS_PERMITIDOS = new Set([
    'id', 'class', 'd', 'points', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
    'fx', 'fy', 'width', 'height', 'viewbox', 'transform', 'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'clip-rule',
    'clip-path', 'vector-effect', 'pathlength', 'preserveaspectratio', 'offset', 'stop-color',
    'stop-opacity', 'gradientunits', 'gradienttransform', 'clippathunits', 'display',
    'visibility', 'paint-order',
  ]);
  // Inkscape guarda muchos colores dentro de style="...". Como la página no
  // permite estilos en línea (seguridad), se convierten en atributos.
  const PROPIEDADES_DE_STYLE = new Set([
    'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap',
    'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-opacity', 'opacity', 'display', 'visibility', 'stop-color', 'stop-opacity',
    'vector-effect', 'paint-order', 'clip-rule',
  ]);
  const valorSeguro = (valor) => !/url\(\s*['"]?\s*(?!#)|javascript:|expression|@import|[<>]/i.test(valor);

  const copiarLimpio = (origen) => {
    const nombre = origen.localName.toLowerCase();
    if (!ETIQUETAS_PERMITIDAS.has(nombre)) return null;
    const destino = document.createElementNS(SVG_NS, origen.localName);
    Array.from(origen.attributes).forEach((atributo) => {
      if (atributo.namespaceURI && atributo.namespaceURI !== SVG_NS) return; // inkscape:, sodipodi:, xlink:
      const clave = atributo.localName.toLowerCase();
      const valor = atributo.value;
      if (clave === 'style') {
        valor.split(';').forEach((declaracion) => {
          const [prop, ...resto] = declaracion.split(':');
          const propiedad = (prop || '').trim().toLowerCase();
          const v = resto.join(':').trim();
          if (PROPIEDADES_DE_STYLE.has(propiedad) && v && valorSeguro(v)) destino.setAttribute(propiedad, v);
        });
        return;
      }
      if (ATRIBUTOS_PERMITIDOS.has(clave) && valorSeguro(valor)) destino.setAttribute(atributo.localName, valor);
    });
    Array.from(origen.childNodes).forEach((hijo) => {
      if (hijo.nodeType === Node.ELEMENT_NODE) {
        const limpio = copiarLimpio(hijo);
        if (limpio) destino.appendChild(limpio);
      } else if (hijo.nodeType === Node.TEXT_NODE && (nombre === 'title' || nombre === 'desc')) {
        destino.appendChild(document.createTextNode(hijo.textContent));
      }
    });
    return destino;
  };

  const usarImagenFija = (figura) => {
    if (figura) figura.classList.add('firma--estatica');
    return null;
  };

  const cargarDibujo = async () => {
    const figura = document.querySelector('[data-dibujo]');
    if (!figura) return null;
    const ruta = figura.getAttribute('data-dibujo') || '';
    // Solo archivos SVG de la propia demo (carpeta img/).
    if (!/^img\/[a-z0-9._-]+\.svg$/i.test(ruta)) return usarImagenFija(figura);
    if (!window.fetch || !window.DOMParser || window.location.protocol === 'file:') return usarImagenFija(figura);
    try {
      const respuesta = await window.fetch(ruta, { credentials: 'same-origin' });
      if (!respuesta.ok) throw new Error(`No se pudo leer ${ruta}`);
      const texto = await respuesta.text();
      if (texto.length > 400000) throw new Error('El dibujo pesa demasiado (más de 400 KB).');
      const documento = new window.DOMParser().parseFromString(texto, 'image/svg+xml');
      const original = documento.documentElement;
      if (!original || original.localName !== 'svg' || documento.getElementsByTagName('parsererror').length) {
        throw new Error('El archivo del dibujo no es un SVG válido.');
      }
      const svg = copiarLimpio(original);
      if (!svg) throw new Error('El dibujo no se ha podido limpiar.');
      // Tamaño adaptable: se queda el viewBox y se quitan ancho y alto fijos.
      if (!svg.getAttribute('viewBox')) {
        const ancho = Number.parseFloat(original.getAttribute('width'));
        const alto = Number.parseFloat(original.getAttribute('height'));
        if (ancho > 0 && alto > 0) svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
      }
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.removeAttribute('id');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.classList.add('firma__svg');
      const imagen = figura.querySelector('img');
      if (imagen) imagen.replaceWith(svg);
      else figura.appendChild(svg);
      figura.classList.add('firma--viva');
      return svg;
    } catch (error) {
      if (window.console) window.console.warn('[demo] Dibujo sin animar:', error.message);
      return usarImagenFija(figura);
    }
  };

  const dibujo = cargarDibujo();

  // ------------------------------------------------------------------------
  // Ayudas para js/animaciones.js
  // ------------------------------------------------------------------------

  /** Marca elementos como "ya animados por el estilo" para no repetirlos. */
  const marcar = (objetivos) => {
    const lista = typeof objetivos === 'string' ? document.querySelectorAll(objetivos) : [].concat(objetivos);
    Array.from(lista).forEach((el) => el && el.setAttribute && el.setAttribute('data-anim-hecho', ''));
    return lista;
  };

  /** Anima los trazos de un SVG como si se dibujaran a mano. */
  const dibujar = (svg, { duracionTotal = 3, retraso = 0 } = {}) => {
    const tl = gsap.timeline({ delay: retraso });
    if (!svg) return tl;
    const formas = Array.from(svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect'));
    const conTrazo = [];
    const sinTrazo = [];
    formas.forEach((forma) => {
      const estilo = window.getComputedStyle(forma);
      const trazo = estilo.stroke && estilo.stroke !== 'none' && Number.parseFloat(estilo.strokeWidth) > 0;
      (trazo && window.DrawSVGPlugin ? conTrazo : sinTrazo).push(forma);
    });
    if (conTrazo.length) {
      const n = conTrazo.length;
      const cada = Math.min(0.18, 1.8 / n);
      const duracion = Math.max(0.5, duracionTotal - cada * (n - 1));
      tl.from(conTrazo, { drawSVG: 0, duration: duracion, stagger: cada, ease: 'power1.inOut' });
    }
    if (sinTrazo.length) {
      // Formas rellenas (por ejemplo, la pluma caligráfica de Inkscape):
      // no se pueden "dibujar", así que aparecen suavemente.
      tl.from(sinTrazo, { opacity: 0, scale: 0.96, transformOrigin: '50% 50%', duration: 0.8, stagger: Math.min(0.06, 1 / sinTrazo.length) }, conTrazo.length ? '-=0.9' : 0);
    }
    return tl;
  };

  const VARIANTES = {
    subir: { y: 32 },
    bajar: { y: -32 },
    izquierda: { x: -48 },
    derecha: { x: 48 },
    escala: { scale: 0.9 },
    aparecer: {},
  };

  /**
   * Anima al entrar en pantalla todo lo que tenga data-anim y que el estilo
   * no haya animado ya. Valores: subir (por defecto), bajar, izquierda,
   * derecha, escala, aparecer.
   */
  const revelarResto = () => {
    if (!animar || !window.ScrollTrigger) {
      raiz.classList.remove('js-listo');
      return;
    }
    const grupos = {};
    document.querySelectorAll('[data-anim]:not([data-anim-hecho])').forEach((el) => {
      const tipo = VARIANTES[el.getAttribute('data-anim')] ? el.getAttribute('data-anim') : 'subir';
      (grupos[tipo] = grupos[tipo] || []).push(el);
      el.setAttribute('data-anim-hecho', '');
    });
    Object.keys(grupos).forEach((tipo) => {
      window.ScrollTrigger.batch(grupos[tipo], {
        start: 'top 92%',
        once: true,
        interval: 0.12,
        onEnter: (lote) =>
          gsap.fromTo(
            lote,
            { opacity: 0, ...VARIANTES[tipo] },
            { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.9, stagger: 0.09, ease: 'power3.out', overwrite: 'auto' },
          ),
      });
    });
  };

  /** Lo llama animaciones.js cuando todo está preparado. */
  const listo = () => {
    window.clearTimeout(temporizador);
    raiz.classList.add('anim-ok');
    if (window.ScrollTrigger) {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => window.ScrollTrigger.refresh());
      window.addEventListener('load', () => window.ScrollTrigger.refresh(), { once: true });
    }
  };

  /** Si algo falla, se enseña todo sin animar. */
  const fallo = (error) => {
    window.clearTimeout(temporizador);
    raiz.classList.remove('js-listo');
    if (window.console && error) window.console.warn('[demo] Animaciones desactivadas:', error);
  };

  window.Demo = Object.freeze({ animar, reducido, dibujo, marcar, dibujar, revelarResto, listo, fallo });
})();
