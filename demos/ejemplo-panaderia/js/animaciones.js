/* ==========================================================================
   ANIMACIONES DEL ESTILO "CLÁSICO"
   Suaves y elegantes: el nombre aparece letra a letra, el arco se abre, el
   dibujo se traza solo y los adornos se dibujan al bajar por la página.

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
    const puedeDibujar = Boolean(window.DrawSVGPlugin);

    // --- Portada -----------------------------------------------------------
    const titulo = $('.portada__titulo');
    const arco = $('.portada__arco');
    const estrella = $('.portada__estrella');
    const entrada = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (titulo) {
      Demo.marcar(titulo);
      gsap.set(titulo, { opacity: 1 });
      if (SplitText) {
        const partido = SplitText.create(titulo, { type: 'chars,words', charsClass: 'letra' });
        entrada.from(
          partido.chars,
          { opacity: 0, yPercent: 55, rotate: 6, filter: 'blur(6px)', duration: 1.1, stagger: 0.035, clearProps: 'filter' },
          0.15,
        );
      } else {
        entrada.from(titulo, { opacity: 0, y: 30, duration: 1 }, 0.15);
      }
    }

    const etiqueta = $('.portada .etiqueta');
    const eslogan = $('.portada__eslogan');
    const acciones = $('.portada__acciones');
    Demo.marcar([etiqueta, eslogan, acciones]);
    entrada
      .fromTo(etiqueta, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.8 }, 0)
      .fromTo(eslogan, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9 }, 0.55)
      .fromTo(acciones, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9 }, 0.7);

    if (arco) {
      Demo.marcar(arco);
      entrada.fromTo(
        arco,
        { opacity: 0, y: 50, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 1.4, ease: 'expo.out' },
        0.25,
      );
      if (estrella) {
        entrada.from(estrella, { scale: 0, rotate: -120, duration: 1.2, ease: 'back.out(2)' }, 1);
        gsap.to(estrella, { rotate: 360, duration: 28, ease: 'none', repeat: -1 });
      }
      // Paralaje suave del arco al bajar.
      gsap.to(arco, {
        yPercent: -8,
        ease: 'none',
        scrollTrigger: { trigger: '.portada', start: 'top top', end: 'bottom top', scrub: true },
      });
    }

    // El dibujo de Valentina se traza cuando el arco ya está a la vista.
    Demo.dibujo.then((svg) => {
      const espera = Math.max(0, 0.6 - entrada.time());
      if (svg) {
        Demo.dibujar(svg, { duracionTotal: 3.2, retraso: espera });
      } else {
        const figura = $('.firma');
        if (figura) gsap.fromTo(figura, { opacity: 0 }, { opacity: 1, duration: 1, delay: espera });
      }
    });

    // --- Adornos que se dibujan al aparecer ---------------------------------
    if (puedeDibujar) {
      $$('.adorno, .nosotros__subrayado, .ubicacion__mapa').forEach((svg) => {
        gsap.from(svg.querySelectorAll('path, circle'), {
          drawSVG: 0,
          duration: 1.6,
          stagger: 0.15,
          ease: 'power2.inOut',
          scrollTrigger: { trigger: svg, start: 'top 88%', once: true },
        });
      });
    }

    // --- Servicios: tarjetas en cascada y su icono se dibuja ----------------
    const servicios = $$('.servicio');
    Demo.marcar(servicios);
    ScrollTrigger.batch(servicios, {
      start: 'top 88%',
      once: true,
      onEnter: (lote) => {
        gsap.fromTo(
          lote,
          { opacity: 0, y: 60 },
          { opacity: 1, y: 0, duration: 1.1, stagger: 0.14, ease: 'power3.out', clearProps: 'transform' },
        );
        if (puedeDibujar) {
          lote.forEach((tarjeta, i) => {
            gsap.from(tarjeta.querySelectorAll('.servicio__icono > *'), {
              drawSVG: 0,
              duration: 1.4,
              delay: 0.25 + i * 0.14,
              ease: 'power2.inOut',
            });
          });
        }
      },
    });

    // --- Sobre nosotros: la frase aparece palabra a palabra -----------------
    const frase = $('.nosotros__frase');
    if (frase && SplitText) {
      Demo.marcar(frase);
      gsap.set(frase, { opacity: 1 });
      const palabras = SplitText.create(frase, { type: 'words', wordsClass: 'palabra' }).words;
      gsap.from(palabras, {
        opacity: 0,
        y: 18,
        duration: 0.9,
        stagger: 0.05,
        ease: 'power2.out',
        scrollTrigger: { trigger: frase, start: 'top 85%', once: true },
      });
    }

    // --- Llamada final: el título entra letra a letra -----------------------
    const final = $('.final__titulo');
    if (final && SplitText) {
      Demo.marcar(final);
      gsap.set(final, { opacity: 1 });
      const letras = SplitText.create(final, { type: 'chars', charsClass: 'letra' }).chars;
      gsap.from(letras, {
        opacity: 0,
        yPercent: 40,
        filter: 'blur(5px)',
        clearProps: 'filter',
        duration: 1,
        stagger: 0.05,
        ease: 'power3.out',
        scrollTrigger: { trigger: final, start: 'top 85%', once: true },
      });
    }

    // Todo lo demás (data-anim) lo anima base.js con un fundido.
    Demo.revelarResto();
    Demo.listo();
  } catch (error) {
    Demo.fallo(error);
  }
})();
