/* ==========================================================================
   ANIMACIONES DEL ESTILO "VIBRANTE"
   Con mucha energía: las formas de colores aparecen de golpe, flotan y se
   mueven a distinta velocidad al bajar (paralaje); el nombre salta letra a
   letra, el subrayado se dibuja, las tarjetas caen como pegatinas y el
   dibujo de la pegatina se traza solo.

   - Usa GSAP (vendor/gsap) con ScrollTrigger, SplitText y DrawSVGPlugin.
   - Si la persona tiene activado "reducir movimiento" o GSAP no carga,
     no se ejecuta nada y la página se ve completa y quieta.
   - Lo que no se anima aquí y tenga data-anim lo anima base.js
     (Demo.revelarResto) con un fundido hacia arriba.
   ========================================================================== */
(() => {
  'use strict';

  const Demo = window.Demo;
  if (!Demo || !Demo.animar) return;

  try {
    const { gsap, ScrollTrigger, SplitText } = window;
    const $ = (selector, contexto = document) => contexto.querySelector(selector);
    const $$ = (selector, contexto = document) => Array.from(contexto.querySelectorAll(selector));
    const azar = gsap.utils.random;

    /** Letras que saltan desde abajo con un pequeño giro. */
    const saltarLetras = (el, { retraso = 0, alEntrar = true } = {}) => {
      if (!el) return null;
      Demo.marcar(el);
      gsap.set(el, { opacity: 1 });
      if (!SplitText) return gsap.from(el, { opacity: 0, y: 40, duration: 0.8, delay: retraso });
      const letras = SplitText.create(el, { type: 'words,chars', charsClass: 'letra' }).chars;
      return gsap.from(letras, {
        yPercent: 110,
        opacity: 0,
        rotate: () => azar(-28, 28),
        duration: 0.9,
        stagger: 0.04,
        ease: 'back.out(2.2)',
        delay: retraso,
        scrollTrigger: alEntrar ? { trigger: el, start: 'top 88%', once: true } : undefined,
      });
    };

    // --- Formas: aparecen, flotan y tienen paralaje -------------------------
    $$('.formas').forEach((grupo) => {
      const formas = $$('.forma', grupo);
      const enPortada = Boolean(grupo.closest('.portada'));
      gsap.from(formas, {
        scale: 0,
        rotate: -120,
        duration: 1.1,
        stagger: 0.07,
        ease: 'back.out(2)',
        delay: enPortada ? 0.2 : 0,
        scrollTrigger: enPortada ? undefined : { trigger: grupo, start: 'top 85%', once: true },
      });
      formas.forEach((forma) => {
        // Flotar suavemente. Se usan xPercent/yPercent para no chocar con el
        // paralaje (y) ni con la entrada (scale/rotate).
        gsap.to(forma, {
          xPercent: azar(-14, 14),
          yPercent: azar(-18, 18),
          duration: azar(2.6, 4.2),
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      });
    });

    // Paralaje: cada forma con data-velocidad se desplaza a su ritmo al bajar.
    $$('[data-velocidad]').forEach((forma) => {
      const velocidad = Number.parseFloat(forma.getAttribute('data-velocidad')) || 0;
      const seccion = forma.closest('section') || forma.parentElement;
      gsap.to(forma, {
        y: velocidad * 380,
        ease: 'none',
        scrollTrigger: { trigger: seccion, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
      });
    });

    // --- Portada ------------------------------------------------------------
    const pegatina = $('.pegatina-dibujo');
    if (pegatina) {
      Demo.marcar(pegatina);
      gsap.set(pegatina, { opacity: 1 });
      gsap.from(pegatina, { opacity: 0, scale: 0.3, rotation: '-=60', duration: 1.2, ease: 'elastic.out(1, 0.6)', delay: 0.3 });
      gsap.to(pegatina, { y: -10, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.6 });
    }
    Demo.dibujo.then((svg) => {
      if (svg) Demo.dibujar(svg, { duracionTotal: 2.4, retraso: 0.9 });
    });

    const etiqueta = $('.portada .etiqueta');
    if (etiqueta) {
      Demo.marcar(etiqueta);
      gsap.fromTo(etiqueta, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(3)', delay: 0.15 });
    }

    saltarLetras($('.portada__titulo'), { retraso: 0.35, alEntrar: false });

    const subrayado = $('.portada__subrayado path');
    if (subrayado && window.DrawSVGPlugin) {
      gsap.from(subrayado, { drawSVG: 0, duration: 1, ease: 'power2.inOut', delay: 1.1 });
    }

    const eslogan = $('.portada__eslogan');
    const acciones = $('.portada__acciones');
    Demo.marcar([eslogan, acciones]);
    gsap.fromTo(eslogan, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 1 });
    if (acciones) {
      gsap.set(acciones, { opacity: 1 });
      gsap.from(acciones.children, { opacity: 0, y: 30, scale: 0.9, duration: 0.8, stagger: 0.1, ease: 'back.out(2)', delay: 1.15, clearProps: 'transform' });
    }

    // --- Títulos de sección ---------------------------------------------------
    $$('[data-anim="titulo-seccion"]').forEach((titulo) => saltarLetras(titulo));

    // --- Tarjetas que caen como pegatinas -------------------------------------
    const tarjetas = $$('[data-anim="tarjeta"]');
    Demo.marcar(tarjetas);
    ScrollTrigger.batch(tarjetas, {
      start: 'top 90%',
      once: true,
      onEnter: (lote) => {
        gsap.set(lote, { opacity: 1 });
        gsap.from(lote, {
          opacity: 0,
          y: '+=90',
          scale: 0.85,
          rotation: () => `+=${azar(-10, 10)}`,
          duration: 1,
          stagger: 0.12,
          ease: 'back.out(1.7)',
          // Al acabar se quita el transform para que vuelva el giro del CSS
          // y funcione el efecto al pasar el ratón.
          clearProps: 'transform',
        });
      },
    });

    // Días de la semana: saltan uno detrás de otro; el de hoy late.
    const dias = $$('.semana li');
    if (dias.length) {
      gsap.from(dias, {
        scale: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: 'back.out(3)',
        scrollTrigger: { trigger: '.semana', start: 'top 92%', once: true },
        onComplete: () => {
          const hoy = $('.semana .es-hoy');
          if (hoy) gsap.to(hoy, { scale: 1.22, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        },
      });
    }

    // Chincheta del mapa que bota.
    const pin = $('.ubicacion__pin');
    if (pin) gsap.to(pin, { y: -12, duration: 0.7, ease: 'power1.inOut', yoyo: true, repeat: -1 });

    // --- Sobre nosotros --------------------------------------------------------
    const nosotros = $('.nosotros');
    if (nosotros) {
      Demo.marcar(nosotros);
      gsap.fromTo(
        nosotros,
        { opacity: 0, scale: 0.92, rotate: -2 },
        { opacity: 1, scale: 1, rotate: 0, duration: 1.1, ease: 'back.out(1.4)', clearProps: 'transform', scrollTrigger: { trigger: nosotros, start: 'top 85%', once: true } },
      );
    }

    Demo.revelarResto();
    Demo.listo();
  } catch (error) {
    Demo.fallo(error);
  }
})();
