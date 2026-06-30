/* ============================================================
   ФРИДОМ — motion layer
   Lenis smooth scroll + GSAP ScrollTrigger
   ============================================================ */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(max-width:900px)').matches;
  gsap.registerPlugin(ScrollTrigger);

  /* CRITICAL: by default ScrollTrigger auto-refreshes on the window `load`
     event. The hero's large background images finish downloading ~0.5s after
     the page is shown, `load` fires, ScrollTrigger recalculates the hero
     pin-spacer (~1500px) and the whole page jerks up/down. We do ONE controlled
     refresh ourselves once the layout is final, so we strip `load` (and
     `DOMContentLoaded`) out of the auto-refresh events and keep only `resize`. */
  ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,resize' });

  /* Don't let the browser restore a previous scroll position — it makes the
     pinned/scrubbed hero jump to its end state right after the preloader. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- LENIS SMOOTH SCROLL ---------- */
  let lenis;
  if (!reduce) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // locked until the preloader finishes
  }
  const scrollTo = (target) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: 'smooth' });
  };

  window.addEventListener('beforeunload', () => {
    const y = window.scrollY;
    if (y > 0) sessionStorage.setItem('__scrollRestore', y);
    else sessionStorage.removeItem('__scrollRestore');
  });

  /* ---------- PRELOADER ---------- */
  const preloader = document.getElementById('preloader');
  const countEl = document.getElementById('preloaderCount');
  const fillEl = document.getElementById('preloaderFill');

  // Snap hard to the very top — used around every refresh so a restored/leftover
  // scroll can never make the pinned, scrubbed hero jump to its end state.
  function forceTop() {
    if (lenis) { lenis.scrollTo(0, { immediate: true, force: true }); lenis.emit?.(); }
    window.scrollTo(0, 0);
  }

  function startSite() {
    document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow');
    if (lenis) lenis.start();

    // Build everything while pinned hard at the top so the pin-spacer measures
    // correctly, then do the ONE and ONLY refresh. Fonts were awaited before we
    // get here and ScrollTrigger's auto-refresh is disabled, so this layout is
    // final — nothing recalculates (and jumps) afterwards.
    forceTop();
    initHero();
    buildScrollAnimations();
    forceTop();
    ScrollTrigger.refresh();

    // Restore the scroll position the visitor had before reloading. This runs
    // exactly once, AFTER the single refresh, so there is no later refresh to
    // shift the layout out from under us.
    const savedY = parseInt(sessionStorage.getItem('__scrollRestore') || '0', 10);
    sessionStorage.removeItem('__scrollRestore');
    if (savedY > 0) {
      // The refresh just added the hero pin-spacer, growing the document.
      // Make Lenis re-measure that new height BEFORE we ask it to scroll,
      // otherwise it clamps to the old (shorter) max and lands too high.
      if (lenis) lenis.resize();
      const maxY = ScrollTrigger.maxScroll(window);
      const y = Math.min(savedY, maxY);
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      ScrollTrigger.update();
    } else {
      forceTop();
    }
  }

  // Resolves once the heavy display fonts are ready, so the page is never
  // revealed while text is still in a fallback font. The font swap (Unbounded
  // is much wider than the fallback) reflows every section below by ~150px and
  // is what made the dark stats block jump down/up while loading.
  function fontsReady() {
    if (!document.fonts) return Promise.resolve();
    const want = [document.fonts.load('800 1em "Unbounded"'), document.fonts.load('500 1em "Manrope"')];
    return Promise.race([
      Promise.all([document.fonts.ready, ...want]),
      new Promise(r => setTimeout(r, 6000)) // safety cap so we never hang on a slow CDN
    ]);
  }

  function runPreloader() {
    document.documentElement.style.overflow = 'hidden';
    // Position the large frame at its initial small appearance immediately so it
    // doesn't flash at full size while the preloader is still sliding away.
    const _frameEl = document.getElementById('heroFrame');
    const _gapEl = document.getElementById('heroGap');
    gsap.set('#heroFrame', {
      xPercent: -50, yPercent: -50,
      scale: _gapEl.offsetWidth / _frameEl.offsetWidth,
      borderRadius: 16
    });
    const obj = { v: 0 };
    const fillDone = new Promise(resolve => {
      gsap.to(obj, {
        v: 100, duration: 1.8, ease: 'power2.inOut',
        onUpdate() {
          const val = Math.round(obj.v);
          if (countEl) countEl.textContent = val;
          if (fillEl) fillEl.style.width = val + '%';
        },
        onComplete: resolve
      });
    });
    // Reveal only when BOTH the bar finished AND the fonts are ready.
    Promise.all([fillDone, fontsReady()]).then(() => {
      const restoring = parseInt(sessionStorage.getItem('__scrollRestore') || '0', 10) > 0;

      // Build the site and place the scroll WHILE the curtain still covers the
      // screen. When it lifts, the visitor immediately sees the final state
      // (top on a fresh visit, or their saved position on reload) — there is no
      // intermediate frame left to jump away from.
      startSite();

      const tl = gsap.timeline({ onComplete: () => { if (preloader) preloader.style.display = 'none'; } });
      tl.to('.preloader__logo', { y: -20, opacity: 0, duration: .5, ease: 'power2.in' }, 0)
        .to('.preloader__count', { y: 20, opacity: 0, duration: .5, ease: 'power2.in' }, 0)
        .to(preloader, { yPercent: -100, duration: .9, ease: 'expo.inOut' }, .2);
      // Hero entrance only on a fresh visit — on reload we lift straight onto
      // the restored position with nothing to animate in.
      if (!restoring) {
        tl.from('.hero__wordmark', { yPercent: 12, opacity: 0, duration: 1, ease: 'expo.out' }, .55)
          .from('#heroFrame', { opacity: 0, duration: .8, ease: 'power2.out' }, .6)
          .from('.hero__tagline > *', { y: 30, opacity: 0, duration: .9, stagger: .08, ease: 'expo.out' }, .75);
      }
    });
  }
  if (reduce) { if (preloader) preloader.style.display = 'none'; startSite(); }
  else runPreloader();

  /* ---------- HEADER / MENU ---------- */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  const toggleMenu = (open) => {
    burger.classList.toggle('is-open', open);
    menu.classList.toggle('is-open', open);
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger?.addEventListener('click', () => toggleMenu(!menu.classList.contains('is-open')));

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length > 1 && document.querySelector(id)) {
        e.preventDefault();
        toggleMenu(false);
        scrollTo(id);
      }
    });
  });
  document.getElementById('bigmark')?.addEventListener('click', () => scrollTo('#top'));

  /* scroll progress */
  const prog = document.getElementById('scrollProgress');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => { if (prog) prog.style.width = (self.progress * 100) + '%'; }
  });

  /* ---------- HERO: split wordmark + image cycle (pinned) ---------- */
  function initHero() {
    const frameEl = document.getElementById('heroFrame');
    const gapEl = document.getElementById('heroGap');
    // Frame CSS size is large (min(92vw,92vh)) so the GPU texture is always
    // rendered at full resolution. We start it at a small visual scale that
    // matches the original card size and animate to scale:1 (full size).
    // This means the GPU DOWNSCALES a large texture instead of UPSCALING a
    // small one, keeping the images perfectly sharp throughout the scroll.
    const startScale = gapEl.offsetWidth / frameEl.offsetWidth;
    gsap.set('#heroFrame', { xPercent: -50, yPercent: -50, scale: startScale, borderRadius: 16 });

    if (reduce) return;

    const slides = gsap.utils.toArray('.hero__slide');
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: '+=160%',
        scrub: 1,
        pin: '.hero__pin',
        pinSpacing: true,
        onUpdate(self) {
          const idx = Math.min(slides.length - 1, Math.floor(self.progress * slides.length));
          slides.forEach((s, i) => s.style.opacity = i === idx ? '1' : '0');
        }
      }
    });
    const dist = isTouch ? 60 : 42;
    tl.to('#wordLeft', { xPercent: -dist, ease: 'none' }, 0)
      .to('#wordRight', { xPercent: dist, ease: 'none' }, 0)
      .to('#heroFrame', { scale: 1, borderRadius: 2, ease: 'none' }, 0)
      .to('#heroTagline', { opacity: 0, y: 30, ease: 'none', duration: .3 }, 0)
      .to('.hero__scrollhint', { opacity: 0, duration: .15 }, 0);
  }

  /* ============================================================
     SCROLL ANIMATIONS
     ============================================================ */
  function splitWords(el, cls) {
    const text = el.textContent.trim();
    el.innerHTML = '';
    text.split(/(\s+)/).forEach(tok => {
      if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(' ')); return; }
      const w = document.createElement('span');
      w.className = cls;
      w.textContent = tok;
      el.appendChild(w);
    });
    return [...el.querySelectorAll('.' + cls)];
  }

  function buildScrollAnimations() {
    /* marquee */
    const track = document.querySelector('.marquee__track');
    if (track && !reduce) {
      let dir = -1;
      gsap.to(track, { xPercent: -50, repeat: -1, duration: 22, ease: 'none' });
      ScrollTrigger.create({
        trigger: '.marquee', start: 'top bottom', end: 'bottom top',
        onUpdate: self => { /* nudge with velocity */ }
      });
    }

    /* ABOUT parallax + big text */
    if (!reduce) {
      gsap.to('.about__img', {
        yPercent: 18, ease: 'none',
        scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true }
      });
      gsap.from('.about__big span', {
        yPercent: 110, ease: 'expo.out', duration: 1.2,
        scrollTrigger: { trigger: '.about__big', start: 'top 85%' }
      });
      gsap.from('.about__statement', {
        opacity: 0, y: 30, duration: 1,
        scrollTrigger: { trigger: '.about__statement', start: 'top 85%' }
      });
    }

    /* MANIFESTO + TRUST quote — word fill on scroll */
    document.querySelectorAll('[data-fill], [data-words]').forEach(el => {
      const words = splitWords(el, 'w');
      if (reduce) { words.forEach(w => w.classList.add('on')); return; }
      if (el.hasAttribute('data-fill') || el.classList.contains('trust__quote')) {
        // progressive fill
        ScrollTrigger.create({
          trigger: el, start: 'top 80%', end: 'top 30%', scrub: true,
          onUpdate: self => {
            const n = Math.floor(self.progress * words.length);
            words.forEach((w, i) => w.classList.toggle('on', i <= n));
          }
        });
      } else {
        // headline word rise
        words.forEach(w => { const s = document.createElement('span'); s.style.display = 'inline-block'; });
        gsap.from(words, {
          yPercent: 120, opacity: 0, duration: .9, stagger: .04, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 88%' }
        });
      }
    });

    /* generic reveals */
    if (!reduce) {
      gsap.utils.toArray('[data-reveal]').forEach((el, i) => {
        gsap.to(el, {
          opacity: 1, y: 0, duration: 1, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 90%' }
        });
      });
      /* batch stagger inside grids */
      ['.help__grid', '.team__grid', '.reviews__grid', '.trust__stats'].forEach(sel => {
        const items = gsap.utils.toArray(sel + ' [data-reveal]');
        if (!items.length) return;
        ScrollTrigger.batch(items, {
          start: 'top 90%',
          onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1, stagger: .1, ease: 'expo.out', overwrite: true })
        });
      });
    }

    /* section heads kicker line draw */
    if (!reduce) {
      gsap.utils.toArray('.sec-head__kicker i').forEach(line => {
        gsap.from(line, {
          scaleX: 0, transformOrigin: 'left', duration: .9, ease: 'expo.out',
          scrollTrigger: { trigger: line, start: 'top 92%' }
        });
      });
    }

    /* PROCESS steps stagger */
    if (!reduce) {
      gsap.from('.pstep', {
        y: 50, opacity: 0, duration: 1, stagger: .12, ease: 'expo.out',
        scrollTrigger: { trigger: '.process__steps', start: 'top 80%' }
      });
    }

    /* STAT counters */
    gsap.utils.toArray('.stat b[data-count]').forEach(el => {
      const end = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(o, {
          v: end, duration: 1.8, ease: 'power2.out',
          onUpdate: () => { el.textContent = Math.round(o.v) + suffix; }
        })
      });
    });

    /* big footer wordmark reveal */
    if (!reduce) {
      gsap.from('.bigmark span, .bigmark .slashes', {
        yPercent: 110, opacity: 0, duration: 1.2, stagger: .08, ease: 'expo.out',
        scrollTrigger: { trigger: '.bigmark', start: 'top 92%' }
      });
    }
  }

  /* ============================================================
     CUSTOM CURSOR + MAGNETIC
     ============================================================ */
  if (!isTouch && !reduce) {
    const cursor = document.getElementById('cursor');
    const label = cursor.querySelector('.cursor__label');
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    const render = () => {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cursor.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(render);
    };
    render();
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));

    document.querySelectorAll('[data-cursor]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('is-active');
        label.textContent = el.dataset.cursor;
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('is-active');
        label.textContent = '';
      });
    });

    // magnetic buttons
    document.querySelectorAll('[data-magnetic]').forEach(el => {
      const strength = 0.4;
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * strength;
        const y = (e.clientY - r.top - r.height / 2) * strength;
        gsap.to(el, { x, y, duration: .6, ease: 'power3.out' });
      });
      el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.4)' }));
    });
  }

  /* ============================================================
     FORM
     ============================================================ */
  const form = document.getElementById('callbackForm');
  const toast = document.getElementById('toast');
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('is-show'), 3600);
  };
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    if (!name || phone.replace(/\D/g, '').length < 7) {
      showToast('Заполните имя и телефон');
      return;
    }
    showToast('Спасибо! Перезвоним в течение 30 минут');
    form.reset();
  });

})();
