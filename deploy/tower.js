/* =====================================================================
   SCM-Master · Logistics Control Tower (3D RTS home screen) — TIER 2
   ---------------------------------------------------------------------
   Babylon.js PBR render: image-based lighting, glow, soft (blur-ESM)
   shadows, ACES tone-map, bloom, SSAO, grain + vignette.

   STATE-ACCURATE, motion illustrative. Every count, capacity %, crate
   stack, datacenter rack and event-log line is read from the live
   /api/data model (RAW) and re-syncs on each 60s refresh. The forklift/
   truck MOTION between those states is animated for life, timed off the
   REAL daily_in / daily_out rates — not a fabricated event stream, and
   no number is invented. The warehouse renders `committed` crates out of
   `capacity` slots, so the box count is in proportion to the warehouse's
   maximum capacity.

   Public API (window.SCMTower):
     mount(container)  – build engine/scene into a DOM node, start loop
     sync(RAW)         – (re)bind to the live model; called on load + every
                         60s refresh, so the scene re-syncs
     unmount()         – stop loop, dispose GL (on tab switch away)
     isMounted()       – bool
   Depends on BABYLON (6.x) being on the page already.
   ===================================================================== */
(function () {
'use strict';

var B = window.BABYLON;
if (!B) { console.error('[tower] BABYLON not loaded'); return; }

// ----- module state (single instance) -----
var R = {
  mounted: false, container: null, canvas: null, engine: null, scene: null,
  camera: null, glow: null, shadow: null, pipe: null, ssao: null,
  data: null, hud: null, tagLayer: null,
  workers: [], trucks: [], cratePool: [], rackSlots: [], wareStack: [], jobs: [],
  _onResize: null,
};

var CRATE_HEX = { recv: '#3ddc84', store: '#f5a524', pack: '#4aa3ff', dc: '#2dd4bf', dead: '#ff5d5d' };
var Z = {
  RECEIVE:   { x: -17, hex: '#3ddc84', name: 'RECEIVING' },
  WAREHOUSE: { x: -2,  hex: '#f5a524', name: 'WAREHOUSE' },
  PACKING:   { x: 11,  hex: '#4aa3ff', name: 'PACKING' },
  DATACTR:   { x: 24,  hex: '#2dd4bf', name: 'DATACENTER' },
  DISPOSAL:  { x: 33,  hex: '#ff5d5d', name: 'DISPOSAL' },
};
var NDC = 14;

// live SIM mirror of the real model
var SIM = {
  tick: 0, playing: true, speed: 1, t: 0, tickAcc: 0,
  capacity: 0, committed: 0, onHand: 0, inbound: 0, freeToOrder: 0,
  committedPct: 0, dailyIn: 0, dailyOut: 0, daysToDepletion: 0,
  deployed: 0,
  inboundQueue: [],
  truckTimer: 2.5, reqTimer: 3, decomTimer: 9,
  fxOn: true,
};

function W() { return R.container ? R.container.clientWidth : window.innerWidth; }
function H() { return R.container ? R.container.clientHeight : window.innerHeight; }
function reqId() { return 1000 + Math.floor((SIM.t * 137) % 8999); }

// =====================================================================
// MATERIAL HELPERS
// =====================================================================
var matN = 0;
function pbr(hex, metallic, rough) {
  var m = new B.PBRMaterial('p' + (matN++), R.scene);
  m.albedoColor = B.Color3.FromHexString(hex);
  m.metallic = metallic; m.roughness = rough;
  return m;
}
function emiss(hex, intensity) {
  var m = new B.PBRMaterial('e' + (matN++), R.scene);
  var c = B.Color3.FromHexString(hex);
  m.albedoColor = c.scale(0.2); m.metallic = 0; m.roughness = 0.5;
  m.emissiveColor = c; m.emissiveIntensity = intensity || 1;
  return m;
}
function cast(m) { if (R.shadow) R.shadow.addShadowCaster(m); return m; }
function gradFace(c1, c2) {
  var cv = document.createElement('canvas'); cv.width = cv.height = 128;
  var x = cv.getContext('2d'); var g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return cv.toDataURL();
}

// =====================================================================
// BUILD (once per mount)
// =====================================================================
function build() {
  var canvas = document.createElement('canvas');
  canvas.id = 'tw-canvas';
  canvas.style.cssText = 'width:100%;height:100%;display:block;outline:none;touch-action:none';
  R.container.appendChild(canvas);
  R.canvas = canvas;

  var engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true, adaptToDeviceRatio: true });
  R.engine = engine;

  var scene = new B.Scene(engine);
  R.scene = scene;
  scene.clearColor = new B.Color4(0.027, 0.039, 0.066, 1);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.1;
  scene.fogMode = B.Scene.FOGMODE_LINEAR;
  scene.fogColor = new B.Color3(0.027, 0.039, 0.066);
  scene.fogStart = 48; scene.fogEnd = 110;

  // procedural IBL for PBR
  var sky = gradFace('#243149', '#0b1018'), bot = gradFace('#080b11', '#080b11');
  try {
    var env = B.CubeTexture.CreateFromImages([sky, sky, sky, sky, bot, sky], scene);
    scene.environmentTexture = env; scene.environmentIntensity = 0.55;
  } catch (e) { /* IBL optional */ }

  // camera — ArcRotate (built-in orbit)
  var camera = new B.ArcRotateCamera('cam', Math.PI * 1.15, 1.02, 52, new B.Vector3(2, 1.5, 1), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 18; camera.upperRadiusLimit = 98;
  camera.lowerBetaLimit = 0.18; camera.upperBetaLimit = 1.46;
  camera.wheelDeltaPercentage = 0.015; camera.panningSensibility = 24; camera.panningInertia = 0.6;
  camera.inertia = 0.78; camera.minZ = 0.1; camera.maxZ = 320;
  camera.useAutoRotationBehavior = true;
  camera.autoRotationBehavior.idleRotationSpeed = 0.16;
  camera.autoRotationBehavior.idleRotationWaitTime = 1400;
  camera.autoRotationBehavior.idleRotationSpinupTime = 1200;
  R.camera = camera;

  // lights + shadows
  var hemi = new B.HemisphericLight('hemi', new B.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.65; hemi.diffuse = new B.Color3(0.62, 0.71, 0.86); hemi.groundColor = new B.Color3(0.05, 0.07, 0.1);
  var dir = new B.DirectionalLight('sun', new B.Vector3(0.55, -1, 0.35), scene);
  dir.position = new B.Vector3(-34, 52, -22); dir.intensity = 2.4; dir.diffuse = new B.Color3(1, 0.95, 0.86);
  var rim = new B.DirectionalLight('rim', new B.Vector3(-0.5, -0.3, 0.6), scene);
  rim.intensity = 0.5; rim.diffuse = new B.Color3(0.18, 0.83, 0.75);

  var shadow = new B.ShadowGenerator(2048, dir);
  shadow.useBlurExponentialShadowMap = true; shadow.blurKernel = 32; shadow.darkness = 0.42; shadow.bias = 0.0015;
  R.shadow = shadow;

  R.glow = new B.GlowLayer('glow', scene); R.glow.intensity = 0.85;

  buildGround();
  Object.keys(Z).forEach(function (k) {
    var dims = { RECEIVE: [9, 12], WAREHOUSE: [11, 14], PACKING: [9, 12], DATACTR: [10, 16], DISPOSAL: [6, 9] }[k];
    platform(Z[k], dims[0], dims[1]);
  });
  // supplier road
  var road = B.MeshBuilder.CreateBox('road', { width: 22, height: 0.06, depth: 3.2 }, scene);
  road.position.set(-25, 0.05, 6); road.material = pbr('#10151e', 0.2, 0.8); road.receiveShadows = true;

  buildRacks();
  buildWorkers();
  buildTrucks();
  buildCratePool();
  buildPipeline();
}

function buildGround() {
  var scene = R.scene;
  var cv = document.createElement('canvas'); cv.width = cv.height = 128;
  var x = cv.getContext('2d'); x.fillStyle = '#0e131c'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#1f2a3a'; x.lineWidth = 2; x.strokeRect(0, 0, 128, 128);
  var grid = new B.DynamicTexture('grid', { width: 128, height: 128 }, scene, true);
  grid.getContext().drawImage(cv, 0, 0); grid.update();
  grid.uScale = 40; grid.vScale = 40; grid.wrapU = grid.wrapV = B.Texture.WRAP_ADDRESSMODE;
  var gm = new B.PBRMaterial('gm', scene);
  gm.albedoTexture = grid; gm.albedoColor = new B.Color3(1, 1, 1);
  gm.metallic = 0.15; gm.roughness = 0.7; gm.environmentIntensity = 0.4;
  var g = B.MeshBuilder.CreateGround('ground', { width: 170, height: 130 }, scene);
  g.material = gm; g.receiveShadows = true; R.glow.addExcludedMesh(g);
}

function zoneLabel(text, hex) {
  var scene = R.scene;
  var dt = new B.DynamicTexture('dt' + text, { width: 512, height: 128 }, scene, true);
  dt.hasAlpha = true; dt.drawText(text, null, 92, 'bold 66px "Chakra Petch", sans-serif', hex, 'transparent', true);
  var mat = new B.StandardMaterial('lm' + text, scene);
  mat.diffuseTexture = dt; mat.diffuseTexture.hasAlpha = true; mat.useAlphaFromDiffuseTexture = true;
  mat.emissiveColor = B.Color3.FromHexString(hex); mat.emissiveTexture = dt;
  mat.disableLighting = true; mat.backFaceCulling = false;
  var pl = B.MeshBuilder.CreatePlane('lbl' + text, { width: 8.6, height: 2.15 }, scene);
  pl.material = mat; pl.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
  R.glow.addExcludedMesh(pl); return pl;
}

function platform(z, w, d) {
  var scene = R.scene;
  var base = B.MeshBuilder.CreateBox('p' + z.name, { width: w, height: 0.4, depth: d }, scene);
  base.position.set(z.x, 0.2, 0); base.material = pbr('#141b26', 0.25, 0.6);
  base.receiveShadows = true; cast(base);
  var edge = B.MeshBuilder.CreateBox('e' + z.name, { width: w + 0.3, height: 0.07, depth: d + 0.3 }, scene);
  edge.position.set(z.x, 0.43, 0); edge.material = emiss(z.hex, 0.9);
  var lab = zoneLabel(z.name, z.hex); lab.position.set(z.x, 4.5, -d / 2 - 0.6);
}

function buildRacks() {
  R.rackSlots = [];
  var scene = R.scene;
  for (var row = 0; row < 2; row++) {
    for (var col = 0; col < 7; col++) {
      if (R.rackSlots.length >= NDC) break;
      var px = Z.DATACTR.x - 3.6 + col * 1.25, pz = -3.4 + row * 6.6;
      var rack = B.MeshBuilder.CreateBox('rack', { width: 1, height: 2.6, depth: 1.5 }, scene);
      rack.position.set(px, 1.5, pz); rack.material = pbr('#19212e', 0.55, 0.4); rack.receiveShadows = true; cast(rack);
      var led = B.MeshBuilder.CreateBox('led', { width: 0.12, height: 2.2, depth: 0.08 }, scene);
      led.position.set(px + 0.45, 1.6, pz + 0.78); led.material = emiss('#22303f', 0.6);
      R.rackSlots.push({ mesh: rack, led: led, active: false, age: 0, pos: new B.Vector3(px, 0, pz) });
    }
  }
}

function buildWorkers() {
  R.workers = [];
  var scene = R.scene;
  for (var idx = 0; idx < 7; idx++) {
    var root = new B.TransformNode('w' + idx, scene);
    var body = B.MeshBuilder.CreateBox('wb', { width: 1, height: 0.7, depth: 1.4 }, scene);
    body.position.y = 0.6; body.material = pbr('#aeb9c9', 0.75, 0.35); body.parent = root; cast(body); body.receiveShadows = true;
    var cab = B.MeshBuilder.CreateBox('wc', { width: 0.8, height: 0.6, depth: 0.7 }, scene);
    cab.position.set(0, 1.1, -0.25); cab.material = pbr('#2a3340', 0.4, 0.5); cab.parent = root; cast(cab);
    var fork = B.MeshBuilder.CreateBox('wf', { width: 0.9, height: 0.12, depth: 0.9 }, scene);
    fork.position.set(0, 0.35, 0.95); fork.material = pbr('#3a4554', 0.6, 0.45); fork.parent = root;
    var wmat = pbr('#0e1116', 0.1, 0.85);
    [[-.5, .6], [.5, .6], [-.5, -.5], [.5, -.5]].forEach(function (p, k) {
      var w = B.MeshBuilder.CreateCylinder('ww' + k, { diameter: 0.52, height: 0.2, tessellation: 12 }, scene);
      w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.26, p[1]); w.material = wmat; w.parent = root;
    });
    var led = B.MeshBuilder.CreateSphere('wl', { diameter: 0.28 }, scene);
    led.position.set(0, 1.55, -0.25); var lm = emiss('#2dd4bf', 1.4); led.material = lm; led.parent = root;
    var forkPt = new B.TransformNode('fp' + idx, scene); forkPt.parent = root; forkPt.position.set(0, 1.05, 0.95);
    root.metadata = { led: lm, forkPt: forkPt, carry: null, state: 'idle', job: null, wob: idx * 0.9 };
    root.position.set(-6 + idx * 1.4, 0, 12);
    R.workers.push(root);
  }
}

function buildTrucks() {
  R.trucks = [];
  var scene = R.scene;
  for (var idx = 0; idx < 2; idx++) {
    var root = new B.TransformNode('t' + idx, scene);
    var trailer = B.MeshBuilder.CreateBox('tt', { width: 2.2, height: 2, depth: 5 }, scene);
    trailer.position.set(0, 1.4, -0.6); trailer.material = pbr('#222b38', 0.5, 0.5); trailer.parent = root; cast(trailer); trailer.receiveShadows = true;
    var cab = B.MeshBuilder.CreateBox('tc', { width: 2, height: 1.6, depth: 1.6 }, scene);
    cab.position.set(0, 1.2, 2.6); cab.material = pbr('#c2ccda', 0.7, 0.3); cab.parent = root; cast(cab);
    var stripe = B.MeshBuilder.CreateBox('ts', { width: 2.24, height: 0.42, depth: 5.04 }, scene);
    stripe.position.set(0, 2.2, -0.6); stripe.material = emiss('#2dd4bf', 0.8); stripe.parent = root;
    var wmat = pbr('#0e1116', 0.1, 0.85);
    [[-1.1, 2.4], [1.1, 2.4], [-1.1, -1.6], [1.1, -1.6], [-1.1, 0.4], [1.1, 0.4]].forEach(function (p, k) {
      var w = B.MeshBuilder.CreateCylinder('tw' + k, { diameter: 1, height: 0.4, tessellation: 14 }, scene);
      w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.5, p[1]); w.material = wmat; w.parent = root;
    });
    root.metadata = { state: 'idle', t: 0, payload: 0, po: 0, sku: '' }; root.setEnabled(false);
    R.trucks.push(root);
  }
}

