// Not All Slop — 2D cards in a 3D toy town (three.js in HyperFrames). Engine adapted from the
// animated-shorts eiffel-tower template (ink, lens blur, grade, light presets, cards).
import * as THREE from './three.module.js';
import { T } from './timing.js';

const W = 1080, H = 1920, FPS = 30, END = T.end;  // video length comes from the voice (timing.js)

// ---------- helpers ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = u => u * u * u * (u * (u * 6 - 15) + 10);
const lerp = (a, b, u) => a + (b - a) * u;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t0, t1, t) => smoother(clamp((t - t0) / (t1 - t0)));

// ---------- renderer & targets ----------
const canvas = document.getElementById('three-layer');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
const colorRT = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const normalRT = new THREE.WebGLRenderTarget(W, H, { depthTexture: new THREE.DepthTexture(W, H) });
normalRT.depthTexture.type = THREE.UnsignedIntType;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 900);
camera.layers.enable(1);

// ---------- canvas texture helpers ----------
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rx = 1, ry = 1) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; }
function shade(hex, f) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, f); return '#' + c.getHexString(); }
const PLUM = '#241726';
const FONT = '"Arial Black", "Archivo Black", Impact, sans-serif';
function txt(x, s, px, py, size, fill, stroke = PLUM, lw = 0, align = 'center') {
  x.font = `900 ${size}px ${FONT}`; x.textAlign = align; x.textBaseline = 'middle';
  if (lw) { x.lineJoin = 'round'; x.lineWidth = lw; x.strokeStyle = stroke; x.strokeText(s, px, py); }
  x.fillStyle = fill; x.fillText(s, px, py);
}

function grassTex(seed) {
  const c = cv(512, 512), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#62ad44'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? '#6fbd4d' : '#58a03c'; x.beginPath(); x.ellipse(r() * 512, r() * 512, 6 + r() * 14, 3 + r() * 6, r() * 3, 0, 7); x.fill(); }
  return c;
}
function tileTex(seed, base = '#d9cdb2', w = 512) {
  const c = cv(w, w), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#4a3c3a'; x.fillRect(0, 0, w, w);
  const n = 8, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    x.fillStyle = shade(base, (r() - 0.5) * 0.10); x.beginPath(); x.roundRect(i * s + 3, j * s + 3, s - 6, s - 6, 8); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(i * s + 9, j * s + 8, s * 0.45, 4);
  }
  return c;
}
function woodTex(base = '#c08a52') {
  const c = cv(256, 256), x = c.getContext('2d'), r = rng(4);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) { x.fillStyle = '#3a2416'; x.fillRect(0, i * 32, 256, 3); for (let k = 0; k < 5; k++) { x.strokeStyle = 'rgba(70,40,20,0.35)'; x.lineWidth = 2; x.beginPath(); const y = i * 32 + 6 + r() * 22; x.moveTo(0, y); x.bezierCurveTo(80, y + 4, 170, y - 4, 256, y); x.stroke(); } }
  return c;
}
function rockTex() {
  const c = cv(256, 256), x = c.getContext('2d'), r = rng(12);
  x.fillStyle = '#9a7656'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { x.fillStyle = r() < 0.5 ? '#8a6748' : '#ad8664'; x.beginPath(); x.ellipse(r() * 256, r() * 256, 8 + r() * 20, 5 + r() * 10, r() * 3, 0, 7); x.fill(); }
  x.strokeStyle = '#4a3428'; x.lineWidth = 3; for (let i = 0; i < 14; i++) { x.beginPath(); const px = r() * 256, py = r() * 256; x.moveTo(px, py); x.lineTo(px + 20 - r() * 40, py + 24); x.stroke(); }
  return c;
}
const WALLS = ['#f26d5b', '#ffc94a', '#5ab4ec', '#7ccc6a', '#b58ae6', '#ff9f43', '#f7f1e3'];
function facadeTex(seed, wall, lit) {
  const c = cv(512, 512), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = lit ? '#000' : wall; x.fillRect(0, 0, 512, 512);
  if (!lit) { x.strokeStyle = 'rgba(40,25,30,0.18)'; x.lineWidth = 3; for (let k = 1; k < 8; k++) { x.beginPath(); x.moveTo(0, k * 64); x.lineTo(512, k * 64); x.stroke(); } }
  for (let f = 0; f < 2; f++) for (let k = 0; k < 2; k++) {
    const wx = 70 + k * 250, wy = 60 + f * 220, ww = 130, wh = 130; const on = r() < 0.6;
    if (f === 1 && k === 0) { // door
      if (!lit) { x.fillStyle = '#7a4a2e'; x.beginPath(); x.roundRect(wx + 10, wy + 30, 110, 190, [50, 50, 0, 0]); x.fill(); x.strokeStyle = PLUM; x.lineWidth = 6; x.stroke(); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(wx + 100, wy + 130, 8, 0, 7); x.fill(); }
      continue;
    }
    if (!lit) {
      x.fillStyle = '#2b3d5c'; x.fillRect(wx, wy, ww, wh); x.fillStyle = 'rgba(170,210,255,0.45)'; x.fillRect(wx + 10, wy + 10, ww / 2 - 14, wh * 0.45);
      x.strokeStyle = '#fffaf0'; x.lineWidth = 10; x.strokeRect(wx, wy, ww, wh); x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.moveTo(wx, wy + wh / 2); x.lineTo(wx + ww, wy + wh / 2); x.stroke();
      x.fillStyle = shade(wall, -0.15); x.fillRect(wx - 12, wy + wh, ww + 24, 14);
    } else if (on) { x.fillStyle = '#ffd27c'; x.fillRect(wx, wy, ww, wh); }
  }
  return c;
}

// ---------- game-box covers ----------
const COV = {};
function cover(name, draw) { const c = cv(256, 320), x = c.getContext('2d'); draw(x, 256, 320); x.strokeStyle = PLUM; x.lineWidth = 12; x.strokeRect(6, 6, 244, 308); COV[name] = c; return c; }
function burst(x, cx, cy, r, fill, label, size = 30) { x.fillStyle = fill; x.strokeStyle = PLUM; x.lineWidth = 5; x.beginPath(); for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, rr = i % 2 ? r * 0.72 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); x.stroke(); txt(x, label, cx, cy + 2, size, '#fff', PLUM, 6); }
cover('slop0', (x) => { x.fillStyle = '#ffd23f'; x.fillRect(0, 0, 256, 320); x.fillStyle = '#ffb627'; x.beginPath(); x.arc(128, 175, 70, 0, 7); x.fill(); x.strokeStyle = PLUM; x.lineWidth = 8; x.stroke(); txt(x, '$', 128, 178, 90, '#fff6c8', PLUM, 10); txt(x, 'CLICK', 128, 58, 50, '#ff4d6d', PLUM, 10); txt(x, 'SIM', 128, 270, 50, '#ff4d6d', PLUM, 10); burst(x, 205, 115, 34, '#3ad06a', 'NEW', 20); });
cover('slop1', (x) => { x.fillStyle = '#ff7ac8'; x.fillRect(0, 0, 256, 320); x.fillStyle = '#7d4cff'; for (let i = 0; i < 5; i++) { x.fillRect(30 + i * 40, 250 - i * 30, 40, 30 + i * 30); x.strokeStyle = PLUM; x.lineWidth = 5; x.strokeRect(30 + i * 40, 250 - i * 30, 40, 30 + i * 30); } txt(x, 'OBBY', 128, 56, 56, '#fff', PLUM, 10); txt(x, '999', 128, 112, 40, '#ffe14d', PLUM, 8); burst(x, 200, 160, 30, '#ff3b3b', 'AI', 22); });
cover('slop2', (x) => { x.fillStyle = '#4dd38a'; x.fillRect(0, 0, 256, 320); x.fillStyle = '#fff'; x.beginPath(); x.roundRect(60, 120, 136, 110, 14); x.fill(); x.strokeStyle = PLUM; x.lineWidth = 7; x.stroke(); x.fillStyle = '#2f7de1'; x.fillRect(80, 140, 96, 70); txt(x, 'TYCOON', 128, 58, 44, '#fff', PLUM, 9); txt(x, '2', 128, 272, 60, '#ffe14d', PLUM, 10); burst(x, 52, 230, 28, '#ff8a00', '!!', 22); });
for (let n = 1; n <= 9; n++) cover('clk' + n, (x) => { x.fillStyle = ['#ffd23f', '#ff9f43', '#5ab4ec', '#ff7ac8', '#7ccc6a', '#b58ae6', '#ffd23f', '#ff6b5a', '#5ad1c4'][n - 1]; x.fillRect(0, 0, 256, 320); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(100, 120); x.lineTo(100, 230); x.lineTo(126, 205); x.lineTo(146, 250); x.lineTo(162, 242); x.lineTo(142, 198); x.lineTo(178, 196); x.closePath(); x.fill(); x.strokeStyle = PLUM; x.lineWidth = 7; x.stroke(); txt(x, 'CLICKER', 128, 60, 40, '#fff', PLUM, 9); if (n > 1) txt(x, String(n), 196, 268, 64, '#ffe14d', PLUM, 10); });
cover('cs', (x) => { x.fillStyle = '#e8873a'; x.fillRect(0, 0, 256, 320); x.fillStyle = '#3a2a24'; x.fillRect(0, 200, 256, 120); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(128, 150, 60, 0, 7); x.moveTo(128, 70); x.lineTo(128, 230); x.moveTo(48, 150); x.lineTo(208, 150); x.stroke(); x.fillStyle = '#ff3b3b'; x.beginPath(); x.arc(128, 150, 10, 0, 7); x.fill(); txt(x, 'SHOOTER', 128, 274, 40, '#fff', PLUM, 8); });
cover('peak', (x) => { const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, '#6ec3ff'); g.addColorStop(1, '#d8f0ff'); x.fillStyle = g; x.fillRect(0, 0, 256, 320); x.fillStyle = '#5a6b86'; x.beginPath(); x.moveTo(10, 300); x.lineTo(128, 90); x.lineTo(246, 300); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(128, 90); x.lineTo(92, 154); x.lineTo(112, 146); x.lineTo(128, 162); x.lineTo(146, 144); x.lineTo(164, 154); x.closePath(); x.fill(); x.strokeStyle = PLUM; x.lineWidth = 6; x.beginPath(); x.moveTo(10, 300); x.lineTo(128, 90); x.lineTo(246, 300); x.stroke(); txt(x, 'PEAK', 128, 50, 62, '#ffef5a', PLUM, 10); });
cover('cliff', (x) => { x.drawImage(COV.peak, 0, 0); x.fillStyle = COV.peak ? '#8fd0ff' : '#8fd0ff'; x.fillRect(14, 14, 228, 74); txt(x, 'CLIFF', 128, 50, 62, '#ffef5a', PLUM, 10); });
cover('td', (x) => { const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, '#7b3fe4'); g.addColorStop(1, '#3a1c86'); x.fillStyle = g; x.fillRect(0, 0, 256, 320); x.strokeStyle = '#ffd23f'; x.lineWidth = 10; x.strokeRect(20, 20, 216, 280); drawBanana(x, 80, 200, 0.9); drawBomb(x, 178, 196, 0.8); txt(x, 'TROLL', 128, 62, 50, '#ffd23f', PLUM, 10); txt(x, 'DUELS', 128, 114, 50, '#fff', PLUM, 10); });
function drawBanana(x, cx, cy, s) { x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = '#ffe14d'; x.strokeStyle = PLUM; x.lineWidth = 7; x.beginPath(); x.moveTo(-50, -30); x.quadraticCurveTo(-30, 40, 50, 30); x.quadraticCurveTo(-10, 20, -36, -36); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#6b4a2a'; x.fillRect(-56, -42, 14, 14); x.restore(); }
function drawBomb(x, cx, cy, s) { x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = '#2b2d42'; x.strokeStyle = PLUM; x.lineWidth = 7; x.beginPath(); x.arc(0, 10, 44, 0, 7); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.arc(-14, -4, 12, 0, 7); x.fill(); x.fillStyle = '#6b6f80'; x.fillRect(-12, -44, 24, 16); x.strokeStyle = '#8a5a3a'; x.lineWidth = 6; x.beginPath(); x.moveTo(0, -44); x.quadraticCurveTo(20, -70, 36, -60); x.stroke(); x.fillStyle = '#ffb627'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, rr = i % 2 ? 8 : 18; x.lineTo(38 + Math.cos(a) * rr, -62 + Math.sin(a) * rr); } x.fill(); x.restore(); }

function star0(x, cx, cy, r1, r2, n, fill, lw = 10) { x.fillStyle = fill; x.strokeStyle = PLUM; x.lineWidth = lw; x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? r2 : r1; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); }
// ---------- materials ----------
const mats = {};
const lam = (o) => new THREE.MeshLambertMaterial(o);
mats.grass = lam({ map: tex(grassTex(2), 160, 160) });
mats.tile = lam({ map: tex(tileTex(5), 14, 10) });
mats.path = lam({ map: tex(tileTex(8, '#e6d3a8'), 2, 12) });
mats.wood = lam({ map: tex(woodTex(), 2, 2) });
mats.rock = lam({ map: tex(rockTex(), 4, 2), flatShading: true });
mats.ink = lam({ color: 0x2a2a30 });
mats.dark = lam({ color: 0x2b2d42 });
mats.grey = lam({ color: 0xd8dde6 });
mats.grey2 = lam({ color: 0xa8b0bf });
mats.metal = lam({ color: 0x8c96a8 });
mats.trunk = lam({ color: 0x7a5233 });
mats.leaf = lam({ color: 0x4fae4a, flatShading: true });
mats.leaf2 = lam({ color: 0x6cc455, flatShading: true });
mats.red = lam({ color: 0xe5484d });
mats.blue = lam({ color: 0x3a7bd5 });
mats.yellow = lam({ color: 0xffd23f });
mats.teal = lam({ color: 0x2fa39a });
mats.cardboard = lam({ color: 0xd7a868 });
mats.green = lam({ color: 0x2f6a4a });
mats.lamp = lam({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 0 });
const nightEmissive = [];

