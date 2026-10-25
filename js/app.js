import * as T from './vendor/three-bundle.js';

const V = window.VELCHRO;
const P = V.products;
const N = P.length;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RAD = Math.PI / 180;

const html = document.documentElement;
const body = document.body;
const hero = $('#hero');
const stage = $('#stage');
const canvas = $('#gl');
const infoEl = $('#info');
const focusEl = $('#focus');
const copy = $('#copy');
const rangeEl = $('#range');
const eyeSuffix = $('#eyeSuffix');

const SIDE = 72;     // roupa de lado em repouso; vira de frente só com o mouse
const TOP = -0.115;  // topo da peça abaixo do trilho (m)
const PPM = 1.16;    // px por metro, em múltiplos de iw

let W = 0, H = 0, iw = 0, ppm = 1, R = 0, cx = 0, cy = 0, arcTop = 0;
let stepDeg = 12, VIS = 10, narrow = false, chord = 1, cMin = 0, cMax = 0, railFocus = 0;

/* ======================= cena 3D ======================= */
let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  hero.insertAdjacentHTML('beforeend', '<p class="nogl">Seu navegador não conseguiu abrir o 3D. Tente atualizar o Chrome, Edge ou Safari.</p>');
  throw err;
}
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new T.Scene();
const pmrem = new T.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;
const keyLight = new T.DirectionalLight(0xfff0d8, 1.7);
keyLight.position.set(-380, 620, 760);
scene.add(keyLight);
const fillLight = new T.DirectionalLight(0xdfe8ff, 0.5);
fillLight.position.set(500, 120, 500);
scene.add(fillLight);

const camera = new T.PerspectiveCamera(30, 1, 50, 6000);
const CAM_D = 1400;
const rig = new T.Group(); rig.position.set(0, 0, -260); scene.add(rig);   // órbita da câmera em torno do meio da cena
const world = new T.Group(); world.position.set(0, 0, 260); rig.add(world);

/* ---------- materiais e modelos ---------- */
const metalMat = new T.MeshStandardMaterial({ color: 0xdadbd6, metalness: 1, roughness: 0.26 });
const darkMat = new T.MeshStandardMaterial({ color: 0x171716, metalness: 0.15, roughness: 0.42 });