// Crate pool sized so we can show committed-of-capacity.
function buildCratePool() {
  R.cratePool = [];
  var scene = R.scene;
  for (var i = 0; i < 64; i++) {
    var m = B.MeshBuilder.CreateBox('crate' + i, { size: 0.8 }, scene);
    m.material = pbr(CRATE_HEX.recv, 0.05, 0.6); cast(m); m.receiveShadows = true;
    m.setEnabled(false); m.metadata = { alive: false, state: 'recv' };
    R.cratePool.push(m);
  }
}
function setCrateColor(c, state) {
  var col = B.Color3.FromHexString(CRATE_HEX[state]);
  c.material.albedoColor = col; c.material.emissiveColor = col.scale(0.22);
}
function spawnCrate(pos, state) {
  var c = null;
  for (var i = 0; i < R.cratePool.length; i++) { if (!R.cratePool[i].metadata.alive) { c = R.cratePool[i]; break; } }
  if (!c) return null;
  c.metadata.alive = true; c.metadata.state = state; c.setEnabled(true);
  c.parent = null; setCrateColor(c, state); c.position.copyFrom(pos);
  return c;
}
function killCrate(c) { c.metadata.alive = false; c.parent = null; c.setEnabled(false); }

function stackPos(zone, n) {
  var perRow = 4, sp = 1.0;
  var layer = Math.floor(n / (perRow * perRow)), idx = n % (perRow * perRow);
  var r = Math.floor(idx / perRow), c = idx % perRow;
  return new B.Vector3(zone.x - (perRow - 1) * sp / 2 + c * sp, 0.85 + layer * 0.9, -(perRow - 1) * sp / 2 + r * sp);
}