// ---------- registry ----------
const worldMeshes = [];
function add(mesh, parent = scene) { mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); worldMeshes.push(mesh); return mesh; }
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return add(m, parent); }
function cyl(rt, rb, h, mat, x, y, z, seg = 16, parent) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return add(m, parent); }
function plane(w, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; scene.add(m); worldMeshes.push(m); return m; }
function boxMats(name) { const f = lam({ map: tex(COV[name]) }); return [mats.cardboard, mats.cardboard, mats.cardboard, mats.cardboard, f, f]; }
const BOXG = new THREE.BoxGeometry(0.8, 1.0, 0.24);
function gameBox(name, parent = scene) { const m = new THREE.Mesh(BOXG, boxMats(name)); return add(m, parent); }

// ---------- ground & town ----------
plane(2400, 2400, mats.grass, 0, -0.02, 0);
box(44, 0.12, 34, mats.tile, 0, 0.06, -1); // plaza
plane(3, 60, mats.path, 0, 0.015, 40);
function house(x, z, w, d, h, wi, rotY, seed) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  const wall = WALLS[wi % WALLS.length];
  const lit = tex(facadeTex(seed, wall, true)); const face = lam({ map: tex(facadeTex(seed, wall, false)), emissiveMap: lit, emissive: 0xffffff, emissiveIntensity: 0 }); nightEmissive.push(face);
  const side = lam({ color: wall });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, face, side]); m.position.set(0, h / 2, 0); add(m, g);
  const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.5, 0); sh.lineTo(w / 2 + 0.5, 0); sh.lineTo(0, h * 0.55); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: d + 0.8, bevelEnabled: false }); rg.translate(0, 0, -d / 2 - 0.4);
  const roof = new THREE.Mesh(rg, lam({ color: ['#c0392b', '#3b5b9c', '#2f6a4a', '#7a3fa0', '#d35400'][seed % 5] })); roof.position.y = h; add(roof, g);
  box(0.9, 1.6, 0.9, lam({ color: 0xb06a4e }), w * 0.25, h + h * 0.4, 0, g);
}
{ let s = 1; for (let z = -66; z <= 26; z += 11) { house(-31, z, 9, 8, 7 + (s % 3) * 1.5, s, Math.PI / 2, s++); house(31, z, 9, 8, 7 + (s % 3) * 1.5, s, -Math.PI / 2, s++); }
  for (let x = -24; x <= 24; x += 11) house(x, -82, 9, 8, 8 + (s % 3) * 2, s, 0, s++);
  for (let x = -40; x <= 40; x += 12) { if (Math.abs(x) < 6) continue; house(x, 44, 9, 8, 7, s, Math.PI, s++); } }
function tree(x, z, s = 1, seed = 1) {
  const r = rng(seed); cyl(0.18 * s, 0.26 * s, 3.0 * s, mats.trunk, x, 1.5 * s, z, 7);
  for (let i = 0; i < 3; i++) { const g = new THREE.Mesh(new THREE.IcosahedronGeometry((1.3 + r() * 0.6) * s, 1), i % 2 ? mats.leaf : mats.leaf2); g.position.set(x + (r() - 0.5) * 1.2 * s, (3.4 + r() * 1.0) * s, z + (r() - 0.5) * 1.2 * s); add(g); }
}
{ const r = rng(44); for (let i = 0; i < 46; i++) { const x = (r() < 0.5 ? -1 : 1) * (23 + r() * 4); const z = -60 + r() * 84; tree(x, z, 1 + r() * 0.3, 900 + i); }
  for (let i = 0; i < 40; i++) { const x = -60 + r() * 120; const z = -100 - r() * 60; tree(x, z, 1.4, 2000 + i); } }
// lamps
const lampLights = [];
function lampPost(x, z) { cyl(0.09, 0.13, 4.0, mats.green, x, 2.0, z, 8); box(0.42, 0.55, 0.42, mats.green, x, 4.2, z); box(0.32, 0.4, 0.32, mats.lamp, x, 4.2, z); }
for (const [x, z] of [[-7, 9], [7, 9], [-7, -3], [7, -3]]) { lampPost(x, z); const l = new THREE.PointLight(0xffc77a, 0, 16, 1.5); l.position.set(x, 4.0, z + 0.3); scene.add(l); lampLights.push(l); }

// ---------- slop mountain + filter ----------
const MT = V(0, 0, -34), MR = 11.5, MH = 8.5;
const mtH = r => MH * Math.pow(Math.max(0, 1 - r / MR), 1.15);
{
  const r = rng(77); const N = 520; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  const meshes = ['slop0', 'slop1', 'slop2'].map(n => new THREE.InstancedMesh(BOXG, boxMats(n), N));
  const counts = [0, 0, 0];
  for (let i = 0; i < N * 3; i++) {
    const k = i % 3; const a = r() * Math.PI * 2, rr = MR * Math.sqrt(r()) * 0.98; const y = Math.max(0.3, mtH(rr) - r() * 0.9);
    e.set((r() - 0.5) * 2.6, r() * 6.3, (r() - 0.5) * 2.6); q.setFromEuler(e); const s = 1.15 + r() * 0.35;
    m4.compose(V(MT.x + Math.cos(a) * rr, y, MT.z + Math.sin(a) * rr), q, V(s, s, s)); meshes[k].setMatrixAt(counts[k], m4);
    col.setHSL(0, 0, 0.9 + r() * 0.1); meshes[k].setColorAt(counts[k]++, col);
  }
  meshes.forEach(m => add(m));
}
const BIN = V(10, 0, -27.5);
{
  cyl(2.3, 2.0, 3.4, mats.grey2, BIN.x, 1.7, BIN.z, 24);
  const lc = cv(512, 160), lx = lc.getContext('2d'); lx.fillStyle = '#e5484d'; lx.fillRect(0, 0, 512, 160); txt(lx, 'HIDDEN', 256, 84, 96, '#fff', PLUM, 14);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.95), lam({ map: tex(lc) })); lab.position.set(BIN.x - 0.9, 1.9, BIN.z + 2.05); lab.rotation.y = -0.4; add(lab);
  const prof = [new THREE.Vector2(0.75, 0), new THREE.Vector2(0.75, 1.4), new THREE.Vector2(4.2, 4.6), new THREE.Vector2(4.4, 4.75)];
  const fun = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), lam({ color: 0xffd23f, side: THREE.DoubleSide })); fun.position.set(BIN.x, 3.4, BIN.z); add(fun);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.16, 8, 48), mats.red); ring.rotation.x = Math.PI / 2; ring.position.set(BIN.x, 8.15, BIN.z); add(ring);
  for (const a of [0.6, 2.6, 4.6]) cyl(0.12, 0.12, 8.2, mats.metal, BIN.x + Math.cos(a) * 4.4, 4.1, BIN.z + Math.sin(a) * 4.4, 8);
  const fc = cv(512, 128), fx = fc.getContext('2d'); fx.fillStyle = '#2b2d42'; fx.fillRect(0, 0, 512, 128); txt(fx, 'SLOP FILTER', 256, 66, 64, '#ffd23f', PLUM, 0);
  const fs = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), lam({ map: tex(fc) })); fs.position.set(BIN.x - 1.3, 9.2, BIN.z + 2.4); fs.rotation.y = -0.45; add(fs);
  // lever box
  box(0.8, 1.2, 0.6, mats.red, BIN.x + 2.9, 0.6, BIN.z + 2.6); cyl(0.06, 0.06, 1.2, mats.ink, BIN.x + 2.9, 1.6, BIN.z + 2.6, 6).rotation.z = -0.5;
}

// ---------- giant phone (Build) ----------
const PH = V(-12, 0, -6);
const phoneC = cv(512, 1024), phoneX = phoneC.getContext('2d');
const phoneTex = tex(phoneC);
let phoneKey = '';
function drawPhone(typed, stage, cursor) {
  const key = typed + '|' + stage + '|' + cursor; if (key === phoneKey) return; phoneKey = key;
  const x = phoneX; const g = x.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, '#f4f0ff'); g.addColorStop(1, '#e2f4ff'); x.fillStyle = g; x.fillRect(0, 0, 512, 1024);
  x.fillStyle = '#3b2a6b'; x.fillRect(0, 0, 512, 130); txt(x, 'BUILD', 256, 72, 64, '#fff', PLUM, 0);
  x.fillStyle = '#ffd23f'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 9 : 24; x.lineTo(110 + Math.cos(a) * r, 70 + Math.sin(a) * r); } x.fill();
  const msg = 'make me a game'.slice(0, typed) + (cursor ? '|' : '');
  if (typed > 0 || cursor) { x.fillStyle = '#2fa39a'; x.beginPath(); x.roundRect(70, 190, 412, 120, 36); x.fill(); x.font = `900 36px ${FONT}`; x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(msg, 100, 252); }
  if (stage >= 1) { x.fillStyle = '#ffffff'; x.strokeStyle = '#c9c2e8'; x.lineWidth = 4; x.beginPath(); x.roundRect(32, 350, 400, stage >= 2 ? 470 : 110, 36); x.fill(); x.stroke();
    x.font = `900 40px ${FONT}`; x.fillStyle = '#3b2a6b'; x.textAlign = 'left'; x.fillText(stage >= 2 ? 'Done!' : 'Making it...', 64, 406); }
  if (stage >= 2) { x.drawImage(COV.slop0, 96, 450, 200, 250); x.fillStyle = '#3ad06a'; x.beginPath(); x.roundRect(64, 720, 336, 84, 42); x.fill(); x.strokeStyle = PLUM; x.lineWidth = 6; x.stroke(); txt(x, 'PLAY ▶', 232, 764, 46, '#fff', PLUM, 0); }
  x.fillStyle = '#ffffff'; x.strokeStyle = '#c9c2e8'; x.lineWidth = 4; x.beginPath(); x.roundRect(30, 900, 452, 84, 42); x.fill(); x.stroke();
  phoneTex.needsUpdate = true;
}
drawPhone(0, 0, false);
{
  box(4.2, 0.5, 1.6, mats.grey2, PH.x, 0.25, PH.z);
  box(3.6, 7.0, 0.6, mats.dark, PH.x, 4.0, PH.z);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 6.2), lam({ map: phoneTex, emissiveMap: phoneTex, emissive: 0xffffff, emissiveIntensity: 0.55 })); scr.position.set(PH.x, 4.0, PH.z + 0.31); add(scr);
  box(1.6, 0.25, 0.3, mats.ink, PH.x, 0.95, PH.z + 0.75); // output slot
}
// conveyor from phone to the mountain
const CV_A = V(-9.6, 0, -7.4), CV_B = V(-5.0, 0, -25.0);
{
  const d = CV_B.clone().sub(CV_A), len = d.length(), ang = Math.atan2(d.x, d.z), mid = CV_A.clone().add(CV_B).multiplyScalar(0.5);
  const bc = cv(128, 512), bx = bc.getContext('2d'); bx.fillStyle = '#3a3d4a'; bx.fillRect(0, 0, 128, 512); bx.fillStyle = '#555a6a'; for (let i = 0; i < 16; i++) bx.fillRect(0, i * 32, 128, 14);
  const belt = box(1.7, 0.2, len, lam({ map: tex(bc, 1, len / 2) }), mid.x, 1.0, mid.z); belt.rotation.y = ang;
  for (const s of [-1, 1]) { const rail = box(0.12, 0.3, len, mats.yellow, mid.x + Math.cos(ang) * 0.9 * s, 1.15, mid.z - Math.sin(ang) * 0.9 * s); rail.rotation.y = ang; }
  for (let i = 0; i <= 6; i++) { const p = CV_A.clone().lerp(CV_B, i / 6); box(0.2, 0.9, 0.2, mats.metal, p.x, 0.45, p.z); }
}
const clickBoxes = []; for (let n = 1; n <= 9; n++) clickBoxes.push(gameBox('clk' + n));
// help poster
{
  const c = cv(512, 680), x = c.getContext('2d'); x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 512, 680); x.fillStyle = '#2f7de1'; x.fillRect(0, 0, 512, 120); txt(x, 'HELP', 256, 64, 72, '#fff', PLUM, 0);
  x.fillStyle = '#ffe14d'; x.beginPath(); x.arc(256, 220, 62, 0, 7); x.fill(); x.strokeStyle = PLUM; x.lineWidth = 8; x.stroke(); x.fillStyle = '#9aa3ad'; x.fillRect(226, 280, 60, 40); x.strokeRect(226, 280, 60, 40);
  txt(x, 'Simple games', 256, 390, 46, '#2b2d42', PLUM, 0); txt(x, 'like CLICKERS', 256, 460, 50, '#e5484d', PLUM, 0); txt(x, 'turn out best', 256, 530, 46, '#2b2d42', PLUM, 0);
  x.strokeStyle = PLUM; x.lineWidth = 14; x.strokeRect(7, 7, 498, 666);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.0), lam({ map: tex(c) })); p.position.set(-4.6, 3.1, -13.6); p.rotation.y = 0.55; add(p);
  const back = box(3.2, 4.2, 0.12, mats.wood, -4.66, 3.1, -13.7); back.rotation.y = 0.55;
  for (const s of [-1, 1]) cyl(0.08, 0.08, 1.2, mats.wood, -4.66 + Math.cos(0.55) * 1.3 * s, 0.6, -13.7 - Math.sin(0.55) * 1.3 * s, 6);
}