function grayTexture(tex) {
  const img = tex.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  let sum = 0;
  for (let i = 0; i < d.data.length; i += 4) {
    const l = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    d.data[i] = d.data[i + 1] = d.data[i + 2] = l; sum += l;
  }
  const gain = 205 / Math.max(1, sum / (d.data.length / 4)); // tecido sempre com brilho de partida parecido
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.min(255, d.data[i] * gain);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  const t = new T.CanvasTexture(c);
  t.flipY = false; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const MODELS = {};
async function loadModels() {
  const loader = new T.GLTFLoader();
  await Promise.all(Object.entries(V.models).map(async ([key, m]) => {
    const g = await loader.loadAsync(m.file);
    const mesh = g.scene.getObjectByProperty('isMesh', true);
    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox, size = bb.getSize(new T.Vector3()), ctr = bb.getCenter(new T.Vector3());
    const s = m.h / size.y;
    const map = mesh.material.map;
    if (map) map.anisotropy = 4;
    MODELS[key] = { geo, map, normal: mesh.material.normalMap, s, bb, ctr, size: size.multiplyScalar(s), cfg: m, gray: null };
  }));
}

function hookGeo() {
  const ring = new T.TorusGeometry(0.019, 0.0028, 8, 28, 1.65 * Math.PI);
  ring.rotateZ(-0.325 * Math.PI); ring.rotateY(Math.PI / 2);
  const stem = new T.CylinderGeometry(0.0028, 0.0028, 0.09, 8); stem.translate(0, -0.063, 0);
  return [ring, stem];
}
const HOOK_GEOS = hookGeo();
const NECK_GEO = new T.CylinderGeometry(0.0055, 0.0055, 0.02, 10);
const BAR_GEO = new T.CylinderGeometry(0.0045, 0.0045, 1, 8); // comprimento ajustado por escala
const CLIP_GEO = new T.BoxGeometry(0.05, 0.034, 0.045);

function tagTexture(p) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = p.tag[0]; g.beginPath();
  g.moveTo(26, 0); g.lineTo(102, 0); g.lineTo(128, 36); g.lineTo(128, 300); g.lineTo(0, 300); g.lineTo(0, 36); g.closePath(); g.fill();
  g.fillStyle = '#e8e4da'; g.beginPath(); g.arc(64, 22, 9, 0, 6.3); g.fill();
  g.fillStyle = p.tag[1]; g.textAlign = 'center';
  g.save(); g.translate(64, 150); g.rotate(Math.PI / 2);
  g.font = '700 25px Archivo, Arial, sans-serif'; g.fillText(brl(p.price), 0, -10);
  g.font = '600 15px Archivo, Arial, sans-serif'; g.fillText(V.models[p.model].kind.toUpperCase(), 0, 20);
  g.restore();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* monta uma peça pendurada: gancho, cabide/grampo e modelo 3D. Origem = ponto do trilho. */
function buildItem(p) {
  const M = MODELS[p.model];
  const mats = [];
  const own = (m) => { const c = m.clone(); mats.push(c); return c; };
  const root = new T.Group();
  const sway = new T.Group(); root.add(sway);
  const turn = new T.Group(); sway.add(turn);

  const h = M.cfg.h;
  const gm = new T.MeshStandardMaterial({ map: M.map, normalMap: M.normal, roughness: 0.85, metalness: 0, side: T.DoubleSide });
  if (p.gray) { M.gray = M.gray || grayTexture(M.map); gm.map = M.gray; }
  if (p.color) gm.color.set(p.color);
  mats.push(gm);
  const garment = new T.Mesh(M.geo, gm);
  garment.scale.setScalar(M.s);
  garment.position.set(-M.ctr.x * M.s, TOP - M.bb.max.y * M.s, -M.ctr.z * M.s);
  turn.add(garment);

  const hm = own(metalMat), dm = own(darkMat);
  HOOK_GEOS.forEach((g) => turn.add(new T.Mesh(g, hm)));
  const neck = new T.Mesh(NECK_GEO, dm); neck.position.y = TOP + 0.006; turn.add(neck);
  const w = M.size.x * 0.9;
  if (M.cfg.hang === 'clip') {
    const bar = new T.Mesh(BAR_GEO, hm); bar.rotation.z = Math.PI / 2; bar.scale.y = Math.min(0.34, w * 1.3); bar.position.y = TOP + 0.002; turn.add(bar);
    [-1, 1].forEach((s) => { const c = new T.Mesh(CLIP_GEO, dm); c.position.set(s * 0.1, TOP - 0.012, 0); turn.add(c); });
  } else {
    [-1, 1].forEach((s) => {
      const dx = s * w / 2, dy = -w * 0.085, L = Math.hypot(dx, dy);
      const bar = new T.Mesh(BAR_GEO, dm);
      bar.scale.y = L; bar.rotation.z = Math.atan2(-dx, dy);
      bar.position.set(dx / 2, TOP - 0.004 + dy / 2, 0);
      turn.add(bar);
    });
  }

  // etiqueta de preço pendurada no cabide
  const tagMat = new T.MeshBasicMaterial({ map: tagTexture(p), transparent: true, side: T.DoubleSide });
  mats.push(tagMat);
  const tag = new T.Group();
  const card = new T.Mesh(new T.PlaneGeometry(0.058, 0.136), tagMat); card.position.y = -0.082;
  const string = new T.Mesh(new T.CylinderGeometry(0.0008, 0.0008, 0.03, 4), own(darkMat)); string.position.y = -0.012;
  tag.add(card, string);
  tag.position.set(M.size.x * 0.34, TOP - 0.03, M.size.z * 0.5 + 0.012);
  turn.add(tag);

  const proxy = new T.Mesh(new T.BoxGeometry(M.size.x * 1.05, h + 0.12, M.size.z * 1.1), new T.MeshBasicMaterial({ visible: false }));
  proxy.position.y = TOP - h / 2 + 0.03; turn.add(proxy);

  return { root, sway, turn, proxy, tag, tagMat, mats, h, total: h + 0.115 };
}

const blob = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(30,26,16,.9)'); gr.addColorStop(1, 'rgba(30,26,16,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
})();