// =====================================================================
// POST-PROCESSING PIPELINE (Tier-2)
// =====================================================================
function buildPipeline() {
  var scene = R.scene, camera = R.camera;
  var pipe = new B.DefaultRenderingPipeline('dp', true, scene, [camera]);
  pipe.fxaaEnabled = true;
  pipe.bloomEnabled = true; pipe.bloomThreshold = 0.62; pipe.bloomWeight = 0.6; pipe.bloomKernel = 64; pipe.bloomScale = 0.55;
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true;
  pipe.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipe.imageProcessing.exposure = 1.15; pipe.imageProcessing.contrast = 1.28;
  pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 2.6;
  pipe.grainEnabled = true; pipe.grain.intensity = 6; pipe.grain.animated = true;
  pipe.sharpenEnabled = true; pipe.sharpen.edgeAmount = 0.22; pipe.sharpen.colorAmount = 1.0;
  pipe.chromaticAberrationEnabled = true; pipe.chromaticAberration.aberrationAmount = 10;
  R.pipe = pipe;
  try {
    var ssao = new B.SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.75, blurRatio: 1 }, [camera]);
    ssao.radius = 1.7; ssao.totalStrength = 1.05; ssao.expensiveBlur = true; ssao.samples = 16; ssao.maxZ = 130; ssao.minZAspect = 0.25;
    R.ssao = ssao;
  } catch (e) { R.ssao = null; }
}
function toggleFX() {
  SIM.fxOn = !SIM.fxOn;
  var p = R.pipe;
  p.bloomEnabled = SIM.fxOn; p.grainEnabled = SIM.fxOn; p.chromaticAberrationEnabled = SIM.fxOn;
  p.imageProcessing.vignetteEnabled = SIM.fxOn; p.sharpenEnabled = SIM.fxOn;
  if (R.ssao) {
    R.scene.postProcessRenderPipelineManager[SIM.fxOn ? 'attachCamerasToRenderPipeline' : 'detachCamerasFromRenderPipeline']('ssao', R.camera);
  }
  byid('tw-fx').classList.toggle('on', SIM.fxOn);
  R.glow.intensity = SIM.fxOn ? 0.85 : 0.4;
}