// ---------- copier + PEAK corner ----------
const CP = V(12, 0, -6.5);
{
  box(3.2, 1.7, 2.2, mats.grey, CP.x, 0.85, CP.z); box(3.3, 0.25, 2.3, mats.grey2, CP.x, 1.82, CP.z);
  box(1.0, 0.12, 1.5, mats.grey2, CP.x - 2.0, 1.1, CP.z).rotation.z = 0.2;
  const pc = cv(256, 96), px = pc.getContext('2d'); px.fillStyle = '#2b2d42'; px.fillRect(0, 0, 256, 96); px.fillStyle = '#3ad06a'; px.beginPath(); px.arc(40, 48, 18, 0, 7); px.fill(); px.fillStyle = '#ff4d6d'; px.beginPath(); px.arc(90, 48, 18, 0, 7); px.fill(); txt(px, 'COPY', 180, 50, 40, '#ffd23f', PLUM, 0);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), lam({ map: tex(pc), emissiveMap: tex(pc), emissive: 0xffffff, emissiveIntensity: 0.4 })); panel.position.set(CP.x + 0.6, 1.4, CP.z + 1.11); add(panel);
  cyl(0.4, 0.5, 1.0, mats.wood, CP.x + 2.3, 0.5, CP.z + 2.6, 12); // pedestal for the original
}
const origBox = gameBox('cs'); origBox.position.set(CP.x + 2.3, 1.55, CP.z + 2.6);
const copyPile = []; { const r = rng(5); for (let i = 0; i < 14; i++) { const b = gameBox('cs'); b.position.set(CP.x - 2.6 - r() * 1.6, 0.4 + Math.floor(i / 5) * 0.25, CP.z + 0.4 + r() * 1.9); b.rotation.set(-Math.PI / 2 + (r() - 0.5) * 0.4, r() * 6, 0); b.visible = false; copyPile.push(b); } }
const flyCopy = gameBox('cs');
const cliffBox = gameBox('cliff'); cliffBox.position.set(15.3, 0.12, -1.8); cliffBox.rotation.set(-Math.PI / 2 + 0.25, 0, 0.3);

// ---------- TOP 100 billboard ----------
const BB = V(0, 0, -60);
const bbC = cv(1024, 800), bbX = bbC.getContext('2d'); const bbTex = tex(bbC); let bbKey = -1;
function drawBoard(n) {
  if (n === bbKey) return; bbKey = n; const x = bbX;
  x.fillStyle = '#1d1a33'; x.fillRect(0, 0, 1024, 800); txt(x, 'TOP 100 GAMES', 512, 70, 80, '#ffd23f', PLUM, 0);
  for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) { const k = j * 10 + i; const on = k < n; x.fillStyle = on ? '#2fd1b4' : '#3a3658'; x.beginPath(); x.roundRect(52 + i * 92, 140 + j * 64, 80, 54, 10); x.fill(); if (on) txt(x, 'AI', 92 + i * 92, 168 + j * 64, 30, '#14302c', PLUM, 0); }
  bbTex.needsUpdate = true;
}
drawBoard(0);
{
  for (const s of [-1, 1]) box(0.8, 10, 0.8, mats.metal, BB.x + s * 7, 5, BB.z);
  box(19, 15.4, 0.8, mats.dark, BB.x, 17, BB.z - 0.1);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), lam({ map: bbTex, emissiveMap: bbTex, emissive: 0xffffff, emissiveIntensity: 0.5 })); b.position.set(BB.x, 17, BB.z + 0.32); add(b);
}

// ---------- Troll Duels arena (floating island) ----------
const A = V(90, 40, 0);
{
  const fc = cv(1024, 1024), x = fc.getContext('2d');
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const left = j >= 8; x.fillStyle = left ? ((i + j) % 2 ? '#f06a6a' : '#e5484d') : ((i + j) % 2 ? '#5b95e6' : '#3a7bd5'); x.fillRect(i * 64, j * 64, 64, 64); }
  x.fillStyle = '#fffaf0'; x.fillRect(0, 504, 1024, 16); x.beginPath(); x.arc(512, 512, 120, 0, 7); x.fillStyle = '#7b3fe4'; x.fill(); x.lineWidth = 16; x.strokeStyle = '#fffaf0'; x.stroke(); star0(x, 512, 512, 80, 34, 5, '#ffd23f', 8);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1.4, 48), [lam({ color: 0x5aa83c }), lam({ map: tex(fc) }), lam({ color: 0x5aa83c })]); top.position.set(A.x, A.y - 0.7, A.z); add(top);
  const under = new THREE.Mesh(new THREE.ConeGeometry(7, 10, 12, 3), mats.rock); under.rotation.x = Math.PI; under.position.set(A.x, A.y - 6.4, A.z); add(under);
  const bc = cv(1024, 280), bx = bc.getContext('2d'); bx.fillStyle = '#7b3fe4'; bx.fillRect(0, 0, 1024, 280); bx.strokeStyle = '#ffd23f'; bx.lineWidth = 18; bx.strokeRect(9, 9, 1006, 262); bx.font = `900 150px ${FONT}`; const bs = Math.min(150, Math.floor(150 * 900 / bx.measureText('TROLL DUELS').width)); txt(bx, 'TROLL DUELS', 512, 148, bs, '#ffd23f', PLUM, 16);  // shrink to fit the banner
  for (const s of [-1, 1]) cyl(0.22, 0.22, 6.0, mats.wood, A.x + s * 3.2, A.y + 3.0, A.z - 5.2, 8);
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.8), lam({ map: tex(bc), side: THREE.DoubleSide })); ban.position.set(A.x, A.y + 5.0, A.z - 5.2); add(ban);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) > 0) continue; cyl(0.12, 0.12, 0.7, mats.yellow, A.x + Math.cos(a) * 6.75, A.y + 0.35, A.z + Math.sin(a) * 6.75, 8); }
}
const soonSign = new THREE.Group(); scene.add(soonSign);
{
  const c = cv(512, 300), x = c.getContext('2d'); x.fillStyle = '#c08a52'; x.fillRect(0, 0, 512, 300); x.strokeStyle = PLUM; x.lineWidth = 14; x.strokeRect(7, 7, 498, 286); txt(x, 'COMING', 256, 96, 84, '#fff', PLUM, 12); txt(x, 'SOON!', 256, 206, 96, '#ffd23f', PLUM, 12);
  const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.15), [mats.wood, mats.wood, mats.wood, mats.wood, lam({ map: tex(c) }), mats.wood]); p.position.y = 2.0; add(p, soonSign);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8), mats.wood); post.position.y = 0.7; add(post, soonSign);
}
const crate = new THREE.Group(); scene.add(crate);
{
  const c = cv(256, 256), x = c.getContext('2d'); x.drawImage(woodTex('#d09a5e'), 0, 0); x.strokeStyle = PLUM; x.lineWidth = 14; x.strokeRect(7, 7, 242, 242); txt(x, '?', 128, 136, 170, '#ffd23f', PLUM, 14);
  const m = lam({ map: tex(c) }); const cb = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), m); cb.position.y = 0.575; add(cb, crate);
  const tc = cv(256, 160), tx2 = tc.getContext('2d'); tx2.fillStyle = '#e5484d'; tx2.beginPath(); tx2.roundRect(8, 8, 240, 144, 24); tx2.fill(); tx2.strokeStyle = PLUM; tx2.lineWidth = 10; tx2.stroke(); txt(tx2, 'OG', 128, 84, 100, '#fff', PLUM, 10);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), lam({ map: tex(tc) })); tag.position.set(0.45, 1.05, 0.6); tag.rotation.z = -0.25; add(tag, crate);
}

// ---------- 2D character cards ----------
const cards = [];
const SPECS = {
  maker: { h: 2.05, shirt: '#2fa39a', hoodie: 1, skin: '#f6d7bf', hair: '#4a2f22', hairStyle: 'short', hat: 'phones', hatC: '#ff6b5a' },
  kid1: { h: 1.85, shirt: '#e5484d', skin: '#f3cfb3', hair: '#2a1d18', hairStyle: 'short', hat: 'cap', hatC: '#2f6fd6', logo: '★', logoC: '#ffd23f' },
  kid2: { h: 1.8, shirt: '#ffc93c', hoodie: 1, skin: '#8d5a3b', hair: '#1e1414', hairStyle: 'bun' },
  kid3: { h: 1.9, shirt: '#8e5bd6', skin: '#fbe2cf', hair: '#e0a43a', hairStyle: 'spiky', glasses: 1 },
  kid4: { h: 1.85, shirt: '#4cb05a', skin: '#d9a27a', hair: '#3a2416', hairStyle: 'long', hat: 'beanie', hatC: '#f26b3a' },
  kid5: { h: 1.95, shirt: '#3aa0e8', skin: '#f6d7bf', hair: '#6b3d22', hairStyle: 'spiky', logo: '♥', logoC: '#ff4d6d' },
  builder: { h: 2.0, shirt: '#f08a24', skin: '#e7b896', hair: '#3a2a20', hairStyle: 'short', hat: 'hard', hatC: '#ffd23f', vest: 1 },
  cat: { h: 1.95, shirt: '#c79a5a', coat: 1, cat: 1, skin: '#9a9cb0', shades: 1, tail: 1 },
  peakA: { h: 1.95, shirt: '#d9473c', hoodie: 1, skin: '#f6d7bf', hair: '#5a3a26', hairStyle: 'short', hat: 'beanie', hatC: '#2f6fd6', beard: 1 },
  peakB: { h: 1.9, shirt: '#3a7bd5', hoodie: 1, skin: '#f0c7a8', hair: '#c9772f', hairStyle: 'long', hat: 'beanie', hatC: '#e5484d', glasses: 1 },
  r1: { h: 1.9, shirt: '#e5484d', skin: '#fbe2cf', hair: '#e0a43a', hairStyle: 'spiky', logo: 'R', logoC: '#fff' },
  r2: { h: 1.8, shirt: '#e5484d', hoodie: 1, skin: '#8d5a3b', hair: '#1e1414', hairStyle: 'bun' },
  b1: { h: 1.9, shirt: '#3a7bd5', skin: '#f3cfb3', hair: '#2a1d18', hairStyle: 'short', hat: 'cap', hatC: '#ffd23f', logo: 'B', logoC: '#fff' },
  b2: { h: 1.85, shirt: '#3a7bd5', hoodie: 1, skin: '#d9a27a', hair: '#3a2416', hairStyle: 'long' },
  b3: { h: 1.95, shirt: '#3a7bd5', skin: '#f6d7bf', hair: '#6b3d22', hairStyle: 'spiky', glasses: 1, logo: 'B', logoC: '#fff' },
};
function headPath(x, cx, cy, rw, rh) {
  x.beginPath(); x.moveTo(cx, cy - rh);
  x.bezierCurveTo(cx + rw * 1.02, cy - rh, cx + rw * 1.05, cy + rh * 0.35, cx + rw * 0.55, cy + rh * 0.85);
  x.bezierCurveTo(cx + rw * 0.3, cy + rh * 1.02, cx - rw * 0.3, cy + rh * 1.02, cx - rw * 0.55, cy + rh * 0.85);
  x.bezierCurveTo(cx - rw * 1.05, cy + rh * 0.35, cx - rw * 1.02, cy - rh, cx, cy - rh); x.closePath();
}
function stick(x, pts, w = 12, c = PLUM) { x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke(); }
function dot(x, px, py, r = 10, c = PLUM) { x.fillStyle = c; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }

function drawPerson(c, sp, st) {
  const x = c.getContext('2d'); x.clearRect(0, 0, 600, 1000);
  const cx = 300, hy = st.sit ? 430 : 270, yo = hy - 270; const walk = st.walk || 0; const P = st.pose || 'idle';
  const hipY = 650 + yo, tY = 400 + yo; const sw = 74;
  if (sp.tail) { x.lineCap = 'round'; x.strokeStyle = PLUM; x.lineWidth = 36; x.beginPath(); x.moveTo(cx + 40, hipY + 30); x.bezierCurveTo(cx + 200, hipY + 40, cx + 240, hipY - 150, cx + 180, hipY - 230); x.stroke(); x.strokeStyle = sp.skin; x.lineWidth = 22; x.stroke(); }
  // legs
  let f1, f2;
  if (P === 'fly') { f1 = [cx - 170, 900]; f2 = [cx + 170, 900]; }
  else if (st.sit) { f1 = [255, 975]; f2 = [345, 975]; }
  else { const a = Math.sin(walk) * 0.32; f1 = [278 + Math.sin(a) * 300, 650 + Math.cos(a) * 325]; f2 = [322 - Math.sin(a) * 300, 650 + Math.cos(a) * 325]; }
  stick(x, [[278, hipY], f1]); stick(x, [[322, hipY], f2]);
  x.fillStyle = PLUM; x.beginPath(); x.ellipse(f1[0] - 10, f1[1], 32, 14, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(f2[0] + 10, f2[1], 32, 14, 0, 0, 7); x.fill();
  // torso
  const bot = hipY + (sp.coat ? 90 : 12), cw = sp.coat ? 16 : 0;
  x.fillStyle = sp.shirt; x.strokeStyle = PLUM; x.lineWidth = 8; x.beginPath();
  x.moveTo(cx - sw, tY + 14); x.lineTo(cx - sw - cw + 8, bot); x.lineTo(cx + sw + cw - 8, bot); x.lineTo(cx + sw, tY + 14); x.quadraticCurveTo(cx, tY - 16, cx - sw, tY + 14); x.closePath(); x.fill(); x.stroke();
  if (sp.hoodie) {
    x.fillStyle = shade(sp.shirt, -0.08); x.beginPath(); x.ellipse(cx, tY + 6, 72, 26, 0, 0, 7); x.fill(); x.stroke();
    x.lineWidth = 6; x.beginPath(); x.roundRect(cx - 54, tY + 150, 108, 70, 18); x.stroke();
    stick(x, [[cx - 18, tY + 26], [cx - 20, tY + 84]], 5); stick(x, [[cx + 18, tY + 26], [cx + 20, tY + 84]], 5);
  } else if (sp.coat) {
    stick(x, [[cx - 30, tY + 4], [cx, tY + 110], [cx + 30, tY + 4]], 6); x.fillStyle = shade(sp.shirt, -0.18); x.fillRect(cx - sw - 6, hipY - 12, 2 * sw + 12, 24); x.strokeRect(cx - sw - 6, hipY - 12, 2 * sw + 12, 24);
  } else {
    x.lineWidth = 6; x.beginPath(); x.arc(cx, tY + 2, 30, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    if (sp.vest) { x.fillStyle = '#ffe14d'; x.fillRect(cx - sw + 8, tY + 120, 2 * sw - 16, 18); x.fillRect(cx - sw + 8, tY + 180, 2 * sw - 16, 18); }
    if (sp.logo) { x.fillStyle = sp.logoC; x.beginPath(); x.arc(cx, tY + 120, 36, 0, 7); x.fill(); x.lineWidth = 5; x.stroke(); x.font = `900 42px ${FONT}`; x.fillStyle = sp.logoC === '#fff' ? sp.shirt : '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sp.logo, cx, tY + 122); }
  }
  // arms
  const sL = [cx - sw + 6, tY + 26], sR = [cx + sw - 6, tY + 26]; const sway = Math.sin(walk) * 30; const at = (dx, dy) => [cx + dx, tY + dy];
  let hl = at(-sw - 18 + sway * 0.2, 225), hr = at(sw + 18 - sway * 0.2, 225);
  switch (P) {
    case 'point': hr = at(sw + 125, 30); break;
    case 'pointL': hl = at(-sw - 125, 30); break;
    case 'pointUp': hr = at(sw + 60, -150); break;
    case 'present': hl = at(-sw - 120, 70); hr = at(sw + 120, 70); break;
    case 'cheer': case 'fly': hl = at(-sw - 80, -140); hr = at(sw + 80, -140); break;
    case 'fist': hr = at(sw + 55, -70); break;
    case 'fists': hl = at(-sw - 30, -50); hr = at(sw + 30, -50); break;
    case 'hide': hl = at(-70, -150); hr = at(70, -150); break;
    case 'type': hl = at(-38, 128); hr = at(38, 128); break;
    case 'phoneUp': hr = at(sw + 46, -200); break;
    case 'sign': case 'hold': hl = at(-92, 118); hr = at(92, 118); break;
    case 'give': hr = at(sw + 110, 100); break;
    case 'shrug': hl = at(-sw - 90, 10); hr = at(sw + 90, 10); break;
    case 'rub': hl = at(-24, 150); hr = at(24, 150); break;
  }
  const el = [(sL[0] + hl[0]) / 2 - 18, (sL[1] + hl[1]) / 2 + 10], er = [(sR[0] + hr[0]) / 2 + 18, (sR[1] + hr[1]) / 2 + 10];
  stick(x, [sL, el, hl]); stick(x, [sR, er, hr]); dot(x, hl[0], hl[1], 13); dot(x, hr[0], hr[1], 13);
  // props in hands
  if (P === 'type') { x.fillStyle = '#2b2d42'; x.strokeStyle = PLUM; x.lineWidth = 6; x.beginPath(); x.roundRect(cx - 44, tY + 70, 88, 130, 14); x.fill(); x.stroke(); x.fillStyle = '#8fe3ff'; x.fillRect(cx - 34, tY + 82, 68, 100); dot(x, hl[0], hl[1], 13); dot(x, hr[0], hr[1], 13); }
  if (P === 'phoneUp') { x.save(); x.translate(hr[0], hr[1] - 40); x.rotate(0.15); x.fillStyle = '#2b2d42'; x.strokeStyle = PLUM; x.lineWidth = 6; x.beginPath(); x.roundRect(-42, -66, 84, 132, 14); x.fill(); x.stroke(); dot(x, -18, -40, 9, '#7a8aa8'); x.restore(); dot(x, hr[0], hr[1], 13); }
  if ((P === 'hold' || P === 'give') && st.art) { const img = COV[st.art]; const bx = P === 'give' ? hr[0] - 20 : cx - 85, by = P === 'give' ? hr[1] - 190 : tY + 10; x.drawImage(img, bx, by, 170, 212); x.strokeStyle = PLUM; x.lineWidth = 7; x.strokeRect(bx, by, 170, 212); if (P === 'hold') { dot(x, hl[0] + 6, hl[1], 13); dot(x, hr[0] - 6, hr[1], 13); } }
  if (P === 'sign') { x.fillStyle = '#fffaf0'; x.strokeStyle = PLUM; x.lineWidth = 8; x.beginPath(); x.roundRect(cx - 170, tY + 10, 340, 210, 14); x.fill(); x.stroke(); const L = (st.sign || '').split('\n'); x.font = `900 52px ${FONT}`; const fs = Math.min(52, ...L.map(s => Math.floor(52 * 296 / x.measureText(s).width))); L.forEach((s, i) => txt(x, s, cx, tY + 70 + i * 74 - (L.length - 2) * 30, fs, i === L.length - 1 ? '#e5484d' : '#2b2d42', PLUM, 0)); dot(x, hl[0] + 6, hl[1], 13); dot(x, hr[0] - 6, hr[1], 13); }
  // head
  const rw = 118, rh = 124, hcx = cx + (st.tilt || 0) * 10, hcy = hy;
  if (sp.cat) { x.fillStyle = sp.skin; x.strokeStyle = PLUM; x.lineWidth = 9; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(hcx + s * 30, hcy - rh + 14); x.lineTo(hcx + s * 108, hcy - rh - 70); x.lineTo(hcx + s * 112, hcy - rh + 60); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#ffb3c6'; x.beginPath(); x.moveTo(hcx + s * 56, hcy - rh + 20); x.lineTo(hcx + s * 100, hcy - rh - 40); x.lineTo(hcx + s * 100, hcy - rh + 40); x.closePath(); x.fill(); x.fillStyle = sp.skin; } }
  if (sp.hairStyle === 'long') { x.fillStyle = sp.hair; x.strokeStyle = PLUM; x.lineWidth = 8; x.beginPath(); x.roundRect(hcx - rw - 6, hcy - 40, 2 * rw + 12, 190, 40); x.fill(); x.stroke(); }
  x.fillStyle = sp.skin; x.strokeStyle = PLUM; x.lineWidth = 9; headPath(x, hcx, hcy, rw, rh); x.fill(); x.stroke();
  if (sp.hair && sp.hairStyle !== 'none' && !sp.cat) {
    x.fillStyle = sp.hair; x.strokeStyle = PLUM; x.lineWidth = 8; x.beginPath();
    if (sp.hairStyle === 'spiky') { x.moveTo(hcx - rw * 0.98, hcy - 30); for (let i = 0; i <= 8; i++) { const u = i / 8; const px = hcx - rw + u * 2 * rw; x.lineTo(px, hcy - rh - (i % 2 ? 46 : -8) * Math.sin(u * Math.PI) - 8); } x.lineTo(hcx + rw * 0.98, hcy - 30); x.quadraticCurveTo(hcx, hcy - rh + 30, hcx - rw * 0.98, hcy - 30); }
    else { x.moveTo(hcx - rw * 0.98, hcy - 20); x.bezierCurveTo(hcx - rw * 1.05, hcy - rh - 26, hcx + rw * 1.05, hcy - rh - 26, hcx + rw * 0.98, hcy - 20); x.quadraticCurveTo(hcx + 40, hcy - rh + 50, hcx - 10, hcy - rh + 36); x.quadraticCurveTo(hcx - 60, hcy - rh + 60, hcx - rw * 0.98, hcy - 20); }
    x.closePath(); x.fill(); x.stroke();
    if (sp.hairStyle === 'bun') { x.beginPath(); x.arc(hcx, hcy - rh - 30, 44, 0, 7); x.fill(); x.stroke(); }
  }
  const E = st.expr || 'neutral'; const ex = 34, ey = hcy - 4 + (st.down ? 10 : 0);
  // eyes
  for (const s of [-1, 1]) {
    const px = hcx + s * ex + (st.gaze || 0) * 6, py = ey;
    if (st.blink || E === 'happy' || E === 'laugh' || E === 'relief') stick(x, E === 'happy' || E === 'laugh' || E === 'relief' ? [[px - 13, py + 4], [px, py - 8], [px + 13, py + 4]] : [[px - 12, py], [px + 12, py]], 6);
    else if (E === 'wink' && s > 0) stick(x, [[px - 13, py], [px + 13, py]], 6);
    else if (E === 'dizzy') { x.strokeStyle = PLUM; x.lineWidth = 5; x.beginPath(); for (let a = 0; a < 12; a += 0.3) x.lineTo(px + Math.cos(a) * a * 1.4, py + Math.sin(a) * a * 1.4); x.stroke(); }
    else if (E === 'suspicious' || E === 'angry') { dot(x, px, py + 3, 10); }
    else if (E === 'wow' || E === 'shocked') { x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, 21, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = PLUM; x.stroke(); dot(x, px, py + 2, 10); }
    else dot(x, px, py, 11);
  }
  if (sp.shades) { x.fillStyle = '#16131f'; x.strokeStyle = PLUM; x.lineWidth = 6; for (const s of [-1, 1]) { x.beginPath(); x.roundRect(hcx + s * ex - 30, ey - 22, 60, 40, 14); x.fill(); } stick(x, [[hcx - 6, ey - 6], [hcx + 6, ey - 6]], 6); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(hcx - ex - 18, ey - 14, 14, 8); x.fillRect(hcx + ex - 18, ey - 14, 14, 8); }
  if (sp.glasses) { x.strokeStyle = PLUM; x.lineWidth = 5; x.beginPath(); x.arc(hcx - ex, ey, 24, 0, 7); x.moveTo(hcx + ex + 24, ey); x.arc(hcx + ex, ey, 24, 0, 7); x.moveTo(hcx - ex + 24, ey); x.lineTo(hcx + ex - 24, ey); x.stroke(); }
  // brows
  const bY = ey - 42;
  if (E === 'smug' || E === 'sly' || E === 'wink') { stick(x, [[hcx - 54, bY + 6], [hcx - 16, bY - 2]], 7); stick(x, [[hcx + 16, bY - 8], [hcx + 54, bY + 2]], 7); }
  else if (E === 'suspicious') { stick(x, [[hcx - 54, bY + 2], [hcx - 16, bY + 12]], 7); stick(x, [[hcx + 16, bY - 12], [hcx + 54, bY - 18]], 7); }
  else if (E === 'shocked' || E === 'wow') { stick(x, [[hcx - 54, bY - 16], [hcx - 16, bY - 22]], 7); stick(x, [[hcx + 16, bY - 22], [hcx + 54, bY - 16]], 7); }
  else if (E === 'worried') { stick(x, [[hcx - 54, bY + 4], [hcx - 16, bY - 8]], 7); stick(x, [[hcx + 16, bY - 8], [hcx + 54, bY + 4]], 7); }
  else if (E === 'angry') { stick(x, [[hcx - 54, bY - 8], [hcx - 14, bY + 10]], 8); stick(x, [[hcx + 14, bY + 10], [hcx + 54, bY - 8]], 8); }
  // nose
  if (sp.cat) { x.fillStyle = '#ff8fab'; x.beginPath(); x.moveTo(hcx - 12, ey + 22); x.lineTo(hcx + 12, ey + 22); x.lineTo(hcx, ey + 34); x.closePath(); x.fill(); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) stick(x, [[hcx + s * 30, ey + 34 + k * 10], [hcx + s * 92, ey + 24 + k * 16]], 4); }
  else { x.strokeStyle = PLUM; x.lineWidth = 5; x.beginPath(); x.moveTo(hcx + 4, ey + 16); x.quadraticCurveTo(hcx + 16, ey + 36, hcx + 2, ey + 40); x.stroke(); }
  // mouth
  const my = ey + 64, mo = st.mouth || 0; x.strokeStyle = PLUM; x.fillStyle = '#7a2a30'; x.lineWidth = 6;
  if (mo > 0.05) { x.beginPath(); x.ellipse(hcx, my + 4, 18 + mo * 6, 6 + mo * 16, 0, 0, 7); x.fill(); x.stroke(); }
  else if (E === 'smug' || E === 'sly' || E === 'wink') { x.beginPath(); x.moveTo(hcx - 30, my); x.quadraticCurveTo(hcx + 5, my + 14, hcx + 36, my - 10); x.stroke(); }
  else if (E === 'happy' || E === 'grin' || E === 'relief' || E === 'laugh') { x.beginPath(); x.moveTo(hcx - 36, my - 4); x.quadraticCurveTo(hcx, my + (E === 'laugh' ? 54 : 42), hcx + 36, my - 4); x.closePath(); x.fill(); x.stroke(); }
  else if (E === 'shocked' || E === 'wow' || E === 'dizzy') { x.beginPath(); x.ellipse(hcx, my + 6, 15, 21, 0, 0, 7); x.fill(); x.stroke(); }
  else if (E === 'suspicious' || E === 'worried' || E === 'angry') stick(x, [[hcx - 24, my + 8], [hcx, my], [hcx + 24, my + 8]], 6);
  else { x.beginPath(); x.moveTo(hcx - 20, my); x.quadraticCurveTo(hcx, my + 8, hcx + 20, my); x.stroke(); }
  if (sp.beard) { x.fillStyle = sp.hair; x.strokeStyle = PLUM; x.lineWidth = 6; x.beginPath(); x.moveTo(hcx - 92, ey + 30); x.quadraticCurveTo(hcx, hcy + 200, hcx + 92, ey + 30); x.quadraticCurveTo(hcx + 30, my + 26, hcx, my + 30); x.quadraticCurveTo(hcx - 30, my + 26, hcx - 92, ey + 30); x.fill(); x.stroke(); }
  // hats
  const top = hcy - rh; x.strokeStyle = PLUM; x.lineWidth = 8;
  if (sp.hat === 'cap') { x.fillStyle = sp.hatC; x.beginPath(); x.ellipse(hcx, top + 34, 120, 58, 0, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); x.beginPath(); x.ellipse(hcx + 64, top + 34, 84, 17, 0, 0, Math.PI); x.fill(); x.stroke(); }
  if (sp.hat === 'beanie') { x.fillStyle = sp.hatC; x.beginPath(); x.ellipse(hcx, top + 44, 122, 86, 0, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); x.fillStyle = shade(sp.hatC, -0.1); x.beginPath(); x.roundRect(hcx - 126, top + 18, 252, 44, 18); x.fill(); x.stroke(); x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(hcx, top - 46, 26, 0, 7); x.fill(); x.stroke(); }
  if (sp.hat === 'hard') { x.fillStyle = sp.hatC; x.beginPath(); x.ellipse(hcx, top + 40, 116, 90, 0, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); x.beginPath(); x.roundRect(hcx - 140, top + 30, 280, 22, 10); x.fill(); x.stroke(); stick(x, [[hcx, top - 46], [hcx, top + 30]], 8); }
  if (sp.hat === 'phones') { x.strokeStyle = PLUM; x.lineWidth = 22; x.beginPath(); x.arc(hcx, hcy - 10, 132, Math.PI * 1.08, Math.PI * 1.92); x.stroke(); x.strokeStyle = sp.hatC; x.lineWidth = 10; x.stroke(); x.fillStyle = sp.hatC; x.strokeStyle = PLUM; x.lineWidth = 8; for (const s of [-1, 1]) { x.beginPath(); x.roundRect(hcx + s * 128 - 26, hcy - 40, 52, 92, 20); x.fill(); x.stroke(); } }
}

class Card {
  constructor(name, sp) {
    this.name = name; this.sp = sp; this.c = cv(600, 1000); this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 8;
    const h = sp.h, w = h * 0.6; const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2 - h * 0.025, 0);
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mask = new THREE.MeshBasicMaterial({ map: this.t, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x000000 });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.castShadow = true; this.mesh.layers.set(1);
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    const blob = new THREE.Mesh(new THREE.CircleGeometry(w * 0.32, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.scale.y = 0.45; blob.layers.set(1); this.blob = blob;
    this.g = new THREE.Group(); this.g.add(this.mesh); this.g.add(blob); scene.add(this.g);
    this.key = ''; const r = rng(name.length * 97 + Math.round(h * 1000) + name.charCodeAt(0)); this.blinks = []; let bt = r() * 1.5; while (bt < END) { this.blinks.push(bt); bt += 0.5 + r() * 1.8; }
    cards.push(this);
  }
  set(t, st) {
    this.g.visible = !!st; if (!st) return;
    const fr = Math.round(t * FPS); const blink = this.blinks.some(b => fr >= Math.round(b * FPS) && fr < Math.round(b * FPS) + 4);
    const s = { ...st, blink: blink && !st.noBlink, walk: st.walk ? t * st.walk : 0 };
    const key = JSON.stringify([s.expr, s.pose, Math.round((s.mouth || 0) * 6), s.blink, Math.round(s.walk * 8), s.sit, s.art, s.sign, s.gaze, s.down]);
    if (key !== this.key) { drawPerson(this.c, this.sp, s); this.t.needsUpdate = true; this.key = key; }
    const bob = st.walk ? Math.abs(Math.sin(t * st.walk)) * 0.06 : 0;
    this.g.position.set(st.p[0], (st.p[1] || 0) + bob, st.p[2]);
    this.mesh.rotation.y = Math.atan2(camera.position.x - st.p[0], camera.position.z - st.p[2]);
    this.mesh.rotation.z = (st.lean || 0) + (st.walk ? Math.sin(t * st.walk) * 0.03 : 0);
    const sc = st.s || 1; this.mesh.scale.set((st.flip ? -1 : 1) * sc, sc, sc);
    this._blob = !st.noBlob; this.blob.visible = this._blob;
  }
}
const C = {}; for (const k in SPECS) C[k] = new Card(k, SPECS[k]);
const QS = ['kid2', 'kid3', 'kid4', 'kid5', 'kid1', 'kid3', 'kid2', 'kid4']; const Q = QS.map((k, i) => new Card('q' + i, SPECS[k]));

// ---------- FX cards ----------
const fxList = [];
function fxCard(name, w, h, draw, res = 256) {
  const c = cv(res, Math.round(res * h / w)); draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide }));
  m.layers.set(1); m.visible = false; scene.add(m); m.userData.mask = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, color: 0, side: THREE.DoubleSide }); fxList.push(m); return m;
}
const star = (x, cx, cy, r1, r2, n, fill, lw = 10) => { x.fillStyle = fill; x.strokeStyle = PLUM; x.lineWidth = lw; x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? r2 : r1; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); };
const FX = {
  spark: fxCard('spark', 0.6, 0.6, (x) => star(x, 128, 128, 118, 40, 4, '#fff6b0')),
  spark2: fxCard('spark2', 0.4, 0.4, (x) => star(x, 128, 128, 118, 40, 4, '#fff6b0')),
  spark3: fxCard('spark3', 0.5, 0.5, (x) => star(x, 128, 128, 118, 40, 4, '#ffd23f')),
  q: fxCard('q', 0.5, 0.7, (x) => { txt(x, '?', 128, 190, 300, '#fff', PLUM, 16); }),
  qBig: fxCard('qBig', 6, 8.4, (x) => { txt(x, '?', 128, 190, 300, '#ffd23f', PLUM, 16); }),
  xCode: fxCard('xCode', 0.9, 0.9, (x) => { x.fillStyle = '#2b2d42'; x.strokeStyle = PLUM; x.lineWidth = 10; x.beginPath(); x.roundRect(20, 40, 216, 176, 20); x.fill(); x.stroke(); txt(x, '</>', 128, 128, 90, '#8fe3ff', PLUM, 0); stick(x, [[40, 40], [216, 216]], 26, '#ff3b3b'); stick(x, [[216, 40], [40, 216]], 26, '#ff3b3b'); }),
  xArt: fxCard('xArt', 0.9, 0.9, (x) => { x.fillStyle = '#f3d2a2'; x.strokeStyle = PLUM; x.lineWidth = 10; x.beginPath(); x.ellipse(128, 128, 106, 86, 0, 0, 7); x.fill(); x.stroke(); for (const [px, py, c] of [[80, 100, '#e5484d'], [124, 76, '#ffd23f'], [172, 96, '#3a7bd5'], [178, 150, '#4cb05a']]) dot(x, px, py, 18, c); dot(x, 96, 170, 22, '#fff'); stick(x, [[40, 40], [216, 216]], 26, '#ff3b3b'); stick(x, [[216, 40], [40, 216]], 26, '#ff3b3b'); }),
  boom: fxCard('boom', 4.2, 4.2, (x) => { star(x, 128, 128, 124, 70, 11, '#ffb627', 8); star(x, 128, 128, 80, 44, 9, '#fff3a0', 6); }),
  banana: fxCard('banana', 0.75, 0.6, (x) => drawBanana(x, 128, 120, 1.6), 256),
  bomb: fxCard('bomb', 0.85, 0.95, (x) => drawBomb(x, 120, 150, 1.6), 256),
  puff: fxCard('puff', 1.4, 0.9, (x) => { x.fillStyle = '#ffffff'; x.strokeStyle = 'rgba(36,23,38,0.6)'; x.lineWidth = 6; for (const [px, py, r] of [[70, 110, 50], [128, 80, 60], [190, 110, 48], [128, 128, 50]]) { x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.stroke(); } }),
  dizzy: fxCard('dizzy', 0.9, 0.4, (x) => { for (let i = 0; i < 3; i++) star(x, 50 + i * 78, 60 + (i % 2) * 20, 30, 12, 5, '#ffe14d', 5); }),
  copy: fxCard('copy', 1.0, 0.5, (x, w, h) => { x.save(); x.translate(128, 64); x.rotate(-0.15); x.strokeStyle = '#e5484d'; x.lineWidth = 10; x.strokeRect(-110, -44, 220, 88); txt(x, 'COPY', 0, 4, 66, '#e5484d', PLUM, 0); x.restore(); }),
  thumb: fxCard('thumb', 0.8, 0.95, (x) => { x.fillStyle = '#fffaf0'; x.strokeStyle = PLUM; x.lineWidth = 10; x.fillRect(10, 10, 236, 284); x.strokeRect(10, 10, 236, 284); x.fillStyle = '#9fb8d8'; x.fillRect(30, 30, 196, 196); x.fillStyle = '#f2b896'; x.beginPath(); x.ellipse(150, 200, 90, 130, -0.5, 0, 7); x.fill(); x.lineWidth = 6; x.stroke(); }, 256),
  blurPic: fxCard('blurPic', 0.8, 0.95, (x) => { x.fillStyle = '#fffaf0'; x.strokeStyle = PLUM; x.lineWidth = 10; x.fillRect(10, 10, 236, 284); x.strokeRect(10, 10, 236, 284); x.filter = 'blur(9px)'; x.fillStyle = '#7fc8ff'; x.fillRect(30, 30, 196, 196); x.fillStyle = '#4cb05a'; x.fillRect(30, 150, 196, 76); dot(x, 120, 110, 40, '#e5484d'); x.filter = 'none'; }, 256),
  flashA: fxCard('flashA', 0.7, 0.7, (x) => star(x, 128, 128, 124, 30, 6, '#ffffff', 6)),
  flashB: fxCard('flashB', 0.7, 0.7, (x) => star(x, 128, 128, 124, 30, 6, '#ffffff', 6)),
  flashC: fxCard('flashC', 0.7, 0.7, (x) => star(x, 128, 128, 124, 30, 6, '#ffffff', 6)),
  moon: fxCard('moon', 26, 26, (x) => { x.fillStyle = '#fff4c8'; x.beginPath(); x.arc(128, 128, 100, 0, 7); x.fill(); x.fillStyle = '#e8dca8'; x.beginPath(); x.arc(100, 100, 18, 0, 7); x.arc(160, 150, 12, 0, 7); x.fill(); }),
};
const clouds = [];
{ const r = rng(5); for (let i = 0; i < 16; i++) {
  const m = fxCard('cloud' + i, 40, 17, (x) => { x.fillStyle = '#ffffff'; x.strokeStyle = 'rgba(80,90,130,0.6)'; x.lineWidth = 4; x.beginPath(); x.arc(70, 70, 36, Math.PI, 0); x.arc(120, 52, 46, Math.PI, 0); x.arc(176, 70, 36, Math.PI, 0); x.lineTo(212, 100); x.lineTo(34, 100); x.closePath(); x.fill(); x.stroke(); });
  if (i < 9) m.position.set(-200 + i * 50 + r() * 30, 60 + r() * 40, -220 - r() * 60); else { m.position.set(A.x - 80 + (i - 9) * 26 + r() * 10, A.y - 14 + r() * 8, A.z - 95 - r() * 30); m.scale.setScalar(0.6); }
  clouds.push(m); } }