let items = [];
function makeItems() {
  items = P.map((p, i) => {
    const b = buildItem(p);
    world.add(b.root);
    const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: blob, transparent: true, opacity: 0, depthWrite: false }));
    world.add(shadow);
    b.proxy.userData.i = i;
    b.root.visible = false;
    return { i, p, ...b, shadow, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sc: 1, vsc: 0, tn: 90, vtn: 0, sw: 0, vsw: 0, op: 0, born: false, init: false, th: 0 };
  });
}

/* ---------- trilho em 3D: arco que também recua em profundidade ---------- */
const bowl = (deg) => -R * 0.55 * (1 - Math.cos(deg * RAD));
const arcPt = (deg) => [cx + R * Math.sin(deg * RAD), cy - R * Math.cos(deg * RAD), bowl(deg)];
const toW = (x, y) => [x - W / 2, H / 2 - y];
const railGroup = new T.Group(); world.add(railGroup);
let railArcMat, railFocusMat, rodPx = 9;

function buildRail() {
  railGroup.children.slice().forEach((c) => { railGroup.remove(c); c.geometry?.dispose(); });
  railArcMat = new T.MeshStandardMaterial({ color: 0xe6e7e3, metalness: 1, roughness: 0.22, transparent: true });
  railFocusMat = railArcMat.clone();
  const pts = [];
  for (let d = -86; d <= 86; d += 2) { const [x, y, z] = arcPt(d); const [wx, wy] = toW(x, y); pts.push(new T.Vector3(wx, wy, z)); }
  railGroup.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 200, rodPx / 2, 14), railArcMat));
  const wireMat = new T.MeshBasicMaterial({ color: 0x2b2b29, transparent: true, opacity: 0.55 });
  railArcMat.userData.wires = [];
  [-34, -17, 17, 34].forEach((d) => {
    const [x, y, z] = arcPt(d); const [wx, wy] = toW(x, y);
    const len = H / 2 + 120 - wy;
    const wire = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, len, 6), wireMat);
    wire.position.set(wx, wy + len / 2, z); railGroup.add(wire);
  });
  railGroup.userData.wireMat = wireMat;
  const [, fy] = toW(0, railFocus);
  const straight = new T.Mesh(new T.CylinderGeometry(rodPx / 2, rodPx / 2, W * 1.4, 14), railFocusMat);
  straight.rotation.z = Math.PI / 2; straight.position.set(0, fy, 0); railGroup.add(straight);
  railGroup.userData.straight = straight;
}

/* ======================= layout ======================= */
function layout() {
  W = hero.clientWidth; H = hero.clientHeight;
  narrow = W < 760;
  VIS = narrow ? 5 : 10;
  stepDeg = 120 / VIS;
  const footer = Math.max(H * 0.043, 32);
  copy.classList.toggle('compact', H < 760);
  arcTop = H * (narrow ? 0.2 : 0.17);
  iw = Math.min(0.3 * H, (narrow ? 0.44 : 0.19) * W);
  const copyTop = H - footer - H * 0.032 - copy.offsetHeight;
  iw = Math.max(0.15 * H, Math.min(iw, (copyTop - 16 - arcTop) / 1.3));
  ppm = iw * PPM;
  R = narrow ? W * 0.62 : Math.min(W * 0.64, H * 1.05);
  cx = W / 2; cy = arcTop + R;
  chord = R * stepDeg * RAD;
  cMin = (VIS - 1) / 2;
  cMax = Math.max(cMin, N - 1 - (VIS - 1) / 2);
  railFocus = Math.max(H * 0.095, 70);
  rodPx = Math.max(8, iw * 0.034);

  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.fov = (2 * Math.atan(H / 2 / CAM_D)) / RAD;
  camera.position.set(0, 0, CAM_D);
  camera.updateProjectionMatrix();
  buildRail();

  cTarget = clamp(cTarget, cMin, cMax);
  c = clamp(c, cMin - 1, cMax + 1);
  placeInfo();
  sizeDust();
}