// =====================================================================
// SYNC — bind the scene to the REAL model. Called on load + every refresh.
// =====================================================================
function sync(RAW) {
  if (!RAW) return;
  R.data = RAW;
  var cf = RAW.capFlow || {};
  SIM.capacity = +cf.capacity || 0;
  SIM.committed = +cf.committed || 0;
  SIM.onHand = +cf.on_hand || 0;
  SIM.inbound = +cf.inbound || 0;
  SIM.freeToOrder = +cf.free_to_order || 0;
  SIM.committedPct = +cf.committed_pct || (SIM.capacity ? SIM.committed / SIM.capacity : 0);
  SIM.dailyIn = +cf.daily_in || 0;
  SIM.dailyOut = +cf.daily_out || 0;
  SIM.daysToDepletion = +cf.days_to_depletion || 0;

  var tco = RAW.tcoClasses || [];
  SIM.deployed = tco.reduce(function (s, x) { return s + (+x.assets || 0); }, 0);

  SIM.inboundQueue = (RAW.inv || []).filter(function (x) { return x.on_order > 0; })
    .map(function (x) { return { sku: x.name, units: x.on_order, eta: x.eta }; });

  rebuildWarehouseStack();
  rebuildRacks();
  seedLog(RAW);
  updateHUD();
}

