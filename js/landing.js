import { gsap, ScrollTrigger, Lenis } from './vendor/motion-bundle.js';

/* Landing: rolagem suave (Lenis), animações (GSAP + ScrollTrigger) e as seções de conteúdo. */
export function initLanding(ctx) {
  const { P, brl, thumbOf, open, wantsWheel, whatsapp, modelsReady } = ctx;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const narrow = () => innerWidth < 760;
  const html = document.documentElement;
  const topbar = $('.top');

  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- rolagem suave ---------- */
  let lenis = null;
  if (!reduce) {
    lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 0.95,
      // quando o mouse está sobre o cabideiro, a roda é dele; Lenis só cuida do resto da página
      virtualScroll: ({ event }) => !wantsWheel(event),
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const goTo = (target, done) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.5, easing: (x) => 1 - Math.pow(1 - x, 4), onComplete: done });
    else { const el = typeof target === 'string' ? $(target) : null; window.scrollTo({ top: el ? el.getBoundingClientRect().top + scrollY : target, behavior: 'auto' }); done && done(); }
  };
  $$('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(a.dataset.go === '#hero' ? 0 : a.dataset.go); }));

  /* ---------- progresso e cabeçalho ---------- */
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });
  if (reduce) {
    gsap.set('.reveal, .stat', { opacity: 1 });
    $$('.scrub .w').forEach((w) => { w.style.opacity = 1; });
  }

  /* ---------- entrada do hero ---------- */
  $$('.headline > span').forEach((line) => {
    const txt = line.textContent;
    line.setAttribute('aria-label', txt);
    line.innerHTML = txt.split(' ').map((w) => `<span class="wd" aria-hidden="true">${[...w].map((ch) => `<span class="ch">${ch}</span>`).join('')}</span>`).join(' ');
  });
  if (!reduce) {
    const tl = gsap.timeline({ delay: 0.25, defaults: { ease: 'expo.out' } });
    tl.fromTo(topbar, { yPercent: -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2 }, 0)
      .fromTo('.copy .eyebrow', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, 0.25)
      .fromTo('.headline .ch', { yPercent: 115, rotate: 7, opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, duration: 1.4, stagger: { each: 0.03, from: 'start' } }, 0.35)
      .fromTo('.copy .lede', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2 }, 1)
      .fromTo('.copy .cue', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, 1.2);
  } else gsap.set(topbar, { opacity: 1 });

  // ao rolar para fora do hero: a cena sobe devagar, o texto sobe mais rápido e some
  const copy = $('#copy');
  gsap.set(copy, { '--co': 1 });
  if (!reduce) {
    gsap.to('#stage', { y: () => innerHeight * 0.22, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to(copy, { y: () => innerHeight * 0.42, '--co': 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: '55% top', scrub: true } });
  }

  /* ---------- manifesto: as palavras acendem com a rolagem (seção fixa) ---------- */
  const scrub = $('#scrub');
  scrub.innerHTML = scrub.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  if (!reduce) {
    gsap.timeline({ scrollTrigger: { trigger: '#manifesto', start: 'top top', end: '+=140%', pin: true, scrub: 0.6, anticipatePin: 1 } })
      .to('#manifesto .w', { opacity: 1, stagger: 0.1, ease: 'none' });
    gsap.from('#manifesto .eyebrow', { y: 20, opacity: 0, duration: 1, scrollTrigger: { trigger: '#manifesto', start: 'top 70%' } });
  }

  /* ---------- números que contam ---------- */
  if (!reduce) {
    gsap.from('.stat', { y: 46, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: '#stats', start: 'top 82%' } });
    $$('.stat b').forEach((el) => {
      const to = +el.dataset.count, suf = el.dataset.suffix || '', o = { v: 0 };
      ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 2.2, ease: 'power2.out', onUpdate: () => { el.innerHTML = Math.round(o.v) + (suf ? `<em>${suf}</em>` : ''); } }) });
    });
  } else $$('.stat b').forEach((el) => { el.innerHTML = el.dataset.count + (el.dataset.suffix ? `<em>${el.dataset.suffix}</em>` : ''); });

  /* ---------- destaques: galeria de rolagem lateral ---------- */
  const FEAT = ['tee-dourada', 'jeans-mono', 'polo-preta', 'camisa-dourada', 'jeans-patch', 'polo-marinho', 'camisa-branca', 'tee-vermelha'];
  const BG = ['#d9d4c6', '#c9d2d9', '#e3d3c4', '#cfd6c8'];
  const track = $('#featTrack');
  track.innerHTML = FEAT.map((id, k) => {
    const i = P.findIndex((p) => p.id === id), p = P[i];
    return `<article class="card" data-i="${i}">
      <div class="card-img" style="--c:${BG[k % 4]}"><span class="card-no">${String(k + 1).padStart(2, '0')}</span><img alt="${p.name}" data-i="${i}"></div>
      <h3>${p.name}</h3><p>${brl(p.price)}</p>
      <a class="go magnetic" href="#hero" data-pick="${i}">Ver no cabideiro</a></article>`;
  }).join('');
  track.addEventListener('click', (e) => {
    const a = e.target.closest('[data-pick]');
    if (!a) return;
    e.preventDefault();
    const i = +a.dataset.pick;
    lenis ? lenis.scrollTo(0, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4), onComplete: () => open(i) }) : (window.scrollTo(0, 0), open(i));
  });

  // as miniaturas são o próprio modelo 3D renderizado; saem uma por vez, sem travar a rolagem
  modelsReady.then(() => {
    const queue = $$('.card-img img');
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 80));
    const next = () => {
      const img = queue.shift();
      if (!img) return;
      img.onload = () => img.classList.add('in');
      img.src = thumbOf(P[+img.dataset.i], true);
      idle(next);
    };
    idle(next);
  });

  if (!reduce) {
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '#featured', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 } });
    gsap.from('.featured-head > *', { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: '#featured', start: 'top 75%' } });
  } else { $('#featured').style.overflowX = 'auto'; }

  /* ---------- afirmações e passos ---------- */
  if (!reduce) {
    ScrollTrigger.batch('.reveal', {
      start: 'top 90%', once: true,
      onEnter: (els) => gsap.fromTo(els, { y: 36, opacity: 0, filter: narrow() ? 'none' : 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', stagger: 0.12, overwrite: true, clearProps: 'filter' }),
    });

    // faixa de texto: anda sozinha e acelera/inverte com a velocidade da rolagem
    const band = $('#band');
    const loop = gsap.to(band, { xPercent: -50, duration: 42, ease: 'none', repeat: -1 });
    const skew = gsap.quickSetter(band, 'skewX', 'deg');
    let sk = 0;
    lenis && lenis.on('scroll', ({ velocity }) => {
      loop.timeScale(gsap.utils.clamp(-7, 7, 1 + velocity * 0.45));
      sk = gsap.utils.clamp(-9, 9, -velocity * 0.4);
    });
    gsap.ticker.add(() => { skew(sk); sk *= 0.9; });

    // título final cresce com a rolagem
    gsap.fromTo('.cta-title', { scale: 0.78, opacity: 0.3 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#cta', start: 'top 85%', end: 'top 20%', scrub: true } });
  } else $('#band').parentElement.style.display = 'none';

  /* ---------- perguntas rápidas ---------- */
  $$('.qa').forEach((qa) => {
    const q = $('.q', qa), a = $('.a', qa);
    q.addEventListener('click', () => {
      const wasOpen = q.getAttribute('aria-expanded') === 'true';
      $$('.qa').forEach((o) => {
        const oq = $('.q', o);
        if (o !== qa && oq.getAttribute('aria-expanded') === 'true') { oq.setAttribute('aria-expanded', 'false'); gsap.to($('.a', o), { height: 0, duration: 0.55, ease: 'power3.inOut' }); }
      });
      q.setAttribute('aria-expanded', String(!wasOpen));
      gsap.to(a, { height: wasOpen ? 0 : 'auto', duration: 0.6, ease: 'power3.inOut', onComplete: () => ScrollTrigger.refresh() });
    });
  });

  /* ---------- convite final ---------- */
  $('#listBtn').href = `https://wa.me/${whatsapp}?text=${encodeURIComponent('Oi! Quero entrar na lista do próximo drop da Velchro.')}`;

  /* ---------- coisas vivas: cursor, ímãs e inclinação ---------- */
  if (fine && !reduce) {
    const cur = $('#cursor');
    const cx = gsap.quickTo(cur, 'x', { duration: 0.4, ease: 'power3' }), cy = gsap.quickTo(cur, 'y', { duration: 0.4, ease: 'power3' });
    addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); cur.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.remove('on'));
    document.addEventListener('pointerover', (e) => cur.classList.toggle('big', !!e.target.closest('a, button, .stage.pointing, .card')));

    const bind = () => {
      $$('.magnetic').forEach((el) => {
        if (el._mag) return; el._mag = true;
        const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1,0.5)' }), my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1,0.5)' });
        el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * 0.32); my((e.clientY - r.top - r.height / 2) * 0.4); });
        el.addEventListener('pointerleave', () => { mx(0); my(0); });
      });
      $$('.card-img').forEach((el) => {
        if (el._tilt) return; el._tilt = true;
        const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' }), ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
        gsap.set(el, { transformPerspective: 900 });
        el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 12); rx(-((e.clientY - r.top) / r.height - 0.5) * 12); });
        el.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
    };
    bind();
  }

  // criados por último: dependem das posições já deslocadas pelas seções fixas
  const darkActive = new Set();
  $$('.dark').forEach((d) => ScrollTrigger.create({
    trigger: d, start: 'top 44px', end: 'bottom 44px', invalidateOnRefresh: true,
    onToggle: (self) => {
      self.isActive ? darkActive.add(d) : darkActive.delete(d);
      topbar.classList.toggle('inv', darkActive.size > 0);
      document.body.classList.toggle('on-dark', darkActive.size > 0);
    },
  }));

  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());

  return {
    setLocked: (on) => { on ? lenis && lenis.stop() : lenis && lenis.start(); },
    toTop: () => { lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : window.scrollTo(0, 0); },
  };
}