const focusIw = (p) => {
  const footer = Math.max(H * 0.043, 32);
  const avail = H - railFocus - footer - 24 - 214 - 30;
  return Math.max(150, Math.min(0.45 * H, 0.7 * W, avail / (((V.models[p.model].h + 0.115) * PPM))));
};

function placeInfo() {
  const p = P[Math.max(focus, 0)];
  const f = focusIw(p);
  const totalPx = (V.models[p.model].h + 0.115) * PPM * f;
  infoEl.style.top = railFocus + totalPx + 22 + 'px';
  const mid = railFocus + totalPx * 0.5;
  $('#prev').style.top = mid + 'px';
  $('#next').style.top = mid + 'px';
}

/* ======================= estado ======================= */
let c = 0, cV = 0, cTarget = 0;
let hover = -1, focus = -1;
let face = 'front', faceTurnTarget = 0, size = null;
let drag = null, lastC = 0, rackVel = 0, manualTurn = null, snapTimer = 0;
const pm = { x: 0, y: 0, tx: 0, ty: 0 };
let fb = 1; // 1 = arco ativo, 0 = foco
const snapTo = (v) => clamp(Math.round(v - cMin) + cMin, cMin, cMax);
const spring = (pos, vel, target, k, damp, dt) => {
  vel += (k * (target - pos) - damp * vel) * dt;
  return [pos + vel * dt, vel];
};

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0.001, 0.033);
  last = now;
  const t = now / 1000;
  const inFocus = focus >= 0;
  if (window.scrollY > H * 1.15 && !inFocus) return; // fora da tela: não gasta GPU

  [c, cV] = spring(c, cV, cTarget, drag ? 320 : 85, drag ? 36 : 17, dt);
  const vel = ((c - lastC) * chord) / Math.max(dt, 0.001);
  lastC = c;
  rackVel += (vel - rackVel) * Math.min(1, dt * 8);

  pm.x += (pm.tx - pm.x) * Math.min(1, dt * 4);
  pm.y += (pm.ty - pm.y) * Math.min(1, dt * 4);
  fb += ((inFocus ? 0 : 1) - fb) * Math.min(1, dt * 6);
  rig.rotation.y = pm.x * 0.12 * fb;
  rig.rotation.x = -pm.y * 0.06 * fb;
  hero.style.setProperty('--lx', (50 + pm.x * 24).toFixed(1) + '%');
  hero.style.setProperty('--ly', (14 + pm.y * 10).toFixed(1) + '%');

  railArcMat.opacity = fb; railArcMat.visible = fb > 0.02;
  railGroup.userData.wireMat.opacity = 0.55 * fb;
  railFocusMat.opacity = 1 - fb; railGroup.userData.straight.visible = fb < 0.98;
  railGroup.children.forEach((ch) => { if (ch.geometry?.type === 'TubeGeometry') ch.visible = fb > 0.02; });

  const first = Math.round(c - (VIS - 1) / 2) + 1;
  const txt = hover >= 0 && !inFocus
    ? `${P[hover].name} — ${brl(P[hover].price)}`
    : `${String(first).padStart(2, '0')}–${String(Math.min(first + VIS - 1, N)).padStart(2, '0')} / ${N}`;
  if (rangeEl.textContent !== txt) rangeEl.textContent = txt;
  eyeSuffix.style.display = hover >= 0 && !inFocus ? 'none' : '';

  for (const it of items) {
    const i = it.i;
    const sel = inFocus && i === focus;
    let th = (i - c) * stepDeg;
    if (!inFocus && hover >= 0 && i !== hover) {
      const d = i - hover;
      th += Math.sign(d) * 3.4 * Math.max(0, 1 - (Math.abs(d) - 1) * 0.45);
    }
    const ath = Math.abs(th);
    let tx = cx + R * Math.sin(th * RAD);
    let ty = cy - R * Math.cos(th * RAD);
    let tz = bowl(th);
    let ts = 1, tt = SIDE;
    let to = clamp((67 - ath) / 10, 0, 1);
    let wobble = reduce ? 0 : Math.sin(t * 0.9 + i * 1.7) * 0.7 + Math.sin(t * 0.37 + i) * 0.4;

    if (!inFocus && i === hover) { tt = 0; ts = 1.04; tz += 150; }
    if (inFocus) {
      if (sel) { tx = W / 2; ty = railFocus; tz = 0; ts = focusIw(it.p) / iw; tt = manualTurn ?? faceTurnTarget; wobble *= 0.4; to = 1; }
      else { to = 0; tx += (th < 0 ? -1 : 1) * 40; }
    }

    // chegada: as peças caem no arco, uma a uma, com balanço
    if (!it.born) {
      if (now > 350 + Math.abs(i - (N - 1) / 2) * 38) {
        it.born = true;
        it.vsw = reduce ? 0 : (i % 2 ? 190 : -170);
        it.vtn = reduce ? 0 : -120;
      } else to = 0;
    }
    if (!it.init) { it.init = true; it.x = tx; it.y = ty - H * 0.55; it.z = tz; it.tn = tt + 40; }

    [it.x, it.vx] = spring(it.x, it.vx, tx, sel ? 130 : 240, sel ? 18 : 26, dt);
    [it.y, it.vy] = spring(it.y, it.vy, ty, sel ? 130 : 200, sel ? 18 : 24, dt);
    [it.z, it.vz] = spring(it.z, it.vz, tz, 170, 22, dt);
    [it.sc, it.vsc] = spring(it.sc, it.vsc, ts, 130, 19, dt);
    [it.tn, it.vtn] = sel && manualTurn !== null ? [tt, 0] : spring(it.tn, it.vtn, tt, sel ? 110 : 80, sel ? 14 : 12, dt);
    const swayTarget = clamp(-rackVel * 0.0042, -16, 16) * (sel ? 0.4 : 1) + wobble;
    [it.sw, it.vsw] = spring(it.sw, it.vsw, swayTarget, 38 + (i % 3) * 5, 2.7 + (i % 2) * 0.5, dt);
    it.op += (to - it.op) * Math.min(1, dt * (to > it.op ? 8 : 12));
    it.th = th;

    const vis = it.op > 0.01;
    it.root.visible = vis; it.shadow.visible = vis;
    if (!vis) continue;

    const [wx, wy] = toW(it.x, it.y);
    it.root.position.set(wx, wy, it.z);
    it.root.scale.setScalar(ppm * it.sc);
    it.sway.rotation.z = -it.sw * RAD;
    it.turn.rotation.y = it.tn * RAD;
    it.tag.rotation.z = Math.sin(t * 1.7 + i) * 0.07;

    const solid = it.op > 0.995;
    for (const m of it.mats) { m.opacity = m === it.tagMat ? it.op * (sel ? 1 : 0) : it.op; m.transparent = !solid || m === it.tagMat; }

    // sombra suave projetada na parede
    const hp = it.total * ppm * it.sc;
    const spread = Math.abs(Math.cos(it.tn * RAD));
    it.shadow.scale.set(hp * 0.58 * (0.28 + 0.72 * spread), hp * 0.9, 1);
    it.shadow.position.set(wx + 26 * it.sc, wy - hp * 0.5, it.z - 150);
    it.shadow.material.opacity = 0.22 * it.op * fb + 0.12 * it.op * (1 - fb) * (sel ? 1 : 0);
  }

  renderer.render(scene, camera);
}