// crates shown ∝ warehouse max capacity:  fill = committed / capacity
function rebuildWarehouseStack() {
  R.wareStack.forEach(function (c) { killCrate(c); });
  R.wareStack = [];
  var slots = R.cratePool.length;
  var fill = SIM.capacity ? SIM.committed / SIM.capacity : 0;
  var show = Math.max(0, Math.min(slots, Math.round(fill * slots)));
  for (var i = 0; i < show; i++) {
    var c = spawnCrate(stackPos(Z.WAREHOUSE, i), 'store');
    if (c) { c.metadata.state = 'store'; R.wareStack.push(c); }
  }
}
function rebuildRacks() {
  var div = ddiv();
  var lit = Math.max(0, Math.min(R.rackSlots.length, Math.round(SIM.deployed / div)));
  for (var i = 0; i < R.rackSlots.length; i++) {
    var on = i < lit, r = R.rackSlots[i];
    r.active = on; r.age = on ? r.age : 0;
    r.mesh.material.emissiveColor = on ? B.Color3.FromHexString('#0e3a34') : B.Color3.Black();
    r.mesh.material.emissiveIntensity = on ? 0.7 : 0;
    r.led.material.emissiveColor = B.Color3.FromHexString(on ? '#2dd4bf' : '#22303f');
  }
}
function ddiv() { return Math.max(1, Math.ceil(SIM.deployed / R.rackSlots.length)); }

// =====================================================================
// HUD (DOM overlay built inside the container, scoped .tw- classes)
// =====================================================================
function buildHUD() {
  var h = document.createElement('div');
  h.className = 'tower-hud';
  h.innerHTML =
    '<div class="tw-panel tw-glow" id="tw-title">' +
      '<div class="tw-kicker">SCM-MASTER · LIVE OPS<span class="tw-badge">BABYLON · PBR</span></div>' +
      '<h1>Logistics Control Tower</h1>' +
      '<div class="tw-sub">State is real, from <code>/api/v1</code>; forklift motion illustrates the pipeline. PBR · bloom · SSAO.</div>' +
      '<div class="tw-clock"><span class="tw-pulse"></span> AS OF <b id="tw-asof">—</b></div>' +
    '</div>' +
    '<div class="tw-panel" id="tw-stats">' +
      '<div class="tw-stat"><div class="tw-lab">Committed units</div><div class="tw-val" id="tw-recv" style="color:#f5a524">0</div></div>' +
      '<div class="tw-stat"><div class="tw-lab">Deployed assets</div><div class="tw-val" id="tw-dep" style="color:#2dd4bf">0</div></div>' +
      '<div class="tw-stat"><div class="tw-lab">Inbound (on order)</div><div class="tw-val" id="tw-tr" style="color:#4aa3ff">0</div></div>' +
      '<div class="tw-stat"><div class="tw-lab">Free to order</div><div class="tw-val" id="tw-free" style="color:#3ddc84">0</div></div>' +
      '<div class="tw-cap tw-stat" id="tw-capbox">' +
        '<div class="tw-row"><span class="tw-lab">Warehouse capacity</span><span class="tw-val" id="tw-cap" style="font-size:14px">0%</span></div>' +
        '<div class="tw-bartrack"><div class="tw-barfill" id="tw-capbar"></div></div>' +
        '<div class="tw-guard" id="tw-guard">over-order guard: armed</div>' +
      '</div>' +
    '</div>' +
    '<div class="tw-panel" id="tw-legend">' +
      '<div class="tw-h">Lifecycle state</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#3ddc84;color:#3ddc84"></span>Received / inbound</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#f5a524;color:#f5a524"></span>In storage (warehouse)</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#4aa3ff;color:#4aa3ff"></span>Packed (rack bundle)</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#2dd4bf;color:#2dd4bf"></span>Deployed (datacenter)</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#ff5d5d;color:#ff5d5d"></span>Decommissioned</div>' +
    '</div>' +
    '<div class="tw-panel" id="tw-log">' +
      '<div class="tw-h"><span>Event stream</span><span style="color:#586478">live findings</span></div>' +
      '<div id="tw-logfeed"></div>' +
    '</div>' +
    '<div class="tw-panel" id="tw-controls">' +
      '<button class="tw-btn" id="tw-play">⏸ Pause</button>' +
      '<div class="tw-sepv"></div>' +
      '<button class="tw-btn on" id="tw-1">1×</button>' +
      '<button class="tw-btn" id="tw-2">2×</button>' +
      '<button class="tw-btn" id="tw-4">4×</button>' +
      '<div class="tw-sepv"></div>' +
      '<button class="tw-btn on" id="tw-orbit">⟲ Auto-orbit</button>' +
      '<button class="tw-btn on" id="tw-fx">✦ FX</button>' +
      '<button class="tw-btn" id="tw-camrst">⌖ Reset view</button>' +
    '</div>' +
    '<div id="tw-tags"></div>';
  R.container.appendChild(h);
  R.hud = h;
  R.tagLayer = h.querySelector('#tw-tags');

  byid('tw-play').onclick = function () { SIM.playing = !SIM.playing; byid('tw-play').textContent = SIM.playing ? '⏸ Pause' : '▶ Play'; };
  function spd(s, id) { SIM.speed = s; ['tw-1', 'tw-2', 'tw-4'].forEach(function (b) { byid(b).classList.remove('on'); }); byid(id).classList.add('on'); }
  byid('tw-1').onclick = function () { spd(1, 'tw-1'); };
  byid('tw-2').onclick = function () { spd(2, 'tw-2'); };
  byid('tw-4').onclick = function () { spd(4, 'tw-4'); };
  byid('tw-orbit').onclick = function () {
    R.camera.useAutoRotationBehavior = !R.camera.useAutoRotationBehavior;
    if (R.camera.useAutoRotationBehavior) R.camera.autoRotationBehavior.idleRotationSpeed = 0.16;
    byid('tw-orbit').classList.toggle('on', R.camera.useAutoRotationBehavior);
  };
  byid('tw-fx').onclick = toggleFX;
  byid('tw-camrst').onclick = function () {
    R.camera.alpha = Math.PI * 1.15; R.camera.beta = 1.02; R.camera.radius = 52;
    R.camera.setTarget(new B.Vector3(2, 1.5, 1));
  };
}
function byid(id) { return R.hud ? R.hud.querySelector('#' + id) : null; }

