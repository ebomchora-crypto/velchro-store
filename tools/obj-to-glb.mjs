import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';

const [,, objPath, outPath, baseTex, normTex, targetTris = '30000'] = process.argv;
await MeshoptSimplifier.ready;

// --- parse OBJ (triângulos/polígonos -> triângulos) ---
const txt = fs.readFileSync(objPath, 'utf8');
const V = [], VT = [], VN = [];
const map = new Map();
const pos = [], uv = [], nrm = [], idx = [];
const key = (a, b, c) => `${a}/${b}/${c}`;
function vert(tok) {
  let [a, b, c] = tok.split('/');
  a = +a; b = b ? +b : 0; c = c ? +c : 0;
  if (a < 0) a = V.length / 3 + 1 + a;
  if (b < 0) b = VT.length / 2 + 1 + b;
  if (c < 0) c = VN.length / 3 + 1 + c;
  const k = key(a, b, c);
  let i = map.get(k);
  if (i === undefined) {
    i = pos.length / 3; map.set(k, i);
    pos.push(V[(a - 1) * 3], V[(a - 1) * 3 + 1], V[(a - 1) * 3 + 2]);
    if (b) uv.push(VT[(b - 1) * 2], VT[(b - 1) * 2 + 1]); else uv.push(0, 0);
    if (c) nrm.push(VN[(c - 1) * 3], VN[(c - 1) * 3 + 1], VN[(c - 1) * 3 + 2]); else nrm.push(0, 1, 0);
  }
  return i;
}
for (const line of txt.split('\n')) {
  const t = line.split(/\s+/);
  if (t[0] === 'v') V.push(+t[1], +t[2], +t[3]);
  else if (t[0] === 'vt') VT.push(+t[1], +t[2]);
  else if (t[0] === 'vn') VN.push(+t[1], +t[2], +t[3]);
  else if (t[0] === 'f') {
    const f = t.slice(1).filter(Boolean).map(vert);
    for (let k = 1; k < f.length - 1; k++) idx.push(f[0], f[k], f[k + 1]);
  }
}
console.log('parsed', pos.length / 3, 'verts', idx.length / 3, 'tris');

// --- simplificar preservando UV e normais ---
const P = new Float32Array(pos), UV = new Float32Array(uv), N = new Float32Array(nrm);
const attrs = new Float32Array((P.length / 3) * 5);
for (let i = 0; i < P.length / 3; i++) {
  attrs[i * 5] = UV[i * 2]; attrs[i * 5 + 1] = UV[i * 2 + 1];
  attrs[i * 5 + 2] = N[i * 3]; attrs[i * 5 + 3] = N[i * 3 + 1]; attrs[i * 5 + 4] = N[i * 3 + 2];
}
const [simp, err] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(idx), P, 3, attrs, 5, [4, 4, 0.6, 0.6, 0.6], null, +targetTris * 3, 1, []);
console.log('simplified ->', simp.length / 3, 'tris, error', err);

// --- compactar vértices ---
const remap = new Map(); const op = [], ou = [], on = [], oi = new Uint32Array(simp.length);
for (let i = 0; i < simp.length; i++) {
  const v = simp[i]; let r = remap.get(v);
  if (r === undefined) { r = op.length / 3; remap.set(v, r); op.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); ou.push(UV[v * 2], UV[v * 2 + 1]); on.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); }
  oi[i] = r;
}
console.log('verts', op.length / 3);

// --- montar glTF ---
const doc = new Document();
const buf = doc.createBuffer();
const acc = (arr, type, target) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buf);
const prim = doc.createPrimitive()
  .setAttribute('POSITION', acc(new Float32Array(op), 'VEC3'))
  .setAttribute('NORMAL', acc(new Float32Array(on), 'VEC3'))
  .setAttribute('TEXCOORD_0', acc(new Float32Array(ou), 'VEC2'))
  .setIndices(acc(oi.length < 65536 * 3 && op.length / 3 < 65536 ? new Uint16Array(oi) : oi, 'SCALAR'));
const dir = path.dirname(objPath);
const tex = async (f, q) => doc.createTexture().setImage(new Uint8Array(await sharp(path.join(dir, f)).resize(1024, 1024, { fit: 'fill' }).jpeg({ quality: q }).toBuffer())).setMimeType('image/jpeg');
const mat = doc.createMaterial('cloth').setBaseColorTexture(await tex(baseTex, 84)).setNormalTexture(await tex(normTex, 88)).setRoughnessFactor(0.85).setMetallicFactor(0);
prim.setMaterial(mat);
const mesh = doc.createMesh('garment').addPrimitive(prim);
const node = doc.createNode('garment').setMesh(mesh);
doc.createScene().addChild(node);
await new NodeIO().write(outPath, doc);
console.log('wrote', outPath, (fs.statSync(outPath).size / 1e6).toFixed(2), 'MB');