/* ======================= ponteiro ======================= */
const ray = new T.Raycaster();
const ndc = new T.Vector2();
const loc = (e) => {
  const r = stage.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};

function pick(px, py) {
  if (focus >= 0) return -1;
  ndc.set((px / W) * 2 - 1, -((py / H) * 2 - 1));
  ray.setFromCamera(ndc, camera);
  const objs = items.filter((it) => it.op > 0.3).map((it) => it.proxy);
  const hits = ray.intersectObjects(objs, false);
  return hits.length ? hits[0].object.userData.i : -1;
}

function setHover(i) {
  if (i === hover) return;
  hover = i;
  stage.classList.toggle('pointing', i >= 0);
}

hero.addEventListener('pointermove', (e) => {
  const r = hero.getBoundingClientRect();
  pm.tx = (e.clientX - r.left) / W - 0.5; pm.ty = (e.clientY - r.top) / H - 0.5;
});
hero.addEventListener('pointerleave', () => { pm.tx = pm.ty = 0; });

stage.addEventListener('pointermove', (e) => {
  if (drag || e.pointerType !== 'mouse') return;
  const [x, y] = loc(e);
  setHover(pick(x, y));
});
stage.addEventListener('pointerleave', () => { if (!drag) setHover(-1); });

stage.addEventListener('pointerdown', (e) => {
  const [x, y] = loc(e);
  stage.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, c0: c, moved: false, pick: pick(x, y), id: e.pointerId, lx: e.clientX, lt: e.timeStamp, v: 0, turn0: focus >= 0 ? items[focus].tn : 0 };
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
    let target = drag.c0 - dx / chord;
    if (target > cMax) target = cMax + (target - cMax) * 0.3;
    if (target < cMin) target = cMin + (target - cMin) * 0.3;
    cTarget = target;
  }
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  stage.classList.remove('dragging');
  if (focus >= 0) {
    if (d.moved) {
      const n = Math.round((items[focus].tn + d.v * 160) / 180);
      face = Math.abs(n) % 2 ? 'back' : 'front';
      faceTurnTarget = n * 180;
      manualTurn = null;
      syncSeg();
    }
    return;
  }
  if (d.moved) cTarget = snapTo(cTarget - (d.v * 260) / chord);
  else if (d.pick >= 0) open(d.pick);
  if (e.pointerType === 'mouse') { const [x, y] = loc(e); setHover(pick(x, y)); } else setHover(-1);
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// a roda só move o cabideiro quando o mouse está sobre ele; nas pontas e no resto da página, rola a página
hero.addEventListener('wheel', (e) => {
  if (focus >= 0 || e.ctrlKey) return;
  const [x, y] = loc(e);
  if (y < 0 || (y > H * 0.64 && pick(x, y) < 0)) return;
  const dy = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if ((dy > 0 && cTarget >= cMax - 0.01) || (dy < 0 && cTarget <= cMin + 0.01)) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 40 : 1;
  cTarget = clamp(cTarget + (dy * unit) / 120, cMin, cMax);
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => { cTarget = snapTo(cTarget); }, 140);
}, { passive: false });

