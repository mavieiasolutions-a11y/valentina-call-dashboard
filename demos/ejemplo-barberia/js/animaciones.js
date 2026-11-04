/* ==========================================================================
   ANIMACIONES DEL ESTILO "EDITORIAL"
   Con carácter: el nombre sube letra a letra desde una máscara, las cintas
   se mueven (más rápido y al revés según se baja), el sello gira y el
   dibujo se traza solo. La frase de "Sobre nosotros" se ilumina al leerla.

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

    /** Títulos que suben desde una máscara: cada palabra recorta sus letras. */
    const subirPorLineas = (el, { letras = false, alEntrar = true, retraso = 0 } = {}) => {
      if (!el) return;
      Demo.marcar(el);
      gsap.set(el, { opacity: 1 });
      if (!SplitText) {
        gsap.from(el, { opacity: 0, y: 40, duration: 1, delay: retraso });
        return;
      }
      // Se parte por palabras (no por líneas) para que el reparto no dependa
      // del tamaño de letra que ajusta base.js en móviles.
      const partido = SplitText.create(el, {
        type: letras ? 'words,chars' : 'words',
        mask: 'words',
        wordsClass: 'palabra',
        charsClass: 'letra',
      });
      gsap.from(letras ? partido.chars : partido.words, {
        yPercent: 120,
        duration: letras ? 1.15 : 1,
        stagger: letras ? 0.035 : 0.08,
        ease: 'expo.out',
        delay: retraso,
        scrollTrigger: alEntrar ? { trigger: el, start: 'top 88%', once: true } : undefined,
      });
    };

    // --- Portada -----------------------------------------------------------
    const meta = $('.portada__meta');
    if (meta) {
      Demo.marcar(meta);
      gsap.fromTo(meta, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'power3.inOut', clearProps: 'clipPath' });
    }
    subirPorLineas($('.portada__titulo'), { letras: true, alEntrar: false, retraso: 0.2 });

    const eslogan = $('.portada__eslogan');
    if (eslogan && SplitText) {
      Demo.marcar(eslogan);
      gsap.set(eslogan, { opacity: 1 });
      const palabras = SplitText.create(eslogan, { type: 'words', wordsClass: 'palabra' }).words;
      gsap.from(palabras, { opacity: 0, y: 20, rotate: 3, duration: 0.8, stagger: 0.05, ease: 'power3.out', delay: 0.9 });
    }

    const acciones = $('.portada__acciones');
    if (acciones) {
      Demo.marcar(acciones);
      gsap.fromTo(acciones.children, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', delay: 1.1 });
      gsap.set(acciones, { opacity: 1 });
    }

    // Sello: entra girando, el anillo de texto gira siempre y el dibujo se traza.
    const sello = $('.sello');
    if (sello) {
      Demo.marcar(sello);
      gsap.fromTo(sello, { opacity: 0, scale: 0.4, rotate: -90 }, { opacity: 1, scale: 1, rotate: 0, duration: 1.4, ease: 'back.out(1.6)', delay: 0.7 });
      const anillo = $('.sello__anillo', sello);
      if (anillo) gsap.to(anillo, { rotate: 360, duration: 22, ease: 'none', repeat: -1, transformOrigin: '50% 50%' });
      gsap.to(sello, {
        rotate: 25,
        ease: 'none',
        scrollTrigger: { trigger: '.portada', start: 'top top', end: 'bottom top', scrub: true },
      });
    }
    Demo.dibujo.then((svg) => {
      if (svg) Demo.dibujar(svg, { duracionTotal: 2.4, retraso: 1.3 });
    });

    // --- Cintas: bucle infinito que acelera y cambia de sentido al bajar ----
    const bucles = [];
    $$('.cinta').forEach((cinta, indice) => {
      const pista = $('.cinta__pista', cinta);
      if (!pista || !pista.children.length) return;
      const grupo = Array.from(pista.children);
      // Se clonan los elementos (cloneNode, sin generar HTML) hasta cubrir de sobra la pantalla.
      let primeraCopia = null;
      let vueltas = 0;
      while (pista.scrollWidth < cinta.offsetWidth * 2.5 && vueltas < 12) {
        grupo.forEach((nodo, i) => {
          const copia = nodo.cloneNode(true);
          if (i === 0 && !primeraCopia) primeraCopia = copia;
          pista.appendChild(copia);
        });
        vueltas += 1;
      }
      if (!primeraCopia) return;
      const ancho = primeraCopia.offsetLeft - grupo[0].offsetLeft;
      if (ancho <= 0) return;
      const haciaLaDerecha = indice % 2 === 0;
      const bucle = gsap.fromTo(
        pista,
        { x: haciaLaDerecha ? -ancho : 0 },
        { x: haciaLaDerecha ? 0 : -ancho, duration: ancho / 70, ease: 'none', repeat: -1 },
      );
      // Se adelanta mucho el reloj para que también pueda ir hacia atrás.
      bucle.totalTime(bucle.duration() * 500);
      bucles.push(bucle);
    });
    if (bucles.length) {
      let sentido = 1;
      ScrollTrigger.create({
        trigger: '.cintas',
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          sentido = self.direction;
          const rapidez = gsap.utils.clamp(1, 6, 1 + Math.abs(self.getVelocity()) / 250);
          bucles.forEach((b) => {
            gsap.to(b, { timeScale: rapidez * sentido, duration: 0.2, overwrite: true });
            gsap.to(b, { timeScale: sentido, duration: 1, delay: 0.25, overwrite: false });
          });
        },
      });
      gsap.from('.cinta--frente', { xPercent: -15, ease: 'none', scrollTrigger: { trigger: '.cintas', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('.cinta--fondo', { xPercent: 15, ease: 'none', scrollTrigger: { trigger: '.cintas', start: 'top bottom', end: 'bottom top', scrub: true } });
    }

    // --- Títulos de sección -------------------------------------------------
    $$('[data-anim="lineas"]').forEach((titulo) => subirPorLineas(titulo, { letras: titulo.classList.contains('final__titulo') }));

    // --- Servicios y horario: filas que se deslizan -------------------------
    const filas = $$('[data-anim="fila"]');
    Demo.marcar(filas);
    ScrollTrigger.batch(filas, {
      start: 'top 90%',
      once: true,
      onEnter: (lote) =>
        gsap.fromTo(lote, { opacity: 0, y: 40, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', duration: 1, stagger: 0.12, ease: 'power4.out', clearProps: 'clipPath,transform' }),
    });

    // --- Sobre nosotros: la frase se "enciende" palabra a palabra -----------
    const manifiesto = $('.manifiesto');
    if (manifiesto && SplitText) {
      Demo.marcar(manifiesto);
      gsap.set(manifiesto, { opacity: 1 });
      const palabras = SplitText.create(manifiesto, { type: 'words', wordsClass: 'palabra' }).words;
      gsap.fromTo(
        palabras,
        { opacity: 0.16 },
        {
          opacity: 1,
          stagger: 0.1,
          ease: 'none',
          scrollTrigger: { trigger: manifiesto, start: 'top 82%', end: 'bottom 60%', scrub: 0.6 },
        },
      );
    }

    // --- Pie: la marca gigante sube al final ---------------------------------
    const marcaPie = $('.pie__marca');
    if (marcaPie) {
      gsap.from(marcaPie, {
        yPercent: 35,
        opacity: 0,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.pie', start: 'top 92%', once: true },
      });
    }

    Demo.revelarResto();
    Demo.listo();
  } catch (error) {
    Demo.fallo(error);
  }
})();