function updateHUD() {
  if (!R.hud) return;
  var asof = (R.data && R.data.capFlow && R.data.capFlow.as_of) || '—';
  byid('tw-asof').textContent = asof;
  byid('tw-recv').textContent = SIM.committed;
  byid('tw-dep').textContent = SIM.deployed;
  byid('tw-tr').textContent = SIM.inbound;
  byid('tw-free').textContent = SIM.freeToOrder;
  var p = Math.round(SIM.committedPct * 100);
  byid('tw-cap').textContent = p + '%';
  byid('tw-capbar').style.width = Math.min(100, p) + '%';
  var box = byid('tw-capbox');
  if (p >= 85) { box.classList.add('full'); byid('tw-guard').textContent = 'over-order guard: ENGAGED'; }
  else { box.classList.remove('full'); byid('tw-guard').textContent = 'over-order guard: armed · ' + SIM.freeToOrder + ' free'; }
}

var SEV_CLS = { action: 'bad', watch: 'warn', good: 'ok', info: 'dc' };
function seedLog(RAW) {
  var feed = byid('tw-logfeed'); if (!feed) return;
  feed.innerHTML = '';
  logLine('control tower online · ' + SIM.committed + '/' + SIM.capacity + ' units committed', 'dc');
  (RAW.ruleIns || []).slice(0, 6).forEach(function (r) {
    logLine(decode(r.title), SEV_CLS[r.severity] || 'ai');
  });
}
function logLine(msg, cls) {
  var feed = byid('tw-logfeed'); if (!feed) return;
  var el = document.createElement('div'); el.className = 'tw-lg ' + (cls || '');
  el.innerHTML = '<span class="tw-t">' + String(SIM.tick).padStart(4, '0') + '</span><span class="tw-m">' + msg + '</span>';
  feed.appendChild(el);
  while (feed.children.length > 11) feed.removeChild(feed.firstChild);
}
function decode(s) {
  if (!s) return '';
  return String(s).replace(/â‚¬/g, '€').replace(/â€”/g, '—').replace(/Ã—/g, '×').replace(/â‰¥/g, '≥');
}