/* ======================= foco ======================= */
const lock = (on) => html.classList.toggle('locked', on);

function open(i) {
  if (window.scrollY > 2) window.scrollTo({ top: 0, behavior: 'instant' });
  lock(true);
  focus = i;
  size = null;
  setHover(-1);
  face = 'front';
  faceTurnTarget = 0; manualTurn = null;
  cTarget = snapTo(i);
  body.classList.add('is-focus');
  $('#navClose').tabIndex = 0;
  fill();
  placeInfo();
  infoEl.style.opacity = 0;
  setTimeout(() => { infoEl.style.opacity = 1; }, reduce ? 0 : 380);
  history.replaceState(null, '', '#' + P[i].id);
}

const wrapTurn = (it) => {
  it.tn = ((it.tn % 360) + 360) % 360;
  if (it.tn > 180) it.tn -= 360;
};

function close() {
  if (focus < 0) return;
  wrapTurn(items[focus]);
  focus = -1;
  faceTurnTarget = 0; manualTurn = null;
  body.classList.remove('is-focus');
  $('#navClose').tabIndex = -1;
  infoEl.style.opacity = 0;
  lock(false);
  history.replaceState(null, '', location.pathname);
}

function go(dir) {
  if (focus < 0) return;
  const next = (focus + dir + N) % N;
  wrapTurn(items[focus]);
  focus = next;
  size = null;
  face = 'front';
  faceTurnTarget = 0; manualTurn = null;
  cTarget = snapTo(next);
  items[next].vsw = dir * 120;
  items[next].tn = SIDE;
  fill();
  placeInfo();
  history.replaceState(null, '', '#' + P[next].id);
}