// moving world props: rain over the pile, boxes pulled into the filter
const rain = []; for (let i = 0; i < 12; i++) rain.push(gameBox(['slop0', 'slop1', 'slop2'][i % 3]));
const sucked = []; for (let i = 0; i < 6; i++) sucked.push(gameBox(['slop1', 'slop0', 'slop2'][i % 3]));
const popBox = gameBox('slop0');

// ---------- lighting ----------
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
const sc = sun.shadow.camera; sc.near = 1; sc.far = 300; scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x8a7a66, 1.2); scene.add(hemi);
const LP = {
  day: { sun: '#fff0d8', si: 2.7, az: 150, el: 50, hs: '#cfe0ff', hg: '#9a8668', hi: 1.2, top: '#3e7fd2', hor: '#b8d6f2', fogN: 80, fogF: 560, card: '#ffffff', win: 0, lamp: 0, sat: 1.12, lift: 0.04, tint: '#ffffff', stars: 0, sunDisc: 0 },
  golden: { sun: '#ffb36b', si: 2.5, az: 210, el: 14, hs: '#ffcf9e', hg: '#6a4a6a', hi: 1.05, top: '#7f6fa0', hor: '#ffc47c', fogN: 60, fogF: 440, card: '#ffe6cc', win: 0.35, lamp: 0.3, sat: 1.14, lift: 0.05, tint: '#fff0e0', stars: 0, sunDisc: 1 },
  night: { sun: '#a9c0ff', si: 1.2, az: 120, el: 38, hs: '#5a7ac4', hg: '#26305a', hi: 1.5, top: '#0c1838', hor: '#2c4a8c', fogN: 50, fogF: 340, card: '#b4c4f2', win: 1.6, lamp: 1.6, sat: 1.05, lift: 0.06, tint: '#c8d6ff', stars: 1, sunDisc: 0 },
  arena: { sun: '#fff2dc', si: 2.8, az: 160, el: 46, hs: '#d4e6ff', hg: '#9a8668', hi: 1.25, top: '#3a86e0', hor: '#c4e2ff', fogN: 90, fogF: 600, card: '#ffffff', win: 0, lamp: 0, sat: 1.16, lift: 0.04, tint: '#ffffff', stars: 0, sunDisc: 0 },
};
const LT = [[0, 'day'], [T.so - 0.6, 'day'], [T.so + 0.6, 'golden'], [T.see - 0.4, 'golden'], [T.see + 0.1, 'night'], [T.made - 0.12, 'night'], [T.made - 0.11, 'arena'], [END + 1, 'arena']];
function lightAt(t) {
  let i = 0; while (i < LT.length - 2 && t >= LT[i + 1][0]) i++;
  const [t0, a] = LT[i], [t1, b] = LT[i + 1]; const u = t1 > t0 ? sstep(t0, t1, t) : 0;
  const Ap = LP[a], B = LP[b], o = {};
  for (const k in Ap) { if (typeof Ap[k] === 'number') o[k] = lerp(Ap[k], B[k], u); else o[k] = new THREE.Color(Ap[k]).lerp(new THREE.Color(B[k]), u); }
  return o;
}