// =====================================================================
// WORLD-PROJECTED TAGS
// =====================================================================
function worldTag(v, text, cls) {
  if (!R.tagLayer) return;
  var el = document.createElement('div'); el.className = 'tw-tag ' + cls; el.textContent = text;
  el._v = v.clone(); R.tagLayer.appendChild(el);
  setTimeout(function () { el.remove(); }, 3100);
}
function projectTags() {
  if (!R.tagLayer) return;
  var w = W(), h = H();
  var id = B.Matrix.Identity(), tm = R.scene.getTransformMatrix(), vp = R.camera.viewport.toGlobal(w, h);
  for (var i = 0; i < R.tagLayer.children.length; i++) {
    var el = R.tagLayer.children[i];
    if (!el._v) continue;
    var p = B.Vector3.Project(el._v, id, tm, vp);
    if (p.z < 0 || p.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = 'block'; el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  }
}

// =====================================================================
// JOB SYSTEM + MOVEMENT (illustrative motion, timed off real rates)
// =====================================================================
function addJob(j) { R.jobs.push(j); }
function assignJobs() {
  for (var i = 0; i < R.workers.length; i++) {
    var w = R.workers[i];
    if (w.metadata.state !== 'idle') continue;
    var best = null, bd = 1e9;
    for (var k = 0; k < R.jobs.length; k++) {
      var j = R.jobs[k]; if (j.taken) continue;
      var d = B.Vector3.Distance(w.position, j.from); if (d < bd) { bd = d; best = j; }
    }
    if (best) { best.taken = true; w.metadata.job = best; w.metadata.state = 'toPickup'; }
  }
}
function moveToward(w, target, dt, speed) {
  var dx = target.x - w.position.x, dz = target.z - w.position.z;
  var dist = Math.hypot(dx, dz); if (dist < 0.12) return true;
  var ix = dx / dist, iz = dz / dist;
  var desired = Math.atan2(ix, iz), dy = desired - w.rotation.y;
  while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  w.rotation.y += dy * Math.min(1, dt * 6);
  var step = Math.min(dist, speed * dt); w.position.x += ix * step; w.position.z += iz * step;
  return false;
}
function workerTick(dt) {
  for (var i = 0; i < R.workers.length; i++) {
    var w = R.workers[i], u = w.metadata;
    u.wob += dt * 4; w.position.y = Math.sin(u.wob) * 0.03;
    if (u.state === 'idle') {
      u.led.emissiveColor = B.Color3.FromHexString('#2dd4bf'); u.led.emissiveIntensity = 1.0 + Math.sin(u.wob) * 0.4;
      moveToward(w, new B.Vector3(w.position.x, 0, 11.5), dt, 2.2);
      continue;
    }
    u.led.emissiveColor = B.Color3.FromHexString('#f5a524'); u.led.emissiveIntensity = 1.3;
    var j = u.job; if (!j) { u.state = 'idle'; continue; }
    if (u.state === 'toPickup') {
      if (moveToward(w, j.from, dt, 4.2)) {
        if (j.crate && j.crate.metadata.alive) { u.carry = j.crate; j.crate.parent = u.forkPt; j.crate.position.set(0, 0, 0); }
        u.state = 'toDrop';
      }
    } else if (u.state === 'toDrop') {
      if (moveToward(w, j.to, dt, 3.6)) {
        if (u.carry) { u.carry.parent = null; u.carry.position.copyFrom(j.to); u.carry = null; }
        var idx = R.jobs.indexOf(j); if (idx >= 0) R.jobs.splice(idx, 1);
        if (j.onDone) j.onDone();
        u.job = null; u.state = 'idle';
      }
    }
  }
}

// ---- inbound trucks: animate REAL on-order POs. Over-capacity is REFUSED.
function truckTick(dt) {
  SIM.truckTimer -= dt;
  if (SIM.truckTimer <= 0) {
    var free = null; for (var i = 0; i < R.trucks.length; i++) { if (R.trucks[i].metadata.state === 'idle') { free = R.trucks[i]; break; } }
    if (free && SIM.inboundQueue.length) {
      var po = SIM.inboundQueue.shift(); SIM.inboundQueue.push(po);
      if (SIM.committed >= SIM.capacity) {
        worldTag(new B.Vector3(Z.RECEIVE.x, 4.6, 4), 'CAP ' + Math.round(SIM.committedPct * 100) + '% · INBOUND REFUSED', 'refuse');
        logLine('over-order guard: PO refused @ ' + Math.round(SIM.committedPct * 100) + '% capacity', 'bad');
        SIM.truckTimer = 4;
      } else {
        var u = free.metadata; u.state = 'arriving'; u.t = 0; u.po = reqId(); u.sku = po.sku;
        u.payload = Math.max(1, Math.min(4, po.units));
        free.setEnabled(true); free.position.set(-46, 0, 6); free.rotation.y = Math.PI / 2;
        logLine('PO inbound · ' + po.units + '× ' + po.sku + (po.eta ? ' (ETA ' + po.eta + ')' : ''), 'ok');
        SIM.truckTimer = Math.max(3, 9 - SIM.dailyIn * 0.25);
      }
    } else { SIM.truckTimer = 2; }
  }
  for (var k = 0; k < R.trucks.length; k++) updateTruck(R.trucks[k], dt);
}
function updateTruck(t, dt) {
  var u = t.metadata; if (u.state === 'idle') return;
  var dockX = Z.RECEIVE.x - 1;
  if (u.state === 'arriving') {
    t.position.x += dt * 7;
    if (t.position.x >= dockX) { t.position.x = dockX; u.state = 'unload'; u.t = 0; }
  } else if (u.state === 'unload') {
    u.t += dt;
    if (u.t > 0.9) {
      var c = spawnCrate(new B.Vector3(dockX + 1.5, 1, 3 + (u.payload % 2)), 'recv');
      if (c) {
        var slot = R.wareStack.length;
        addJob({
          from: c.position.clone(), to: stackPos(Z.WAREHOUSE, slot), crate: c,
          onDone: function () { c.metadata.state = 'store'; setCrateColor(c, 'store'); R.wareStack.push(c); }
        });
      }
      u.payload--; u.t = 0;
      if (u.payload <= 0) u.state = 'leaving';
    }
  } else if (u.state === 'leaving') {
    t.position.x += dt * 8;
    if (t.position.x > 42) { u.state = 'idle'; t.setEnabled(false); }
  }
}

// ---- requisition run through the AI confidence gate (same 0.85 floor as the agent)
function requisitionTick(dt) {
  SIM.reqTimer -= dt;
  if (SIM.reqTimer > 0) return;
  SIM.reqTimer = 3.5 + (SIM.t % 2.5);
  if (R.wareStack.length < 2) return;
  var freeRack = null; for (var i = 0; i < R.rackSlots.length; i++) { if (!R.rackSlots[i].active) { freeRack = R.rackSlots[i]; break; } }
  if (!freeRack) return;
  var conf = +(0.62 + ((SIM.t * 53) % 100) / 100 * 0.37).toFixed(2), pr = reqId();
  if (conf < 0.85) {
    worldTag(new B.Vector3(Z.PACKING.x, 4.9, 4), 'PR-' + pr + ' conf ' + conf + ' < 0.85 · ESCALATE', 'refuse');
    logLine('agent: PR-' + pr + ' conf ' + conf + ' < floor → human approval', 'ai');
    return;
  }
  worldTag(new B.Vector3(Z.PACKING.x, 4.9, 4), 'PR-' + pr + ' conf ' + conf + ' ≥ 0.85 · AUTO-PO', 'ai');
  logLine('agent: PR-' + pr + ' auto-placed (conf ' + conf + ')', 'ai');
  var c = R.wareStack.shift(); freeRack.active = 'pending';
  addJob({
    from: c.position.clone(), to: new B.Vector3(Z.PACKING.x, 1, 0), crate: c,
    onDone: function () {
      c.metadata.state = 'pack'; setCrateColor(c, 'pack');
      addJob({
        from: c.position.clone(), to: new B.Vector3(freeRack.pos.x, 1, freeRack.pos.z), crate: c,
        onDone: function () {
          killCrate(c); freeRack.active = true; freeRack.age = 0;
          freeRack.mesh.material.emissiveColor = B.Color3.FromHexString('#0e3a34'); freeRack.mesh.material.emissiveIntensity = 0.7;
          freeRack.led.material.emissiveColor = B.Color3.FromHexString('#2dd4bf');
          worldTag(new B.Vector3(freeRack.pos.x, 3.4, freeRack.pos.z), 'DEPLOYED', 'deploy');
          logLine('asset deployed → rack online', 'dc');
          refillStack();
        }
      });
    }
  });
}
function refillStack() {
  var slots = R.cratePool.length;
  var target = Math.round((SIM.capacity ? SIM.committed / SIM.capacity : 0) * slots);
  if (R.wareStack.length < target) {
    var c = spawnCrate(stackPos(Z.WAREHOUSE, R.wareStack.length), 'store');
    if (c) { c.metadata.state = 'store'; R.wareStack.push(c); }
  }
}

// ---- decommission: an aged rack is pulled to disposal (EOL lifecycle)
function decommissionTick(dt) {
  SIM.decomTimer -= dt;
  for (var i = 0; i < R.rackSlots.length; i++) { if (R.rackSlots[i].active === true) R.rackSlots[i].age += dt; }
  if (SIM.decomTimer > 0) return;
  SIM.decomTimer = 11 + (SIM.t % 8);
  var old = null, oldest = 10;
  for (var k = 0; k < R.rackSlots.length; k++) {
    var r = R.rackSlots[k];
    if (r.active === true && r.age > oldest) { oldest = r.age; old = r; }
  }
  if (!old) return;
  old.active = 'pulling';
  var c = spawnCrate(new B.Vector3(old.pos.x, 1, old.pos.z), 'dead'); if (!c) { old.active = true; return; }
  logLine('lifecycle: rack EOL → decommission', 'warn');
  addJob({
    from: c.position.clone(), to: new B.Vector3(Z.DISPOSAL.x, 1, 0), crate: c,
    onDone: function () {
      killCrate(c);
      old.active = false; old.age = 0;
      old.mesh.material.emissiveColor = B.Color3.Black(); old.mesh.material.emissiveIntensity = 0;
      old.led.material.emissiveColor = B.Color3.FromHexString('#22303f');
      logLine('asset disposed · provenance logged', 'bad');
    }
  });
}

// =====================================================================
// MAIN LOOP
// =====================================================================
function frame() {
  var dt = Math.min(0.05, R.engine.getDeltaTime() / 1000);
  if (SIM.playing) {
    var sdt = dt * SIM.speed; SIM.t += sdt; SIM.tickAcc += sdt;
    while (SIM.tickAcc >= 0.25) { SIM.tickAcc -= 0.25; SIM.tick++; }
    truckTick(sdt); requisitionTick(sdt); decommissionTick(sdt);
    assignJobs(); workerTick(sdt);
    for (var i = 0; i < R.rackSlots.length; i++) {
      var r = R.rackSlots[i];
      if (r.active === true) r.led.material.emissiveIntensity = 1.0 + Math.sin(SIM.t * 3 + r.pos.x) * 0.5;
    }
  }
  projectTags();
}

// =====================================================================
// PUBLIC API
// =====================================================================
function mount(container) {
  if (R.mounted) return;
  R.container = container;
  matN = 0;
  build();
  buildHUD();
  if (R.data) sync(R.data);
  R.scene.registerBeforeRender(frame);
  R.engine.runRenderLoop(function () { R.scene.render(); });
  R._onResize = function () { if (R.engine) R.engine.resize(); };
  window.addEventListener('resize', R._onResize);
  R.mounted = true;
}
function unmount() {
  if (!R.mounted) return;
  if (R._onResize) { window.removeEventListener('resize', R._onResize); R._onResize = null; }
  try { R.engine.stopRenderLoop(); } catch (e) {}
  try { R.scene.dispose(); } catch (e) {}
  try { R.engine.dispose(); } catch (e) {}
  if (R.canvas && R.canvas.parentNode) R.canvas.parentNode.removeChild(R.canvas);
  if (R.hud && R.hud.parentNode) R.hud.parentNode.removeChild(R.hud);
  R.engine = null; R.scene = null; R.camera = null; R.glow = null; R.shadow = null;
  R.pipe = null; R.ssao = null; R.hud = null; R.tagLayer = null; R.canvas = null;
  R.workers = []; R.trucks = []; R.cratePool = []; R.rackSlots = []; R.wareStack = []; R.jobs = [];
  R.mounted = false;
}

window.SCMTower = {
  mount: mount,
  unmount: unmount,
  sync: function (RAW) { R.data = RAW; if (R.mounted) sync(RAW); },
  isMounted: function () { return R.mounted; },
};

})();