function fill() {
  const p = P[focus];
  $('#infoName').textContent = p.name;
  $('#infoPrice').innerHTML = `<b>${brl(p.price)}</b> · em até 3x sem juros`;
  $('#sizes').innerHTML = V.sizes.map((s) => `<button type="button" data-size="${s}" aria-pressed="false">${s}</button>`).join('');
  syncSeg();
  syncCta();
}

function syncSeg() {
  $('#seg').classList.toggle('back', face === 'back');
  $$('#seg button').forEach((b) => b.classList.toggle('lit', b.dataset.face === face));
}
function syncCta() {
  const el = $('#cta');
  el.textContent = size ? `Adicionar à sacola · ${size}` : 'Escolha um tamanho';
  el.classList.toggle('ready', !!size);
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
  $$('#sizes button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
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
$('#srList').innerHTML = P.map((p, i) => `<li><button type="button" data-i="${i}">${p.name} — ${brl(p.price)}</button></li>`).join('');
$('#srList').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) open(+b.dataset.i);
});
$('#srList').addEventListener('focusin', (e) => {
  const b = e.target.closest('button');
  if (b && focus < 0) { setHover(+b.dataset.i); cTarget = snapTo(+b.dataset.i); }
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
  } else if (!e.target.closest('button, a') && window.scrollY < H * 0.5) {
    if (e.key === 'ArrowLeft') cTarget = snapTo(cTarget - 1);
    if (e.key === 'ArrowRight') cTarget = snapTo(cTarget + 1);
  }
});

