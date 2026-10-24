(() => {
  const V = window.VELCHRO;
  const P = V.products;
  const N = P.length;
  const $ = (s, r = document) => r.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const root = $('#wall');
  const stage = $('#stage');
  const rail = $('#rail');
  const itemsEl = $('#items');
  const focusEl = $('#focus');
  const infoEl = $('#info');
  const hoverName = $('#hoverName');

  const REST_TURN = 74;
  const HOOK = 0.055; // pivô do gancho em fração de --iw (22 / 400)

  let W = 0, H = 0, iw = 0, fiw = 0, pitch = 0;
  let railRest = 0, railFocus = 0;

  /* ---------- montagem ---------- */
  focusEl.hidden = false;
  const items = P.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'item';
    const steps = p.photo ? [-3, -1.5, 0, 1.5, 3] : [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    const slices = steps.map((k) => `<div class="slice" style="transform:translateZ(calc(var(--iw)*${k * (p.photo ? 0.0083 : 0.00625)}))">${Garments.build(p, 'front', { slice: true })}</div>`).join('');
    el.innerHTML = `
      <div class="cast"></div>
      <div class="pivot"><div class="sway"><div class="turn">
        ${slices}
        <div class="face front">${Garments.build(p, 'front')}
          <div class="tagwrap"><i class="string"></i><div class="tag" style="--bg:${p.tag.bg};--fg:${p.tag.fg}">${brl(p.price)} · ${p.name.split(' ').slice(-1)[0]}</div></div>
        </div>
        <div class="face back">${Garments.build(p, 'back')}</div>
      </div></div></div>`;
    itemsEl.appendChild(el);
    return {
      i, p, el,
      cast: $('.cast', el), pivot: $('.pivot', el), sway: $('.sway', el), turn: $('.turn', el),
      x: 0, vx: 0, sc: 1, vsc: 0, tn: 90, vtn: 0, sw: 0, vsw: 0, op: 0, born: false,
    };
  });

  $('#srList').innerHTML = P.map((p, i) => `<li><button type="button" data-i="${i}">${p.name} — ${brl(p.price)}</button></li>`).join('');
  $('#ticker').innerHTML = Array(2).fill(V.ticker.map((t) => `<span>${t}</span>`).join('')).join('').repeat(3);

  /* ---------- estado ---------- */
  let scroll = 0, scrollV = 0, scrollTarget = 0, maxScroll = 0;
  let hover = -1;
  let focus = -1;
  let face = 'front';
  let faceTurn = 0, faceTurnTarget = 0;
  let railY = 0, railV = 0;
  let size = null;
  let drag = null;
  let lastScrollPx = 0, rackVel = 0;
  let manualTurn = null;

  /* ---------- layout ---------- */
  function layout() {
    W = innerWidth; H = innerHeight;
    const narrow = W < 640;
    iw = Math.min(0.36 * H, (narrow ? 0.46 : 0.225) * W);
    pitch = iw * (narrow ? 0.42 : 0.36);
    const footer = Math.max(H * 0.043, 32);
    railRest = H * 0.272;
    railFocus = Math.max(H * 0.095, 70);
    const stackH = 214;
    const fit = (H - railFocus - footer - 24 - stackH - 30) / 1.17;
    fiw = Math.max(180, Math.min(0.45 * H, 0.7 * W, fit));

    const rod = iw * 0.03039 - 1;
    const railW = W * (narrow ? 0.94 : 0.745);
    document.documentElement.style.setProperty('--iw', iw + 'px');
    document.documentElement.style.setProperty('--rod', Math.max(8, rod + 2) + 'px');
    rail.style.left = (W - railW) / 2 + 'px';
    rail.style.width = railW + 'px';

    const span = (N - 1) * pitch;
    maxScroll = Math.max(0, (span - (railW - iw * 0.7)) / 2 / pitch);
    scrollTarget = clamp(scrollTarget, -maxScroll, maxScroll);
    if (!railY) railY = focus >= 0 ? railFocus : railRest;
    placeInfo();
  }

  function placeInfo() {
    const hemY = Garments.hem(P[Math.max(focus, 0)]) / 400;
    infoEl.style.top = railFocus + (hemY - HOOK) * fiw + 22 + 'px';
    const mid = railFocus + fiw * 0.62;
    focusEl.style.setProperty('--arrow-y', mid + 'px');
    $('#prev').style.top = mid + 'px';
    $('#next').style.top = mid + 'px';
  }

  /* ---------- física (molas) ---------- */
  const spring = (pos, vel, target, k, c, dt) => {
    const a = k * (target - pos) - c * vel;
    vel += a * dt;
    return [pos + vel * dt, vel];
  };

  function baseX(i) {
    return W / 2 + (i - (N - 1) / 2 + scroll) * pitch;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    const inFocus = focus >= 0;

    // rolagem do cabideiro
    if (!drag) scrollTarget = clamp(scrollTarget, -maxScroll, maxScroll);
    [scroll, scrollV] = spring(scroll, scrollV, scrollTarget, drag ? 260 : 90, drag ? 30 : 15, dt);
    const scrollPx = scroll * pitch;
    const vel = (scrollPx - lastScrollPx) / Math.max(dt, 0.001);
    lastScrollPx = scrollPx;
    rackVel += (vel - rackVel) * Math.min(1, dt * 8);

    // trilho sobe no foco
    [railY, railV] = spring(railY, railV, inFocus ? railFocus : railRest, 110, 19, dt);
    rail.style.top = railY + 'px';
    rail.style.opacity = '1';

    const ref = inFocus ? focus : hover >= 0 ? hover : (N - 1) / 2;
    for (const it of items) {
      const i = it.i;
      const sel = inFocus && i === focus;
      let tx = baseX(i), ts = 1, tt = REST_TURN, to = 1;
      let wobble = reduce ? 0 : Math.sin(t * 0.9 + i * 1.7) * 0.7 + Math.sin(t * 0.37 + i) * 0.4;

      if (inFocus) {
        if (sel) { tx = W / 2; ts = fiw / iw; tt = manualTurn ?? faceTurnTarget; wobble *= 0.4; }
        else { to = 0; ts = 0.92; tx += (i < focus ? -1 : 1) * pitch * 0.8; }
      } else if (hover >= 0) {
        const d = i - hover;
        if (d === 0) { tt = 28; ts = 1.04; }
        else {
          const dir = Math.sign(d);
          tx += dir * iw * 0.2 * Math.max(0, 1 - (Math.abs(d) - 1) * 0.4);
          tt = REST_TURN + 4;
        }
      }

      // chegada: peças "caem" no trilho com balanço
      if (!it.born) {
        if (now > 250 + i * 90) {
          it.born = true;
          it.vsw = reduce ? 0 : (i % 2 ? 190 : -170);
          it.vtn = reduce ? 0 : -140;
        } else { to = 0; it.tn = 118; }
      }

      const kx = sel ? 120 : 150;
      [it.x, it.vx] = it.x === 0 ? [tx, 0] : spring(it.x, it.vx, tx, kx, sel ? 18 : 22, dt);
      [it.sc, it.vsc] = spring(it.sc, it.vsc, ts, 130, 19, dt);
      [it.tn, it.vtn] = sel && manualTurn !== null ? [tt, 0] : spring(it.tn, it.vtn, tt, sel ? 110 : 90, sel ? 14 : 12, dt);
      const swayTarget = clamp(-rackVel * 0.0042, -16, 16) * (sel ? 0.4 : 1) + wobble + (hover >= 0 && !inFocus && i !== hover ? Math.sign(i - hover) * -0.9 : 0);
      [it.sw, it.vsw] = spring(it.sw, it.vsw, swayTarget, 38 + (i % 3) * 5, 2.7 + (i % 2) * 0.5, dt);
      it.op += (to - it.op) * Math.min(1, dt * (to > it.op ? 8 : 12));

      const px = it.x - iw / 2;
      const py = railY - HOOK * iw;
      it.pivot.style.transform = `translate3d(${px}px,${py}px,0) scale(${it.sc})`;
      it.pivot.style.opacity = it.op.toFixed(3);
      it.sway.style.transform = `rotate(${it.sw.toFixed(3)}deg)`;
      it.turn.style.transform = `rotateY(${it.tn.toFixed(2)}deg)`;
      const flat = Math.abs(Math.sin((it.tn * Math.PI) / 180)) < 0.04;
      if (flat !== it.flat) { it.flat = flat; it.turn.classList.toggle('flat', flat); }

      // sombra projetada na parede
      const spread = Math.abs(Math.cos((it.tn * Math.PI) / 180));
      const cw = iw * (0.2 + 0.62 * spread) * it.sc;
      it.cast.style.width = cw + 'px';
      it.cast.style.height = iw * 1.05 * it.sc + 'px';
      it.cast.style.opacity = (0.1 * it.op).toFixed(3);
      it.cast.style.transform = `translate3d(${it.x - cw / 2 + iw * 0.07 * it.sc + (it.sw * -1.2)}px,${railY + iw * 0.12 * it.sc}px,0)`;

      it.pivot.style.zIndex = it.cast.style.zIndex = '';
      if (sel !== it.isSel) { it.isSel = sel; it.el.classList.toggle('sel', sel); }
      it.el.style.zIndex = sel ? 60 : 30 - Math.round(Math.abs(i - ref) * 2);
    }

    requestAnimationFrame(frame);
  }

  /* ---------- ponteiro ---------- */
  function pick(px, py) {
    if (focus >= 0) return -1;
    if (py < railY - 20 || py > railY + iw * 1.32) return -1;
    let best = -1, bd = Infinity;
    for (const it of items) {
      const d = Math.abs(px - it.x);
      if (d < bd) { bd = d; best = it.i; }
    }
    return bd < pitch * 0.62 + iw * 0.06 ? best : -1;
  }

  function setHover(i) {
    if (i === hover) return;
    hover = i;
    stage.classList.toggle('pointing', i >= 0);
    if (i >= 0) {
      $('b', hoverName).textContent = P[i].name;
      $('span', hoverName).textContent = brl(P[i].price);
      hoverName.style.opacity = 1;
      hoverName.style.left = clamp(items[i].x, 140, W - 140) + 'px';
    } else hoverName.style.opacity = 0;
  }

  stage.addEventListener('pointermove', (e) => {
    if (drag) return;
    if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
  });
  stage.addEventListener('pointerleave', () => { if (!drag) setHover(-1); });

  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, sx: scroll, moved: false, pick: pick(e.clientX, e.clientY), id: e.pointerId, t: e.timeStamp, lx: e.clientX, lt: e.timeStamp, v: 0, turn0: focus >= 0 ? items[focus].tn : 0 };
    if (focus >= 0) manualTurn = items[focus].tn;
    if (e.pointerType !== 'mouse') setHover(drag.pick);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; stage.classList.add('dragging'); setHover(-1); }
    if (!drag.moved) return;
    const dtm = Math.max(1, e.timeStamp - drag.lt);
    drag.v = (e.clientX - drag.lx) / dtm;
    drag.lx = e.clientX; drag.lt = e.timeStamp;
    if (focus >= 0) {
      manualTurn = drag.turn0 + dx * 0.55;
    } else {
      let target = drag.sx + dx / pitch;
      if (target > maxScroll) target = maxScroll + (target - maxScroll) * 0.3;
      if (target < -maxScroll) target = -maxScroll + (target + maxScroll) * 0.3;
      scrollTarget = target;
    }
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    stage.classList.remove('dragging');
    if (focus >= 0) {
      if (d.moved) {
        let n = Math.round((items[focus].tn + d.v * 160) / 180);
        if (P[focus].photo) n = Math.round(n / 2) * 2; // fotos não têm costas
        face = Math.abs(n) % 2 ? 'back' : 'front';
        faceTurnTarget = n * 180;
        manualTurn = null;
        syncSeg();
      }
      return;
    }
    if (d.moved) scrollTarget = clamp(scrollTarget + d.v * 220 / pitch, -maxScroll - 0.3, maxScroll + 0.3);
    else if (d.pick >= 0) open(d.pick);
    if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
    else setHover(-1);
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener('wheel', (e) => {
    if (focus >= 0) return;
    e.preventDefault();
    scrollTarget = clamp(scrollTarget - (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / pitch * 0.8, -maxScroll, maxScroll);
  }, { passive: false });

  /* ---------- foco ---------- */
  function open(i) {
    focus = i;
    size = null;
    setHover(-1);
    face = 'front';
    faceTurn = 0; faceTurnTarget = 0; manualTurn = null;
    items[i].tn = REST_TURN;
    root.classList.add('is-focus');
    $('#navClose').tabIndex = 0;
    fill();
    placeInfo();
    infoEl.style.opacity = 0;
    setTimeout(() => { infoEl.style.opacity = 1; }, reduce ? 0 : 380);
    history.replaceState(null, '', '#' + P[i].id);
  }

  function close() {
    if (focus < 0) return;
    const prev = focus;
    focus = -1;
    items[prev].tn = ((items[prev].tn % 360) + 360) % 360;
    if (items[prev].tn > 180) items[prev].tn -= 360;
    faceTurn = 0; faceTurnTarget = 0;
    root.classList.remove('is-focus');
    $('#navClose').tabIndex = -1;
    infoEl.style.opacity = 0;
    history.replaceState(null, '', location.pathname);
  }

  function go(dir) {
    if (focus < 0) return;
    const next = (focus + dir + N) % N;
    const old = items[focus];
    old.tn = ((old.tn % 360) + 360) % 360;
    if (old.tn > 180) old.tn -= 360;
    focus = next;
    size = null;
    face = 'front';
    faceTurn = 0; faceTurnTarget = 0; manualTurn = null;
    items[next].tn = REST_TURN;
    items[next].vsw = dir * 120;
    fill();
    placeInfo();
    history.replaceState(null, '', '#' + P[next].id);
  }

  function fill() {
    const p = P[focus];
    $('#infoName').textContent = p.name;
    $('#seg').style.display = p.photo ? 'none' : '';
    $('#infoPrice').innerHTML = `<b>${brl(p.price)}</b> · em até 3x sem juros`;
    $('#sizes').innerHTML = V.sizes.map((s) => `<button type="button" data-size="${s}" aria-pressed="false">${s}</button>`).join('');
    syncSeg();
    syncCta();
  }

  function syncSeg() {
    $('#seg').classList.toggle('back', face === 'back');
    document.querySelectorAll('#seg button').forEach((b) => b.classList.toggle('lit', b.dataset.face === face));
  }
  function syncCta() {
    const c = $('#cta');
    c.textContent = size ? `Adicionar à sacola · ${size}` : 'Escolha um tamanho';
    c.classList.toggle('ready', !!size);
  }

  $('#seg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    face = b.dataset.face;
    const base = Math.round(items[focus].tn / 360) * 360;
    faceTurnTarget = base + (face === 'back' ? 180 : 0);
    syncSeg();
  });
  $('#sizes').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    size = b.dataset.size;
    document.querySelectorAll('#sizes button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    syncCta();
  });
  $('#cta').addEventListener('click', () => {
    if (!size) {
      const s = $('#sizes');
      s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
      return;
    }
    addToBag(P[focus].id, size);
    toast(`${P[focus].name} (${size}) na sacola`);
  });
  $('#prev').addEventListener('click', () => go(-1));
  $('#next').addEventListener('click', () => go(1));
  $('#navClose').addEventListener('click', close);
  $('#srList').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) open(+b.dataset.i);
  });
  $('#srList').addEventListener('focusin', (e) => {
    const b = e.target.closest('button');
    if (b && focus < 0) setHover(+b.dataset.i);
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#sheet').classList.contains('on')) return sheet(null);
      if ($('#drawer').classList.contains('on')) return bagToggle(false);
      return close();
    }
    if (focus >= 0) {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    } else if (!e.target.closest('button, a')) {
      if (e.key === 'ArrowLeft') scrollTarget = clamp(scrollTarget + 1, -maxScroll, maxScroll);
      if (e.key === 'ArrowRight') scrollTarget = clamp(scrollTarget - 1, -maxScroll, maxScroll);
    }
  });

  /* ---------- sacola ---------- */
  let bag = [];
  try { bag = JSON.parse(localStorage.getItem('velchro-bag') || '[]').filter((l) => P.some((p) => p.id === l.id)); } catch (_) { bag = []; }

  function saveBag() { try { localStorage.setItem('velchro-bag', JSON.stringify(bag)); } catch (_) { /* modo privado */ } }
  function addToBag(id, sz) {
    const line = bag.find((l) => l.id === id && l.size === sz);
    if (line) line.qty += 1; else bag.push({ id, size: sz, qty: 1 });
    saveBag(); renderBag();
  }
  function renderBag() {
    const count = bag.reduce((n, l) => n + l.qty, 0);
    $('#bagCount').textContent = `(${count})`;
    const total = bag.reduce((n, l) => n + l.qty * P.find((p) => p.id === l.id).price, 0);
    $('#bagTotal').textContent = brl(total);
    $('#checkout').disabled = !count;
    $('#bagList').innerHTML = bag.map((l, k) => {
      const p = P.find((x) => x.id === l.id);
      return `<li>
        <div class="bag-thumb">${Garments.build(p, 'front')}</div>
        <div><div class="bag-name">${p.name}</div><div class="bag-meta">Tamanho ${l.size}</div>
          <div class="qty"><button type="button" data-k="${k}" data-d="-1" aria-label="Menos">−</button><span>${l.qty}</span><button type="button" data-k="${k}" data-d="1" aria-label="Mais">+</button></div></div>
        <div class="bag-price">${brl(p.price * l.qty)}</div></li>`;
    }).join('');
  }
  $('#bagList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    const l = bag[+b.dataset.k];
    l.qty += +b.dataset.d;
    if (l.qty <= 0) bag.splice(+b.dataset.k, 1);
    saveBag(); renderBag();
  });
  function bagToggle(on) {
    $('#drawer').classList.toggle('on', on);
    $('#scrim').classList.toggle('on', on);
    $('#drawer').setAttribute('aria-hidden', String(!on));
  }
  $('#navBag').addEventListener('click', () => bagToggle(true));
  $('#drawerClose').addEventListener('click', () => bagToggle(false));
  $('#scrim').addEventListener('click', () => { bagToggle(false); });
  $('#checkout').addEventListener('click', () => {
    const lines = bag.map((l) => { const p = P.find((x) => x.id === l.id); return `• ${l.qty}x ${p.name} (${l.size}) — ${brl(p.price * l.qty)}`; });
    const total = bag.reduce((n, l) => n + l.qty * P.find((p) => p.id === l.id).price, 0);
    const msg = `Olá! Quero finalizar meu pedido na Velchro:\n\n${lines.join('\n')}\n\nTotal: ${brl(total)}`;
    window.open(`https://wa.me/${V.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- sobre / contato ---------- */
  const SHEETS = {
    sobre: `<h2>Sobre</h2>
      <p>A Velchro nasceu de uma ideia simples: roupa boa se escolhe com a mão, no cabide, olhando de perto. Aqui o site é a loja — o cabideiro é o mesmo, só que cabe no seu bolso.</p>
      <p>Cada peça sai em tiragem curta, com modelagem larga e tecido pesado. Quando acaba, acaba.</p>
      <p>Dúvidas? Fale com a gente em <a href="mailto:contato@velchro.com">contato@velchro.com</a>.</p>`,
    contato: `<h2>Contato</h2>
      <p>Pedidos, trocas e parcerias:</p>
      <p><a href="https://instagram.com/" target="_blank" rel="noopener">@velchro</a><br><a href="mailto:contato@velchro.com">contato@velchro.com</a></p>
      <p>Atendimento de segunda a sábado, das 10h às 19h.</p>`,
  };
  function sheet(name) {
    const el = $('#sheet');
    if (name) $('#sheetBody').innerHTML = SHEETS[name];
    el.classList.toggle('on', !!name);
    el.setAttribute('aria-hidden', String(!name));
  }
  document.querySelectorAll('[data-sheet]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); sheet(a.dataset.sheet); }));
  $('#sheetClose').addEventListener('click', () => sheet(null));

  /* ---------- início ---------- */
  addEventListener('resize', layout);
  layout();
  renderBag();
  const start = P.findIndex((p) => '#' + p.id === location.hash);
  if (start >= 0) {
    items.forEach((it) => { it.born = true; });
    open(start);
  }
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });

  window.__velchro = { open, close, go, items, get focus() { return focus; } };
})();