// ---------- post (ink + lens + grade) ----------
const post = new THREE.ShaderMaterial({
  uniforms: {
    tC: { value: colorRT.texture }, tN: { value: normalRT.texture }, tD: { value: normalRT.depthTexture },
    res: { value: new THREE.Vector2(W, H) }, near: { value: camera.near }, far: { value: camera.far },
    focus: { value: 5 }, cInf: { value: 0 }, fogC: { value: new THREE.Color() }, fogN: { value: 60 }, fogF: { value: 400 },
    top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sat: { value: 1.1 }, lift: { value: 0.04 }, tint: { value: new THREE.Color(1, 1, 1) },
    flash: { value: 0 }, stars: { value: 0 }, sunDir: { value: new THREE.Vector3() }, sunDisc: { value: 0 }, sunC: { value: new THREE.Color() },
    invProj: { value: new THREE.Matrix4() }, camW: { value: new THREE.Matrix4() }, ink: { value: 1 }, dbg: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `
    precision highp float; varying vec2 vUv;
    uniform sampler2D tC,tN,tD; uniform vec2 res; uniform float near,far,focus,cInf,fogN,fogF,sat,lift,flash,stars,sunDisc,ink,dbg;
    uniform vec3 fogC,top,hor,tint,sunDir,sunC; uniform mat4 invProj,camW;
    float lin(float d){ return near*far/(far-d*(far-near)); }
    float depthAt(vec2 uv){ return texture2D(tD,uv).x; }
    bool isMask(vec2 uv){ vec3 n=texture2D(tN,uv).rgb; return dot(n,n)<0.02; }
    vec3 viewDir(vec2 uv){ vec4 p=invProj*vec4(uv*2.-1.,1.,1.); p/=p.w; return normalize((camW*vec4(normalize(p.xyz),0.)).xyz); }
    float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    vec3 sky(vec2 uv){ vec3 d=viewDir(uv); float e=d.y; vec3 c=mix(hor,top,smoothstep(-0.02,0.55,e));
      float s=max(dot(d,normalize(sunDir)),0.); c+=sunC*sunDisc*(smoothstep(0.9985,0.9992,s)*1.2+pow(s,40.)*0.35);
      if(stars>0.){ vec3 q=floor(d*420.); float h=hash(q); c+=vec3(1.)*stars*step(0.9975,h)*smoothstep(0.05,0.3,e); }
      return c; }
    vec3 grade(vec3 c){ c=c/(1.0+0.12*max(max(c.r,c.g),c.b)); c*=tint; float l=dot(c,vec3(.2126,.7152,.0722)); c=mix(vec3(l),c,sat); c=c*(1.-lift)+lift*vec3(0.55,0.6,0.85)*0.6; return c; }
    vec3 toSRGB(vec3 c){ c=max(c,0.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
    void main(){
      vec2 px=1./res; float d=depthAt(vUv); bool skyPx=d>=0.99999; float z=lin(d); bool m=isMask(vUv);
      float coc = skyPx ? cInf : cInf*abs(1.-focus/z); coc=clamp(coc,0.,22.);
      vec3 col=vec3(0.); float wsum=0.; float inkAmt=0.; vec3 inkCol=vec3(0.);
      if(coc>0.6){
        for(int i=0;i<32;i++){ float fi=float(i); float r=sqrt((fi+.5)/32.)*coc; float a=fi*2.39996;
          vec2 o=vec2(cos(a),sin(a))*r*px; vec2 uv=vUv+o; float dd=depthAt(uv); float zz=lin(dd); float cs= dd>=0.99999?cInf:cInf*abs(1.-focus/zz);
          float w=smoothstep(r-1.5,r+0.5,cs); if(zz>z+0.5 && cs<coc) w*=0.6;
          vec3 sc = dd>=0.99999 ? sky(uv) : texture2D(tC,uv).rgb; col+=sc*w; wsum+=w; }
        col/=max(wsum,1e-3);
      } else col = skyPx ? sky(vUv) : texture2D(tC,vUv).rgb;
      if(!skyPx && !m){ float f=smoothstep(fogN,fogF,z)*0.85; col=mix(col,fogC,f); }
      if(!skyPx && !m && ink>0.){
        float th=mix(5.1,3.0,smoothstep(6.,90.,z))*res.x/1080.*0.75;
        vec3 n0=texture2D(tN,vUv).rgb*2.-1.; float e=0.;
        for(int k=0;k<8;k++){ float a=float(k)*0.785398; vec2 uv=vUv+vec2(cos(a),sin(a))*th*px; float dd=depthAt(uv);
          if(isMask(uv)) continue;
          float zz= dd>=0.99999 ? far : lin(dd);
          if((zz-z)/z>0.035) e=1.;
          vec3 nn=texture2D(tN,uv).rgb*2.-1.; if(dot(n0,nn)<0.78) e=max(e,0.85); }
        float inkFade=1.-smoothstep(160.,420.,z); vec3 inkC=mix(vec3(0.006,0.005,0.008),fogC*0.4,smoothstep(80.,300.,z));
        inkAmt=e*inkFade*ink*(coc>4.?0.5:1.); inkCol=inkC;
      }
      if(dbg>0.5){ gl_FragColor=vec4(dbg<1.5?texture2D(tN,vUv).rgb:vec3(fract(z/10.)),1.); return; }
      col=grade(col);
      col=mix(col,inkCol*0.6,inkAmt*0.92);
      col=mix(col,vec3(1.),flash);
      vec2 q=vUv-.5; col*=1.-dot(q,q)*0.35;
      gl_FragColor=vec4(toSRGB(col),1.);
    }`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene(); const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const normalMat = new THREE.MeshNormalMaterial();

// ---------- camera keys: [t, pos, look, fov, roll, cut] ----------
const K = [];
function key(t, p, l, fov = 40, roll = 0, cut = false) { K.push({ t, p: V(...p), l: V(...l), fov, roll, cut }); }
const a = (dx, dy, dz) => [A.x + dx, A.y + dy, A.z + dz];
const CUT1 = T.july - 0.05, CUT2 = T.made - 0.1;
// hook: kid in front of the slop mountain, then the filter
key(0, [1.6, 1.5, -12.6], [0.2, 5.9, -30], 52, 0.02, true);  // tilted up so the kid's face sits under the caption
key(T.filter - 0.9, [2.2, 1.75, -13.6], [0.6, 5.9, -30], 49, 0.04);
key(T.filter + 0.05, [2.6, 4.0, -8.0], [9.4, 3.7, -27], 46, -0.03);
key(CUT1, [2.8, 4.1, -8.8], [9.4, 3.6, -27], 44, -0.03);
// July 2026: town wide, glide to the phone
key(CUT1 + 0.01, [0, 21, 40], [0, 4, -22], 44, 0, true);
key(T.build - 0.3, [-3, 15, 30], [-6, 4, -12], 44, 0);
key(T.type - 0.15, [-9.6, 3.4, 7.0], [-12, 3.7, -6], 41, 0);
key(T.sentence + 0.2, [-12.0, 3.95, 1.8], [-12, 3.95, -6], 44, 0);
key(T.game - 0.05, [-12.0, 3.8, 1.1], [-12, 3.6, -6], 42, 0);
key(T.code - 0.1, [-10.3, 1.95, 1.8], [-11.3, 1.55, -3.6], 40, 0);
key(T.half - 0.25, [-10.1, 1.95, 1.2], [-11.3, 1.6, -3.6], 37, 0);
// half a million: crane up over the queue
key(T.half + 0.75, [-2.6, 6.6, 13.5], [-11.2, 1.8, -1.2], 44, 0);
key(T.help - 0.5, [-2.4, 6.8, 12.4], [-10.6, 1.8, -2.4], 44, 0);
// help page + clicker conveyor
key(T.help + 0.25, [-0.6, 3.3, -7.2], [-4.8, 2.6, -13.4], 42, 0);
key(T.clickers + 0.1, [-1.6, 3.0, -12.8], [-6.4, 1.6, -19.5], 42, 0);
key(T.copycats - 0.45, [-1.4, 2.9, -15.0], [-6.0, 1.5, -22], 42, 0);
// copycats: copier
key(T.copycats + 0.2, [8.0, 2.0, 2.4], [11.4, 1.5, -5.2], 42, 0);
key(T.people2 + 0.1, [8.3, 2.0, 2.0], [11.4, 1.5, -5.2], 40, 0);
key(T.counter + 0.2, [9.3, 2.6, 5.5], [10.9, 1.0, -4.6], 42, 0.02);
key(T.exactly + 0.35, [9.5, 2.4, 4.6], [10.9, 1.0, -4.6], 40, 0.03);
// PEAK devs
key(T.peak + 0.1, [14.0, 1.8, 2.6], [16.2, 1.2, -3.4], 42, 0);
key(T.pirate - 0.1, [14.2, 1.75, 1.8], [16.2, 1.15, -3.5], 38, 0);
key(T.so - 0.05, [14.6, 1.7, 1.0], [16.2, 1.15, -3.6], 33, -0.04);
// mystery: crane up over the town to the TOP 100 board
key(T.why - 0.2, [6, 9, 10], [0, 8, -40], 46, 0);
key(T.p80 - 0.1, [2.0, 12, -4], [0, 16, -58], 46, 0);
key(T.see - 0.25, [1.5, 12.6, -7], [0, 16.2, -58], 44, 0);
// you see: the maker with his phone at night
key(T.camera - 0.1, [0.9, 1.85, 10.4], [0.3, 1.75, 6.4], 40, 0);
key(T.everybody - 0.05, [0.8, 1.85, 10.0], [0.3, 1.75, 6.4], 37, 0);
key(T.everybody + 0.9, [0, 2.6, 13.8], [0, 1.7, 4.8], 44, 0);
key(T.slop3 - 0.05, [0, 2.5, 12.8], [0, 1.7, 4.8], 42, 0);
key(T.slop3 + 0.8, [0.9, 1.75, 9.4], [0.35, 1.5, 6.4], 38, 0);
key(CUT2, [0.7, 1.62, 8.7], [0.35, 1.4, 6.4], 35, 0);  // gentler push-in leaves room for the caption above the head
// Troll Duels arena
key(CUT2 + 0.01, a(2, 6, 18), a(0, 1.5, 0), 44, 0, true);
key(T.but - 0.1, a(1, 4, 14), a(0.4, 1.5, 0), 44, 0);
key(T.flipping - 0.1, a(0.4, 2.4, 10.5), a(0.4, 1.2, 0), 42, 0);
key(T.flipping + 0.25, a(1.2, 2.0, 7.0), a(1.4, 1.2, 0), 40, Math.PI);
key(T.dropping - 0.25, a(1.3, 2.0, 6.8), a(1.4, 1.2, 0), 39, Math.PI);
key(T.dropping + 0.05, a(2.6, 1.8, 7.0), a(3.3, 0.8, 0.8), 42, 0);
key(T.launching - 0.05, a(3.6, 1.9, 7.4), a(4.6, 0.5, 0.8), 44, 0);
key(T.other - 0.02, a(3.8, 1.9, 7.5), a(4.8, 0.5, 0.8), 44, 0);
// cut wide and centred: both teams, the bomb and the whole TROLL DUELS banner in frame
key(T.other, a(0.6, 2.6, 12.8), a(0.8, 1.2, -1.0), 44, 0, true);
key(T.bomb - 0.1, a(0.6, 2.55, 12.3), a(0.8, 1.2, -1.0), 44, 0);
key(T.funny + 0.4, a(0.8, 4.0, 14.5), a(1.0, 5.0, -1.0), 46, 0);
// twist: pull back, island floating high over the fields
key(T.also + 0.6, a(7, 6, 28), a(0, -2, 0), 44, 0);
key(T.troll2 - 0.1, a(10, 8, 36), a(0, -4, 0), 44, 0);
// coming soon, OG pet, follow
key(T.coming - 0.02, a(11, 8.6, 39), a(0, -4, 0), 44, 0);
// cut in on "coming" (a pan from the wide shot cropped the banner mid-word)
key(T.coming, a(3.1, 2.25, 9.2), a(3.0, 1.7, 0.8), 42, 0, true);
key(T.coming + 0.4, a(3.0, 2.2, 8.6), a(3.0, 1.7, 0.8), 42, 0);
key(T.limited - 0.15, a(2.8, 2.0, 8.2), a(2.8, 1.5, 1.2), 40, 0);
key(T.og, a(2.1, 1.5, 6.6), a(1.95, 0.8, 2.3), 38, 0);
key(T.revealing - 0.15, a(2.1, 1.4, 6.0), a(1.95, 0.8, 2.3), 34, 0);
key(T.follow - 0.3, a(1.2, 1.9, 7.4), a(1.1, 1.0, 2.6), 40, 0);
key(END, a(1.2, 1.9, 6.8), a(1.1, 1.0, 2.6), 36, 0);

const BOOM = T.bomb + 0.14;
const KICKS = [[T.n70, 0.03], [BOOM, 0.07], [T.dropping + 0.55, 0.03], [T.og, 0.025], [T.game, 0.03]];
const FLASHES = [CUT1, CUT2, BOOM];
function camAt(t) {
  let i = 0; while (i < K.length - 1 && K[i + 1].t <= t) i++;
  const k0 = K[i], k1 = K[i + 1]; let p, l, fov, roll;
  if (!k1 || k1.cut) { p = k0.p.clone(); l = k0.l.clone(); fov = k0.fov; roll = k0.roll; }
  else { const u = smoother(clamp((t - k0.t) / (k1.t - k0.t))); p = k0.p.clone().lerp(k1.p, u); l = k0.l.clone().lerp(k1.l, u); fov = lerp(k0.fov, k1.fov, u); roll = lerp(k0.roll, k1.roll, u); }
  const fr = Math.round(t * FPS);
  for (const [kt, Am] of KICKS) { const k = fr - Math.round(kt * FPS); if (k >= 0 && k < 7) { const s = (k % 2 ? -1 : 1) * Am * (1 - k / 7); p.y += s; p.x += s * 0.6; } }
  return { p, l, fov, roll };
}

// ---------- stage: who stands where ----------
function stage(t) {
  const st = {}; const q = {};
  if (t < CUT1) { // hook
    st.kid1 = { p: [0.7, 0, -18.2], expr: t < T.typed + 0.3 ? 'neutral' : 'wow', pose: t > T.n70 ? 'shrug' : 'idle', gaze: 1 };
    st.kid4 = { p: [3.4, 0, -21.5], expr: 'shocked', pose: 'idle' };
    st.builder = { p: [BIN.x + 1.0, 0, BIN.z + 3.5], expr: t > T.filter ? 'smug' : 'neutral', pose: t > T.filter - 0.2 ? 'fist' : 'idle' };
  } else if (t < T.half) { // phone
    st.maker = { p: [-11.0, 0, -3.5], pose: t < T.game + 0.3 ? 'type' : 'hold', art: 'slop0', expr: t < T.game ? 'neutral' : (t < T.code ? 'happy' : 'grin'), down: t < T.game };
    if (t < T.build + 0.6) { st.kid2 = { p: [-6, 0, 6 - (t - CUT1) * 1.1], walk: 9 }; st.kid5 = { p: [4, 0, -2 + (t - CUT1) * 1.0], walk: 9 }; }
  } else if (t < T.copycats - 0.2) { // queue + conveyor
    Q.forEach((c, i) => { q[c.name] = { p: [-10.9 + Math.sin(i * 1.7) * 0.4, 0, -2.4 + i * 1.35], expr: i % 3 ? 'happy' : 'wow', pose: i === 0 ? 'type' : (i % 4 === 2 ? 'cheer' : 'idle'), down: i === 0 }; });
    st.maker = { p: [-8.6, 0, -2.2], pose: 'hold', art: 'slop0', expr: 'grin' };
  } else if (t < T.makers - 0.15) { // copier
    const feed = t < T.counter;
    st.cat = { p: [CP.x + 0.2, 0, CP.z + 2.7], expr: t < T.people2 ? 'sly' : (t < T.exactly ? 'smug' : 'wink'), pose: t < T.copycats + 0.3 ? 'hide' : (feed ? 'give' : 'present'), art: 'cs', lean: t < T.copycats + 0.3 ? 0.15 : 0 };
  } else if (t < T.so + 0.3) { // PEAK devs
    const angry = t > T.copy + 0.2; const sign = t > T.pirate - 0.1;
    st.peakA = { p: [15.8, 0, -3.5], pose: sign ? 'sign' : 'hold', art: 'peak', sign: 'PIRATE OURS\nINSTEAD!', expr: sign ? 'angry' : (angry ? 'shocked' : 'happy') };
    st.peakB = { p: [17.1, 0, -3.9], pose: t > T.ripoff - 0.1 ? 'fists' : (angry ? 'pointL' : 'idle'), expr: angry ? 'angry' : 'happy', flip: true };
    st.cat = { p: [12.7, 0, -2.0], pose: 'present', expr: t > T.pirate ? 'worried' : 'smug', s: 0.95 };
  } else if (t < T.see - 0.2) { // mystery wide: few walkers in the plaza
    st.kid2 = { p: [-3, 0, 2 - (t - T.so) * 0.8], walk: 9 }; st.kid3 = { p: [4, 0, -4 + (t - T.so) * 0.7], walk: 9 };
  } else if (t < CUT2) { // night: phones
    const crowd = t > T.everybody - 0.1;
    st.maker = { p: [0.3, 0, 6.4], pose: t < T.slop3 ? 'phoneUp' : 'hold', art: t > T.fun - 0.08 ? 'td' : 'slop1', expr: t < T.slop3 ? 'happy' : (t > T.fun - 0.08 ? 'wow' : 'neutral') };
    if (crowd) Q.forEach((c, i) => { const ang = (i - 3.5) * 0.34; q[c.name] = { p: [Math.sin(ang) * 4.2, 0, 4.6 - Math.cos(ang) * 1.8 + (i % 2) * 0.9], pose: 'phoneUp', expr: i % 2 ? 'happy' : 'grin', flip: i < 4 }; });
  } else { // arena
    const ax = A.x, ay = A.y, az = A.z;
    const flipT = t > T.flipping && t < T.dropping;
    st.r1 = { p: [ax - 1.7, ay, az + 0.3], pose: t > BOOM + 0.1 ? 'cheer' : (t > T.flipping ? 'point' : 'idle'), expr: t > BOOM ? 'laugh' : 'smug' };
    st.r2 = { p: [ax - 0.7, ay, az - 0.5], pose: t > BOOM + 0.1 ? 'cheer' : 'idle', expr: t > BOOM ? 'laugh' : 'grin' };
    // b1 slips on the banana and slides off the edge
    const slip = T.dropping + 0.55;
    if (t < slip) st.b1 = { p: [ax + 2.4 + ease(T.dropping, slip, t) * 1.0, ay, az + 0.8], walk: t > T.dropping ? 9 : 0, expr: flipT ? 'dizzy' : 'neutral', pose: 'idle' };
    else if (t < slip + 0.9) { const u = (t - slip) / 0.9; st.b1 = { p: [ax + 3.4 + u * 4.4, ay + 0.2 - Math.max(0, u - 0.55) * Math.max(0, u - 0.55) * 30, az + 0.8], lean: -1.3 - u * 2, expr: 'shocked', pose: 'fly', noBlob: true }; }
    // b2, b3 get launched by the bomb
    for (const [k, dx, dz, sp] of [['b2', 1.3, -0.5, -1], ['b3', 2.1, -1.1, 1]]) {
      if (t < BOOM) st[k] = { p: [ax + dx, ay, az + dz], expr: flipT && k === 'b2' ? 'dizzy' : (t > T.bomb - 0.3 ? 'shocked' : 'neutral'), pose: t > T.bomb - 0.3 ? 'hide' : 'idle' };
      else if (t < BOOM + 1.6) { const u = t - BOOM; st[k] = { p: [ax + dx + u * 2.2 * sp, ay + u * 10 - u * u * 2.0, az + dz], lean: u * 9 * sp, pose: 'fly', expr: 'wow', noBlob: true }; }
    }
    if (t > T.troll2 - 0.3) {
      st.maker = { p: [ax + 0.8, ay, az + 2.7], pose: t > T.follow - 0.1 ? 'point' : (t > T.limited - 0.2 ? 'pointL' : 'present'), expr: t > T.miss ? 'wink' : (t > T.limited ? 'grin' : 'happy'), flip: t > T.limited - 0.2 && t < T.follow - 0.1 ? false : false, mouth: 0 };
    }
  }
  return { st, q };
}

function fxAt(t, cam) {
  fxList.forEach(m => (m.visible = false));
  const face = (m) => { m.quaternion.copy(cam.quaternion); };
  const pop = (t0) => { const u = clamp((t - t0) / 0.22); return u < 1 ? smoother(u) * 1.25 - Math.max(0, u - 0.7) * 0.8 : 1.0; };
  const show = (m, p, s = 1, rot = 0) => { m.visible = true; m.position.copy(p); face(m); m.scale.setScalar(s); if (rot) m.rotateZ(rot); };
  const night = t > T.see && t < CUT2;
  clouds.forEach(c => { c.visible = !night; c.quaternion.copy(cam.quaternion); });
  if (night) { FX.moon.visible = true; const d = new THREE.Vector3(); cam.getWorldDirection(d); FX.moon.position.copy(cam.position).add(d.multiplyScalar(300)).add(V(60, 120, 0)); face(FX.moon); }
  if (t > T.game - 0.05 && t < T.game + 0.6) { show(FX.spark, V(-12, 1.5, -5.0), pop(T.game) * 1.4, t * 2); }
  if (t > T.code - 0.05 && t < T.half) show(FX.xCode, V(-11.95, 2.45, -3.3), pop(T.code) * 0.8, Math.sin(t * 3) * 0.08);
  if (t > T.art - 0.05 && t < T.half) show(FX.xArt, V(-10.05, 2.45, -3.3), pop(T.art) * 0.8, Math.sin(t * 3 + 1) * 0.08);
  if (t > T.clickers - 0.1 && t < T.copycats) show(FX.spark3, V(-4.25, 4.6, -13.0), pop(T.clickers) * 1.2, t * 2);
  if (t > T.exactly - 0.05 && t < T.makers) show(FX.copy, V(CP.x - 3.4, 1.7, CP.z + 1.9), pop(T.exactly) * 1.5);
  if (t > T.why - 0.05 && t < T.p80 - 0.1) show(FX.qBig, V(0, 31, -58), pop(T.why) * (1 + Math.sin(t * 6) * 0.04));
  if (t > T.everybody && t < T.slop3) { [FX.flashA, FX.flashB, FX.flashC].forEach((f, i) => { const ph = (t * 1.7 + i * 0.37) % 1; if (ph < 0.18) { const ang = ((i * 3 + Math.floor(t * 1.7)) % 8 - 3.5) * 0.34; show(f, V(Math.sin(ang) * 4.2 + 0.55, 2.55, 4.6 - Math.cos(ang) * 1.8 + 0.2), 1.2 * (1 - ph / 0.18) + 0.3); } }); }
  if (t > T.camera - 0.05 && t < T.everybody) { const ph = (t * 2.2) % 1; if (ph < 0.2) show(FX.flashA, V(0.9, 2.55, 6.6), 1.0); }
  if (t > T.photographer - 0.1 && t < T.slop3 + 0.3) { show(FX.thumb, V(-1.4, 2.2 + Math.sin(t * 2) * 0.05, 8.3), pop(T.photographer) * 1.1, -0.2); show(FX.blurPic, V(1.4, 2.3, 8.2), pop(T.photographer + 0.12) * 1.1, 0.18); }
  if (t > T.fun - 0.1 && t < CUT2) { show(FX.spark, V(0.0, 2.0, 6.7), pop(T.fun) * 0.7, t * 3); show(FX.spark2, V(0.75, 1.4, 6.7), pop(T.fun + 0.08) * 0.8, -t * 3); show(FX.spark3, V(-0.3, 1.2, 6.8), pop(T.fun + 0.15) * 0.6, t * 2); }
  // arena
  const ax = A.x, ay = A.y, az = A.z;
  if (t > T.flipping && t < T.dropping) show(FX.dizzy, V(ax + 1.3, ay + 2.15, az - 0.5), 1 + Math.sin(t * 10) * 0.05, Math.sin(t * 8) * 0.2);
  if (t > T.dropping - 0.05 && t < T.dropping + 1.6) { const u = clamp((t - T.dropping) / 0.3); show(FX.banana, V(ax + 3.4, ay + 0.3 + (1 - u * u) * 3, az + 1.0), 1, (1 - u) * 6); }
  if (t > T.dropping + 0.5 && t < T.dropping + 0.9) show(FX.puff, V(ax + 3.5, ay + 0.4, az + 1.0), pop(T.dropping + 0.5) * 0.9);
  if (t > T.launching + 0.1 && t < BOOM) { const u = clamp((t - T.launching - 0.1) / 0.35); show(FX.bomb, V(ax + 1.7, ay + 0.48 + (1 - u * u) * 4, az - 0.8), 1 + Math.sin(t * 30) * 0.04 * u); show(FX.spark2, V(ax + 2.02, ay + 1.0 + (1 - u * u) * 4, az - 0.75), 0.5 + Math.abs(Math.sin(t * 25)) * 0.4, t * 9); }
  if (t > BOOM && t < BOOM + 0.6) { const u = (t - BOOM) / 0.6; show(FX.boom, V(ax + 1.7, ay + 1.4, az - 0.8), (0.4 + u * 1.2) * (u < 0.8 ? 1 : (1 - u) * 5), u * 0.8); }
  if (t > BOOM + 0.05 && t < BOOM + 1.2) show(FX.puff, V(ax + 1.7, ay + 0.6, az - 0.3), (0.8 + (t - BOOM) * 1.6) * 1.4);
  if (t > T.slop4 - 0.05 && t < T.troll2) show(FX.qBig, V(ax + 5.4, ay + 3.2, az - 1.5), pop(T.slop4) * 0.7);  // beside the banner, not over it
  if (t > T.limited - 0.1 && t < END) { show(FX.spark, V(ax + 2.6, ay + 1.5, az + 2.5), (0.6 + Math.abs(Math.sin(t * 4)) * 0.4) * pop(T.limited), t * 2); show(FX.spark2, V(ax + 2.7, ay + 0.4, az + 3.0), (0.5 + Math.abs(Math.sin(t * 5 + 1)) * 0.5) * pop(T.limited + 0.1), -t * 2); }
  if (t > T.limited - 0.35 && t < T.limited + 0.2) show(FX.puff, V(ax + 1.95, ay + 0.4, az + 2.5), pop(T.limited - 0.35) * 1.3);
}

function propsAt(t) {
  // rain of boxes onto the pile (hook + mystery)
  const rainOn = t < CUT1 || (t > T.so && t < T.see);
  rain.forEach((b, i) => {
    b.visible = rainOn; if (!rainOn) return; const r = rng(i * 31 + 7); const per = 1.4, ph = ((t + i * per / rain.length) % per) / per;
    const ang = r() * 6.28, rr = r() * 6; const yEnd = mtH(rr) + 0.4; b.position.set(MT.x + Math.cos(ang) * rr, lerp(yEnd + 22, yEnd, ph * ph), MT.z + Math.sin(ang) * rr); b.rotation.set(t * 2 + i, t * 1.5 + i, 0); b.scale.setScalar(1.2);
  });
  // boxes pulled up into the filter
  sucked.forEach((b, i) => {
    const t0 = T.filter - 0.4 + i * 0.22, u = clamp((t - t0) / 0.9); b.visible = t < CUT1 && t > t0 && u < 1; if (!b.visible) return;
    const r = rng(i * 13 + 3); const ang = -0.2 + r() * 1.2, rr = 3 + r() * 4; const s0 = V(MT.x + Math.cos(ang) * rr, mtH(rr) + 0.3, MT.z + Math.sin(ang) * rr); const s1 = V(BIN.x, 8.6, BIN.z);
    const p = s0.clone().lerp(s1, u * u); p.y += Math.sin(u * Math.PI) * 3; b.position.copy(p); b.rotation.set(t * 5 + i, t * 4, i); b.scale.setScalar(1.2 * (1 - u * 0.6));
  });
  // the box Build makes
  { const t0 = T.game - 0.05, u = clamp((t - t0) / 0.35); popBox.visible = t > t0 && u < 1; if (popBox.visible) { const p = V(-12, 1.0, -5.2).lerp(V(-11.0, 1.35, -3.4), u); p.y += Math.sin(u * Math.PI) * 1.2; popBox.position.copy(p); popBox.rotation.set(0, u * 6.28, 0); } }
  // clicker conveyor
  const conv = t > T.half - 0.3 && t < T.copycats + 0.2;
  clickBoxes.forEach((b, i) => { b.visible = conv; if (!conv) return; const u = ((t - T.half) * 0.11 + i / clickBoxes.length) % 1; const p = CV_A.clone().lerp(CV_B, u); b.position.set(p.x, 1.62, p.z); b.rotation.set(0, Math.atan2(CV_B.x - CV_A.x, CV_B.z - CV_A.z) + Math.PI / 2 + 0.6, 0); b.scale.setScalar(1.05); });
  // copier output
  const nCopies = Math.floor(copyPile.length * clamp((t - T.people2) / (T.exactly - T.people2)));
  copyPile.forEach((b, i) => (b.visible = t > T.people2 && i < nCopies && t < T.see));
  { const ph = ((t - T.people2) * 2.4) % 1; flyCopy.visible = t > T.people2 && t < T.makers; if (flyCopy.visible) { flyCopy.position.set(CP.x - 1.6 - ph * 1.4, 1.3 + Math.sin(ph * Math.PI) * 0.8 - ph * 0.6, CP.z + 0.6 + ph * 0.8); flyCopy.rotation.set(-ph * 2, ph * 3, 0); } }
  origBox.visible = t > T.copycats - 1 && t < T.counter; origBox.rotation.y = t * 0.8;
  cliffBox.visible = t > T.makers - 1 && t < T.see;
  // billboard
  drawBoard(Math.round(80 * clamp((t - (T.p80 - 0.5)) / 1.4)));
  // phone screen
  const typed = Math.round(14 * clamp((t - T.type) / (T.sentence + 0.5 - T.type)));
  drawPhone(t < T.type ? 0 : typed, t > T.game - 0.05 ? 2 : (t > T.sentence + 0.55 ? 1 : 0), t > T.type - 0.4 && t < T.game && (Math.floor(t * 4) % 2 === 0));
  // arena signs
  { const sc = Math.max(0.001, 1 - ease(T.first - 0.4, T.first - 0.12, t));  // shrinks away about its own centre as the FIRST WEEK ticket arrives
    soonSign.visible = t > T.troll2 - 0.2 && t < T.first - 0.12; soonSign.position.set(A.x + 3.2, A.y - 2.2 * (1 - ease(T.coming - 0.4, T.coming + 0.1, t)) + 2.0 * (1 - sc), A.z + 0.8); soonSign.scale.setScalar(sc); } soonSign.rotation.y = -0.25;
  crate.visible = t > T.limited - 0.4; { const u = ease(T.limited - 0.4, T.limited - 0.1, t); crate.position.set(A.x + 1.95, A.y + (1 - u) * 4, A.z + 2.3); const wob = t > T.revealing ? 0.12 : 0.05; crate.rotation.set(0, -0.35, Math.sin(t * 18) * wob * (Math.sin(t * 3) > 0.2 ? 1 : 0.2)); }
}

// focus & lens blur per beat: [point, strength]
function dofAt(t) {
  if (t < CUT1) return t < T.filter - 0.2 ? [V(0.7, 1.5, -18.2), 7] : [null, 0];
  if (t < T.build) return [null, 0];
  if (t < T.code - 0.1) return [V(-12, 3.8, -5.7), t > T.type ? 6 : 0];
  if (t < T.half + 0.4) return [V(-11.0, 1.6, -3.5), 12];
  if (t < T.copycats) return [null, 0];
  if (t < T.makers) return [V(CP.x + 0.2, 1.5, CP.z + 2.7), 10];
  if (t < T.so + 0.4) return [V(16.2, 1.6, -3.6), 12];
  if (t < T.see) return [null, 0];
  if (t < T.everybody + 0.3) return [V(0.3, 1.6, 6.4), 13];
  if (t < T.slop3 + 0.4) return [V(0, 1.8, 6.0), 6];
  if (t < CUT2) return [V(0.3, 1.4, 6.4), 14];
  if (t < T.but) return [null, 0];
  if (t < T.bomb) return [V(A.x + 1.4, A.y + 1.3, A.z), 7];
  if (t < T.troll2) return [null, 0];
  if (t < T.limited - 0.2) return [V(A.x + 3.2, A.y + 1.8, A.z + 0.8), 8];
  if (t < T.follow - 0.3) return [V(A.x + 1.95, A.y + 0.8, A.z + 2.3), 12];
  return [V(A.x + 0.8, A.y + 1.5, A.z + 2.7), 11];
}

// ---------- render ----------
const tmpDir = new THREE.Vector3();
function renderAt(time) {
  const t = Math.min(Math.max(time, 0), END - 1e-3);
  const L = lightAt(t);
  const c = camAt(t); camera.position.copy(c.p); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.up.set(0, 1, 0); camera.lookAt(c.l); camera.rotateZ(c.roll); camera.updateMatrixWorld();
  propsAt(t);
  const { st, q } = stage(t);
  for (const k in C) C[k].set(t, st[k] || null);
  for (const cd of Q) cd.set(t, q[cd.name] || null);
  for (const cd of cards) cd.mat.color.copy(L.card);
  fxAt(t, camera);
  sun.color.copy(L.sun); sun.intensity = L.si; hemi.color.copy(L.hs); hemi.groundColor.copy(L.hg); hemi.intensity = L.hi;
  const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
  const sdir = V(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const [fp, coc] = dofAt(t);
  const center = fp ? fp.clone() : c.p.clone().add(tmpDir.copy(c.l).sub(c.p).normalize().multiplyScalar(14));
  if (center.distanceTo(c.p) > 60) center.copy(c.p).add(tmpDir.copy(c.l).sub(c.p).normalize().multiplyScalar(30));
  sun.target.position.copy(center); sun.position.copy(center).add(sdir.clone().multiplyScalar(140)); sun.target.updateMatrixWorld();
  const big = c.p.y > 8; sc.left = sc.bottom = big ? -70 : -24; sc.right = sc.top = big ? 70 : 24; sc.updateProjectionMatrix();
  nightEmissive.forEach(m => (m.emissiveIntensity = L.win));
  mats.lamp.emissiveIntensity = L.lamp * 1.5; lampLights.forEach(l => (l.intensity = L.lamp * 40));
  const u = post.uniforms; u.focus.value = fp ? fp.distanceTo(c.p) : c.l.distanceTo(c.p); u.cInf.value = coc * W / 1080;
  u.fogC.value.copy(L.hor); u.fogN.value = L.fogN; u.fogF.value = L.fogF; u.top.value.copy(L.top); u.hor.value.copy(L.hor);
  u.sat.value = L.sat; u.lift.value = L.lift; u.tint.value.copy(L.tint); u.stars.value = L.stars; u.sunDir.value.copy(sdir); u.sunDisc.value = L.sunDisc; u.sunC.value.copy(L.sun);
  u.invProj.value.copy(camera.projectionMatrixInverse); u.camW.value.copy(camera.matrixWorld);
  u.dbg.value = window.__dbg || 0;
  const fr = Math.round(t * FPS); u.flash.value = 0;
  for (const ft of FLASHES) { const ff = Math.round(ft * FPS); if (fr >= ff && fr < ff + 4) u.flash.value = Math.max(u.flash.value, (1 - (fr - ff) / 4) * 0.9); }
  // pass 1: normals + depth (cards and fx as black masks)
  const swaps = [];
  worldMeshes.forEach(m => { swaps.push([m, m.material]); m.material = normalMat; });
  for (const cd of cards) { swaps.push([cd.mesh, cd.mesh.material]); cd.mesh.material = cd.mask; cd.blob.visible = false; }
  fxList.forEach(m => { swaps.push([m, m.material]); m.material = m.userData.mask; });
  renderer.setRenderTarget(normalRT); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(scene, camera);
  swaps.forEach(([m, mat]) => (m.material = mat));
  for (const cd of cards) cd.blob.visible = cd.g.visible && cd._blob;
  // pass 2: colour with shadows
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(colorRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  // pass 3: post to screen
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
window.__renderAt = renderAt;
window.addEventListener('hf-seek', e => renderAt(e.detail.time));
renderAt(window.__hfThreeTime || 0);