/* ======================= sacola ======================= */
let thumbR, thumbScene, thumbCam;
const thumbCache = {};
function thumbOf(p) {
  if (thumbCache[p.id]) return thumbCache[p.id];
  if (!thumbR) {
    thumbR = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.setSize(176, 200, false); thumbR.setPixelRatio(1);
    thumbR.outputColorSpace = T.SRGBColorSpace; thumbR.toneMapping = T.ACESFilmicToneMapping; thumbR.toneMappingExposure = 1.08;
    thumbScene = new T.Scene();
    thumbScene.environment = new T.PMREMGenerator(thumbR).fromScene(new T.RoomEnvironment(), 0.04).texture;
    const l = new T.DirectionalLight(0xfff0d8, 1.7); l.position.set(-1, 2, 3); thumbScene.add(l);
    thumbCam = new T.OrthographicCamera(-0.53, 0.53, 0.6, -0.6, 0.1, 10); thumbCam.position.set(0, 0, 4);
  }
  const b = buildItem(p);
  b.mats.forEach((m) => { m.opacity = 1; m.transparent = false; });
  b.tagMat.opacity = 0;
  b.turn.rotation.y = 0.28;
  b.root.position.y = b.total / 2 + 0.01;
  thumbScene.add(b.root);
  thumbR.render(thumbScene, thumbCam);
  thumbScene.remove(b.root);
  const url = thumbR.domElement.toDataURL('image/png');
  thumbCache[p.id] = url;
  return url;
}

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
    const img = MODELS[p.model] ? `<img alt="" src="${thumbOf(p)}">` : '';
    return `<li>
      <div class="bag-thumb">${img}</div>
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

/* ======================= sobre / contato ======================= */
const SHEETS = {
  sobre: `<h2>Sobre</h2>
    <p>A Velchro nasceu de uma ideia simples: roupa boa se escolhe com a mão, no cabide, olhando de perto. Aqui o site é a loja — o cabideiro é o mesmo, só que cabe no seu bolso.</p>
    <p>Cada peça sai em tiragem curta. Quando acaba, acaba.</p>
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
  if (focus < 0) lock(!!name);
}
$$('[data-sheet]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); sheet(a.dataset.sheet); }));
$('#sheetClose').addEventListener('click', () => sheet(null));

/* ======================= página: parallax, revelar e texto que acende ======================= */
$('#ticker').innerHTML = V.ticker.map((t) => `<span>${t}</span>`).join('').repeat(8);
$('#band').innerHTML = Array(2).fill(['Velchro', 'Feito pra quem fica', 'Velchro', 'Escolha com a mão'].map((t) => `<span>${t}</span>`).join('')).join('');

const scrub = $('#scrub');
const words = scrub.textContent.trim().split(/\s+/);
scrub.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
const wordEls = $$('.w', scrub);

const io = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}, { threshold: 0.18 });
$$('.reveal').forEach((el, k) => { el.style.setProperty('--d', (k % 3) * 110); io.observe(el); });

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const sy = window.scrollY;
    if (sy < H * 1.2) {
      stage.style.transform = `translate3d(0,${(sy * 0.22).toFixed(1)}px,0)`;
      copy.style.transform = `translate3d(0,${(sy * 0.42).toFixed(1)}px,0)`;
      copy.style.setProperty('--co', clamp(1 - sy / (H * 0.55), 0, 1).toFixed(3));
    }
    const r = scrub.getBoundingClientRect();
    const p = clamp((innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.25), 0, 1);
    const lit = Math.round(p * wordEls.length);
    wordEls.forEach((w, k) => w.classList.toggle('lit', k < lit));
  });
}
addEventListener('scroll', onScroll, { passive: true });

/* ---------- poeira na luz ---------- */
const cv = $('#dust');
const ctx = cv.getContext('2d');
const motes = Array.from({ length: 48 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, s: 0.004 + Math.random() * 0.012, p: Math.random() * 6.28 }));
function sizeDust() {
  const d = Math.min(2, devicePixelRatio || 1);
  cv.width = W * d; cv.height = H * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
}
function drawDust(now) {
  requestAnimationFrame(drawDust);
  if (reduce || window.scrollY >= H) return;
  ctx.clearRect(0, 0, W, H);
  const lx = ((50 + pm.x * 24) / 100) * W, ly = ((14 + pm.y * 10) / 100) * H;
  for (const m of motes) {
    m.y += m.s * 0.016; m.x += Math.sin(now / 2400 + m.p) * 0.0004;
    if (m.y > 1) m.y = -0.02;
    const px = m.x * W, py = m.y * H;
    const d = Math.hypot((px - lx) / (W * 0.5), (py - ly) / (H * 0.7));
    const a = clamp(1 - d, 0, 1) * (0.35 + 0.35 * Math.sin(now / 900 + m.p)) * 0.5;
    if (a < 0.01) continue;
    ctx.fillStyle = `rgba(70,58,34,${a.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(px, py, m.r, 0, 6.283); ctx.fill();
  }
}

/* ======================= início ======================= */
addEventListener('resize', () => { layout(); });
layout();
c = cTarget = cMin; // começa com as 10 primeiras peças à vista
window.scrollTo(0, 0);
setTimeout(() => copy.classList.add('in'), reduce ? 0 : 500);
onScroll();
requestAnimationFrame(drawDust);
if (document.fonts) document.fonts.ready.then(layout);

await loadModels();
makeItems();
renderBag();
const start = P.findIndex((p) => '#' + p.id === location.hash);
if (start >= 0) {
  items.forEach((it) => { it.born = true; });
  open(start);
}
last = performance.now();
requestAnimationFrame(frame);
document.body.classList.add('ready');

window.__velchro = { open, close, go, get items() { return items; }, get focus() { return focus; }, get c() { return c; }, camera, renderer, scene };
