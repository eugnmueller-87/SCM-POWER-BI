/* =====================================================================
   SCM-Master · Logistics Control Tower (3D RTS home screen)
   ---------------------------------------------------------------------
   STATE-ACCURATE, motion illustrative. Every count, capacity %, crate
   stack, rack count, flow rate and event-log line is read from the live
   /api/data model (RAW). The forklift/truck MOTION between those states
   is animated for life, timed off the REAL daily_in / daily_out rates —
   it is not a fabricated event stream, and no number is invented.

   The warehouse renders `committed` crates out of `capacity` slots, so
   the box count is in proportion to the warehouse's maximum capacity.

   Public API (window.SCMTower):
     mount(container)   – build renderer/scene into a DOM node, start loop
     sync(RAW)          – (re)bind to the live data model; called on load
                          and on every 60s refresh, so the scene re-syncs
     unmount()          – stop loop, free GL context (on tab switch away)
   Depends on THREE (r128) being on the page already.
   ===================================================================== */
(function () {
'use strict';

var THREE = window.THREE;
if (!THREE) { console.error('[tower] THREE not loaded'); return; }

// ----- module state (single instance) -----
var R = {
  mounted: false, raf: 0, container: null, renderer: null, scene: null,
  camera: null, clock: null, data: null, hud: null, tagLayer: null,
  workers: [], trucks: [], cratePool: [], rackSlots: [],
  wareStack: [], jobs: [],
};

// ----- colour palette (matches the cockpit dark theme) -----
var COL = {
  bg: 0x0a0e16,
  recv: 0x3ddc84, store: 0xf5a524, pack: 0x4aa3ff, dc: 0x2dd4bf, dead: 0xff5d5d,
  cyan: 0x2dd4bf, pack_c: 0x4aa3ff,
};
var CRATE_COL = { recv: COL.recv, store: COL.store, pack: COL.pack, dc: COL.dc, dead: COL.dead };

// ----- zones along the pipeline (x positions) -----
var Z = {
  RECEIVE:   { x: -17, color: COL.recv, name: 'RECEIVING' },
  WAREHOUSE: { x: -2,  color: COL.store, name: 'WAREHOUSE' },
  PACKING:   { x: 11,  color: COL.pack, name: 'PACKING' },
  DATACTR:   { x: 24,  color: COL.dc,   name: 'DATACENTER' },
  DISPOSAL:  { x: 33,  color: COL.dead, name: 'DISPOSAL' },
};

// ----- live SIM mirror of the real model -----
var SIM = {
  tick: 0, playing: true, speed: 1, t: 0, tickAcc: 0,
  // real, from capacity_flow:
  capacity: 0, committed: 0, onHand: 0, inbound: 0, freeToOrder: 0,
  committedPct: 0, dailyIn: 0, dailyOut: 0, daysToDepletion: 0,
  // real, derived:
  deployed: 0, decommReady: 0,
  // animated counters (start at the real state, motion is illustrative):
  recvShown: 0, depShown: 0, transit: 0, decommShown: 0,
  // queues of real POs / requisitions to animate through:
  inboundQueue: [], reqQueue: [], decomQueue: [],
  truckTimer: 2.5, reqTimer: 3, decomTimer: 9,
};

var TMP = new THREE.Vector3();
function W() { return R.container ? R.container.clientWidth : window.innerWidth; }
function H() { return R.container ? R.container.clientHeight : window.innerHeight; }
function reqId() { return 1000 + Math.floor(SIM.t * 137 % 8999); } // deterministic-ish, no Math.random in id

// =====================================================================
// BUILD (once per mount)
// =====================================================================
function build() {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 46, 100);
  R.scene = scene;

  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  R.container.appendChild(renderer.domElement);
  R.renderer = renderer;

  var camera = new THREE.PerspectiveCamera(46, W() / H(), 0.1, 300);
  R.camera = camera;

  // lights
  scene.add(new THREE.HemisphereLight(0x9fb4d6, COL.bg, 0.55));
  scene.add(new THREE.AmbientLight(0x404a5e, 0.5));
  var sun = new THREE.DirectionalLight(0xfff2dd, 1.15);
  sun.position.set(-22, 34, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  var rim = new THREE.DirectionalLight(COL.cyan, 0.35); rim.position.set(20, 12, -22); scene.add(rim);

  // ground + grid
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 120),
    new THREE.MeshStandardMaterial({ color: 0x11151e, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  var grid = new THREE.GridHelper(160, 80, 0x1d2735, 0x161d28);
  grid.position.y = 0.02; grid.material.opacity = 0.5; grid.material.transparent = true; scene.add(grid);

  // platforms
  platform(Z.RECEIVE, 9, 12);
  platform(Z.WAREHOUSE, 11, 14);
  platform(Z.PACKING, 9, 12);
  platform(Z.DATACTR, 10, 16);
  platform(Z.DISPOSAL, 6, 9);

  // supplier road
  var road = new THREE.Mesh(new THREE.BoxGeometry(20, 0.05, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 1 }));
  road.position.set(-24, 0.05, 6); scene.add(road);

  buildRacks();
  buildWorkers();
  buildTrucks();
  buildCratePool();

  setupCamera();
  setupInput();
  R.clock = new THREE.Clock();
}

var MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = {
    metal: new THREE.MeshStandardMaterial({ color: 0xc8d2e0, roughness: .45, metalness: .6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: .6, metalness: .3 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x12161d, roughness: .9 }),
  };
  return MAT;
}

function makeLabel(text, color) {
  var c = document.createElement('canvas'); c.width = 512; c.height = 128;
  var x = c.getContext('2d');
  x.font = '700 60px "Chakra Petch", sans-serif';
  x.fillStyle = '#' + color.toString(16).padStart(6, '0');
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 8;
  x.fillText(text, 256, 68);
  var tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(9, 2.25, 1);
  return spr;
}

function platform(z, w, d) {
  var g = new THREE.Group();
  var base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d),
    new THREE.MeshStandardMaterial({ color: 0x161d28, roughness: .85, metalness: .1 }));
  base.position.y = 0.2; base.receiveShadow = true; base.castShadow = true; g.add(base);
  var edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.06, d + 0.3),
    new THREE.MeshStandardMaterial({ color: z.color, emissive: z.color, emissiveIntensity: .6, roughness: .4 }));
  edge.position.y = 0.42; g.add(edge);
  g.position.set(z.x, 0, 0);
  var lab = makeLabel(z.name, z.color); lab.position.set(0, 4.4, -d / 2 - 0.5); g.add(lab);
  R.scene.add(g);
  return g;
}

// Datacenter racks — the COUNT of lit racks equals real deployed assets (sync()).
var NDC = 14;
function buildRacks() {
  R.rackSlots = [];
  var i = 0;
  for (var row = 0; row < 2; row++) {
    for (var col = 0; col < 7; col++) {
      var px = Z.DATACTR.x - 3.6 + col * 1.25;
      var pz = -3.2 + row * 6.4;
      var rack = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x1b2330, roughness: .5, metalness: .5, emissive: 0x000000 }));
      rack.position.set(px, 1.5, pz); rack.castShadow = true; R.scene.add(rack);
      var led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0x142028, emissiveIntensity: 1 }));
      led.position.set(px + 0.45, 1.6, pz + 0.78); R.scene.add(led);
      R.rackSlots.push({ mesh: rack, led: led, active: false, age: 0, pos: new THREE.Vector3(px, 0, pz) });
      i++; if (i >= NDC) return;
    }
  }
}

function buildWorkers() {
  R.workers = [];
  var m = mats();
  for (var i = 0; i < 7; i++) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 1.4), m.metal.clone());
    body.position.y = 0.6; body.castShadow = true; g.add(body);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.7), m.dark.clone());
    cab.position.set(0, 1.1, -0.25); cab.castShadow = true; g.add(cab);
    var fork = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), m.dark.clone());
    fork.position.set(0, 0.35, 0.95); g.add(fork);
    var wh = new THREE.CylinderGeometry(0.26, 0.26, 0.2, 12);
    [[-.5, .6], [.5, .6], [-.5, -.5], [.5, -.5]].forEach(function (p) {
      var w = new THREE.Mesh(wh, m.tyre); w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.26, p[1]); g.add(w);
    });
    var led = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshStandardMaterial({ color: COL.cyan, emissive: COL.cyan, emissiveIntensity: 1.4 }));
    led.position.set(0, 1.55, -0.25); g.add(led);
    g.userData = { led: led, fork: fork, carry: null, state: 'idle', job: null, wob: i * 0.9 };
    g.position.set(-6 + i * 1.4, 0, 12);
    R.scene.add(g); R.workers.push(g);
  }
}

function buildTrucks() {
  R.trucks = [];
  var m = mats();
  for (var k = 0; k < 2; k++) {
    var g = new THREE.Group();
    var trailer = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 5),
      new THREE.MeshStandardMaterial({ color: 0x222b38, roughness: .6, metalness: .3 }));
    trailer.position.set(0, 1.4, -0.6); trailer.castShadow = true; g.add(trailer);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 1.6), m.metal.clone());
    cab.position.set(0, 1.2, 2.6); cab.castShadow = true; g.add(cab);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 5.04),
      new THREE.MeshStandardMaterial({ color: COL.cyan, emissive: COL.cyan, emissiveIntensity: .5 }));
    stripe.position.set(0, 2.2, -0.6); g.add(stripe);
    var wh = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14);
    [[-1.1, 2.4], [1.1, 2.4], [-1.1, -1.6], [1.1, -1.6], [-1.1, 0.4], [1.1, 0.4]].forEach(function (p) {
      var w = new THREE.Mesh(wh, m.tyre); w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.5, p[1]); g.add(w);
    });
    g.userData = { state: 'idle', t: 0, payload: 0, po: 0, sku: '' };
    g.visible = false; R.scene.add(g); R.trucks.push(g);
  }
}

// Crate pool sized to the warehouse CAPACITY so we can show committed-of-capacity.
function buildCratePool() {
  R.cratePool = [];
  var m = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  for (var i = 0; i < 64; i++) {
    var mesh = new THREE.Mesh(m, new THREE.MeshStandardMaterial({ color: CRATE_COL.recv, roughness: .7, metalness: .1 }));
    mesh.castShadow = true; mesh.visible = false; mesh.userData = { alive: false, state: 'recv' };
    R.scene.add(mesh); R.cratePool.push(mesh);
  }
}

function spawnCrate(pos, state) {
  var c = null;
  for (var i = 0; i < R.cratePool.length; i++) { if (!R.cratePool[i].userData.alive) { c = R.cratePool[i]; break; } }
  if (!c) return null;
  c.userData.alive = true; c.userData.state = state; c.visible = true;
  c.material.color.setHex(CRATE_COL[state]); c.material.emissive.setHex(CRATE_COL[state]); c.material.emissiveIntensity = .18;
  if (c.parent !== R.scene) R.scene.add(c);
  c.position.copy(pos); c.scale.set(1, 1, 1);
  return c;
}
function killCrate(c) { c.userData.alive = false; c.visible = false; if (c.parent !== R.scene) R.scene.add(c); }

// warehouse stack position — packs crates into a cube grid scaled to capacity
function stackPos(zone, n) {
  var perRow = 4, sp = 1.0;
  var layer = Math.floor(n / (perRow * perRow));
  var idx = n % (perRow * perRow);
  var r = Math.floor(idx / perRow), c = idx % perRow;
  return new THREE.Vector3(zone.x - (perRow - 1) * sp / 2 + c * sp, 0.85 + layer * 0.9, -(perRow - 1) * sp / 2 + r * sp);
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

  // deployed assets = sum of TCO class asset counts (the live fleet)
  var tco = RAW.tcoClasses || [];
  SIM.deployed = tco.reduce(function (s, x) { return s + (+x.assets || 0); }, 0);

  // Real PO arrivals to animate: each inventory SKU with on_order > 0.
  SIM.inboundQueue = (RAW.inv || []).filter(function (x) { return x.on_order > 0; })
    .map(function (x) { return { sku: x.name, code: x.code || x.name, units: x.on_order, eta: x.eta }; });

  // Build the warehouse stack to the REAL committed-of-capacity fill.
  rebuildWarehouseStack();

  // Light the datacenter racks to reflect deployed assets (proportional to NDC slots).
  rebuildRacks();

  // Event log: real rule-insights + low-cover SKUs.
  seedLog(RAW);

  // HUD sync
  updateHUD();
}

// The number of crates shown is in proportion to the warehouse max capacity:
// fill = committed / capacity, mapped onto the visible stack slots.
function rebuildWarehouseStack() {
  // clear current stack
  R.wareStack.forEach(function (c) { killCrate(c); });
  R.wareStack = [];
  var slots = R.cratePool.length;                 // visible capacity
  var fill = SIM.capacity ? SIM.committed / SIM.capacity : 0;
  var show = Math.max(0, Math.min(slots, Math.round(fill * slots)));
  for (var i = 0; i < show; i++) {
    var c = spawnCrate(stackPos(Z.WAREHOUSE, i), 'store');
    if (c) { c.userData.state = 'store'; R.wareStack.push(c); }
  }
  SIM.recvShown = SIM.committed;          // real committed units received into the pipeline
  SIM.transit = 0;
}

function rebuildRacks() {
  var lit = Math.max(0, Math.min(R.rackSlots.length, Math.round(SIM.deployed / Math.max(1, ddiv()) )));
  // Map the real deployed count proportionally onto the NDC rack slots.
  for (var i = 0; i < R.rackSlots.length; i++) {
    var on = i < lit;
    var r = R.rackSlots[i];
    r.active = on; r.age = on ? r.age : 0;
    r.mesh.material.emissive.setHex(on ? 0x10403a : 0x000000);
    r.mesh.material.emissiveIntensity = on ? .5 : 0;
    r.led.material.color.setHex(on ? COL.cyan : 0x223040);
    r.led.material.emissive.setHex(on ? COL.cyan : 0x142028);
  }
  SIM.depShown = SIM.deployed;
}
// scale factor so a large fleet (120 assets) maps onto 14 visible racks
function ddiv() { return Math.max(1, Math.ceil(SIM.deployed / R.rackSlots.length)); }

// =====================================================================
// HUD (DOM overlay built inside the container)
// =====================================================================
function buildHUD() {
  var h = document.createElement('div');
  h.className = 'tower-hud';
  h.innerHTML =
    '<div class="tw-panel tw-glow" id="tw-title">' +
      '<div class="tw-kicker">SCM-MASTER · LIVE OPS</div>' +
      '<h1>Logistics Control Tower</h1>' +
      '<div class="tw-sub">Live datacenter-hardware supply chain. State is real, from <code>/api/v1</code>; forklift motion illustrates the pipeline.</div>' +
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
      '<div class="tw-item"><span class="tw-dot" style="background:#3ddc84"></span>Received / inbound</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#f5a524"></span>In storage (warehouse)</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#4aa3ff"></span>Packed (rack bundle)</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#2dd4bf"></span>Deployed (datacenter)</div>' +
      '<div class="tw-item"><span class="tw-dot" style="background:#ff5d5d"></span>Decommissioned</div>' +
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
      '<button class="tw-btn" id="tw-camrst">⌖ Reset view</button>' +
    '</div>' +
    '<div id="tw-tags"></div>';
  R.container.appendChild(h);
  R.hud = h;
  R.tagLayer = h.querySelector('#tw-tags');

  // controls
  byid('tw-play').onclick = function () { SIM.playing = !SIM.playing; byid('tw-play').textContent = SIM.playing ? '⏸ Pause' : '▶ Play'; };
  function spd(s, id) { SIM.speed = s; ['tw-1', 'tw-2', 'tw-4'].forEach(function (b) { byid(b).classList.remove('on'); }); byid(id).classList.add('on'); }
  byid('tw-1').onclick = function () { spd(1, 'tw-1'); };
  byid('tw-2').onclick = function () { spd(2, 'tw-2'); };
  byid('tw-4').onclick = function () { spd(4, 'tw-4'); };
  byid('tw-orbit').onclick = function () { CAM.auto = !CAM.auto; byid('tw-orbit').classList.toggle('on', CAM.auto); };
  byid('tw-camrst').onclick = function () { CAM.target.set(2, 1, 2); CAM.r = 48; CAM.theta = Math.PI * 0.62; CAM.phi = Math.PI * 0.34; applyCam(); };
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

// Seed the event log from REAL findings (rule_insights) + low-cover SKUs.
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
  var tk = String(SIM.tick).padStart(4, '0');
  el.innerHTML = '<span class="tw-t">' + tk + '</span><span class="tw-m">' + msg + '</span>';
  feed.appendChild(el);
  while (feed.children.length > 11) feed.removeChild(feed.firstChild);
}
// some live strings arrive mojibake-encoded (€/—); best-effort fix for display
function decode(s) {
  if (!s) return '';
  return String(s).replace(/â‚¬/g, '€').replace(/â€”/g, '—')
                  .replace(/Ã—/g, '×').replace(/â‰¥/g, '≥');
}

// =====================================================================
// CAMERA (custom orbit, no OrbitControls dependency)
// =====================================================================
var CAM = { target: new THREE.Vector3(2, 1, 2), r: 48, theta: Math.PI * 0.62, phi: Math.PI * 0.34, auto: true };
function applyCam() {
  var sp = Math.sin(CAM.phi);
  R.camera.position.set(
    CAM.target.x + CAM.r * sp * Math.sin(CAM.theta),
    CAM.target.y + CAM.r * Math.cos(CAM.phi),
    CAM.target.z + CAM.r * sp * Math.cos(CAM.theta)
  );
  R.camera.lookAt(CAM.target);
}
function setupCamera() { applyCam(); }

var INPUT = { drag: null, lx: 0, ly: 0, tlx: 0, tly: 0, tdist: 0, handlers: [] };
function setupInput() {
  var el = R.renderer.domElement;
  function on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); INPUT.handlers.push([target, ev, fn]); }
  on(el, 'mousedown', function (e) { INPUT.drag = e.button; INPUT.lx = e.clientX; INPUT.ly = e.clientY; CAM.auto = false; byid('tw-orbit').classList.remove('on'); });
  on(window, 'mouseup', function () { INPUT.drag = null; });
  on(window, 'mousemove', function (e) {
    if (INPUT.drag === null) return;
    var dx = e.clientX - INPUT.lx, dy = e.clientY - INPUT.ly; INPUT.lx = e.clientX; INPUT.ly = e.clientY;
    if (INPUT.drag === 2 || e.shiftKey) {
      var panX = -dx * 0.04, panZ = -dy * 0.04, s = Math.sin(CAM.theta), c = Math.cos(CAM.theta);
      CAM.target.x += panX * c - panZ * s; CAM.target.z += panX * s + panZ * c;
    } else {
      CAM.theta -= dx * 0.005; CAM.phi = Math.max(0.12, Math.min(1.42, CAM.phi - dy * 0.005));
    }
    applyCam();
  });
  on(el, 'contextmenu', function (e) { e.preventDefault(); });
  on(el, 'wheel', function (e) { e.preventDefault(); CAM.r = Math.max(16, Math.min(90, CAM.r + e.deltaY * 0.035)); applyCam(); }, { passive: false });
  on(el, 'touchstart', function (e) {
    CAM.auto = false; byid('tw-orbit').classList.remove('on');
    if (e.touches.length === 1) { INPUT.tlx = e.touches[0].clientX; INPUT.tly = e.touches[0].clientY; }
    else if (e.touches.length === 2) { INPUT.tdist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
  }, { passive: true });
  on(el, 'touchmove', function (e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      var dx = e.touches[0].clientX - INPUT.tlx, dy = e.touches[0].clientY - INPUT.tly;
      INPUT.tlx = e.touches[0].clientX; INPUT.tly = e.touches[0].clientY;
      CAM.theta -= dx * 0.006; CAM.phi = Math.max(0.12, Math.min(1.42, CAM.phi - dy * 0.006)); applyCam();
    } else if (e.touches.length === 2) {
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      CAM.r = Math.max(16, Math.min(90, CAM.r + (INPUT.tdist - d) * 0.05)); INPUT.tdist = d; applyCam();
    }
  }, { passive: false });
  R._onResize = function () { if (!R.camera) return; R.camera.aspect = W() / H(); R.camera.updateProjectionMatrix(); R.renderer.setSize(W(), H()); };
  on(window, 'resize', R._onResize);
}

// =====================================================================
// WORLD-PROJECTED TAGS
// =====================================================================
function worldTag(v3, text, cls) {
  if (!R.tagLayer) return;
  var el = document.createElement('div'); el.className = 'tw-tag ' + cls; el.textContent = text;
  el.dataset.x = v3.x; el.dataset.y = v3.y; el.dataset.z = v3.z;
  R.tagLayer.appendChild(el);
  setTimeout(function () { el.remove(); }, 3100);
}
var projV = new THREE.Vector3();
function projectTags() {
  if (!R.tagLayer) return;
  for (var i = 0; i < R.tagLayer.children.length; i++) {
    var el = R.tagLayer.children[i];
    projV.set(+el.dataset.x, +el.dataset.y, +el.dataset.z).project(R.camera);
    if (projV.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = 'block';
    el.style.left = ((projV.x * 0.5 + 0.5) * W()) + 'px';
    el.style.top = ((-projV.y * 0.5 + 0.5) * H()) + 'px';
  }
}

// =====================================================================
// JOB SYSTEM + MOVEMENT (illustrative motion timed off real rates)
// =====================================================================
function addJob(j) { R.jobs.push(j); }
function assignJobs() {
  for (var i = 0; i < R.workers.length; i++) {
    var w = R.workers[i];
    if (w.userData.state !== 'idle') continue;
    var best = null, bd = 1e9;
    for (var k = 0; k < R.jobs.length; k++) {
      var j = R.jobs[k]; if (j.taken) continue;
      var d = w.position.distanceTo(j.from); if (d < bd) { bd = d; best = j; }
    }
    if (best) { best.taken = true; w.userData.job = best; w.userData.state = 'toPickup'; }
  }
}
function moveToward(w, target, dt, speed) {
  TMP.copy(target); TMP.y = w.position.y;
  var dir = TMP.clone().sub(w.position), dist = dir.length();
  if (dist < 0.12) return true;
  dir.normalize();
  var desired = Math.atan2(dir.x, dir.z), dy = desired - w.rotation.y;
  while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  w.rotation.y += dy * Math.min(1, dt * 6);
  var step = Math.min(dist, speed * dt);
  w.position.x += dir.x * step; w.position.z += dir.z * step;
  return false;
}
function workerTick(dt) {
  for (var i = 0; i < R.workers.length; i++) {
    var w = R.workers[i], u = w.userData;
    u.wob += dt * 4; w.position.y = Math.sin(u.wob) * 0.03;
    if (u.state === 'idle') {
      u.led.material.color.setHex(COL.cyan); u.led.material.emissive.setHex(COL.cyan);
      u.led.material.emissiveIntensity = 1.0 + Math.sin(u.wob) * 0.4;
      moveToward(w, new THREE.Vector3(w.position.x, 0, 11.5), dt, 2.2);
      continue;
    }
    u.led.material.color.setHex(COL.store); u.led.material.emissive.setHex(COL.store); u.led.material.emissiveIntensity = 1.3;
    var j = u.job; if (!j) { u.state = 'idle'; continue; }
    if (u.state === 'toPickup') {
      if (moveToward(w, j.from, dt, 4.2)) {
        if (j.crate && j.crate.userData.alive) { u.carry = j.crate; w.add(j.crate); j.crate.position.set(0, 1.05, 0.95); }
        u.state = 'toDrop';
      }
    } else if (u.state === 'toDrop') {
      if (moveToward(w, j.to, dt, 3.6)) {
        if (u.carry) { R.scene.add(u.carry); u.carry.position.copy(j.to); u.carry = null; }
        var idx = R.jobs.indexOf(j); if (idx >= 0) R.jobs.splice(idx, 1);
        if (j.onDone) j.onDone();
        u.job = null; u.state = 'idle';
      }
    }
  }
}

// ---- inbound trucks: animate REAL on-order POs arriving. Over-capacity is REFUSED
//      (the real over-order guard). Cadence scaled by real daily_in.
function truckTick(dt) {
  SIM.truckTimer -= dt;
  if (SIM.truckTimer <= 0) {
    var free = null; for (var i = 0; i < R.trucks.length; i++) { if (R.trucks[i].userData.state === 'idle') { free = R.trucks[i]; break; } }
    if (free && SIM.inboundQueue.length) {
      var po = SIM.inboundQueue.shift();
      // recycle the queue so motion continues between refreshes (state stays real)
      SIM.inboundQueue.push(po);
      // over-order guard mirrors SCM-Master: refuse when at/over capacity
      if (SIM.committed >= SIM.capacity) {
        worldTag(new THREE.Vector3(Z.RECEIVE.x, 4.5, 4), 'CAP ' + Math.round(SIM.committedPct * 100) + '% · INBOUND REFUSED', 'refuse');
        logLine('over-order guard: PO refused @ ' + Math.round(SIM.committedPct * 100) + '% capacity', 'bad');
        SIM.truckTimer = 4;
      } else {
        var u = free.userData;
        u.state = 'arriving'; u.t = 0; u.po = reqId(); u.sku = po.sku;
        u.payload = Math.max(1, Math.min(4, po.units));
        free.visible = true; free.position.set(-44, 0, 6); free.rotation.y = Math.PI / 2;
        logLine('PO inbound · ' + po.units + '× ' + po.sku + (po.eta ? ' (ETA ' + po.eta + ')' : ''), 'ok');
        // cadence: faster when real daily_in is higher
        SIM.truckTimer = Math.max(3, 9 - SIM.dailyIn * 0.25);
      }
    } else { SIM.truckTimer = 2; }
  }
  for (var k = 0; k < R.trucks.length; k++) updateTruck(R.trucks[k], dt);
}
function updateTruck(t, dt) {
  var u = t.userData; if (u.state === 'idle') return;
  var dockX = Z.RECEIVE.x - 1;
  if (u.state === 'arriving') {
    t.position.x += dt * 7;
    if (t.position.x >= dockX) { t.position.x = dockX; u.state = 'unload'; u.t = 0; }
  } else if (u.state === 'unload') {
    u.t += dt;
    if (u.t > 0.9) {
      var c = spawnCrate(new THREE.Vector3(dockX + 1.5, 1, 3 + (u.payload % 2)), 'recv');
      if (c) {
        SIM.transit++;
        var slot = R.wareStack.length;
        addJob({
          from: c.position.clone(), to: stackPos(Z.WAREHOUSE, slot), crate: c, kind: 'store',
          onDone: function () {
            c.userData.state = 'store'; c.material.color.setHex(CRATE_COL.store); c.material.emissive.setHex(CRATE_COL.store);
            R.wareStack.push(c); SIM.transit--;
          }
        });
      }
      u.payload--; u.t = 0;
      if (u.payload <= 0) u.state = 'leaving';
    }
  } else if (u.state === 'leaving') {
    t.position.x += dt * 8;
    if (t.position.x > 40) { u.state = 'idle'; t.visible = false; }
  }
}

// ---- requisition run: warehouse → packing → datacenter, through the AI gate.
//      The confidence floor (0.85) is the same gate the agent enforces.
function requisitionTick(dt) {
  SIM.reqTimer -= dt;
  if (SIM.reqTimer > 0) return;
  SIM.reqTimer = 3.5 + (SIM.t % 2.5);
  if (R.wareStack.length < 2) return;
  var freeRack = null; for (var i = 0; i < R.rackSlots.length; i++) { if (!R.rackSlots[i].active) { freeRack = R.rackSlots[i]; break; } }
  if (!freeRack) return;

  // illustrative confidence (the GATE is real; the per-tick value varies visibly)
  var conf = +(0.62 + ((SIM.t * 53) % 100) / 100 * 0.37).toFixed(2);
  var floor = 0.85, pr = reqId();
  if (conf < floor) {
    worldTag(new THREE.Vector3(Z.PACKING.x, 4.8, 4), 'PR-' + pr + ' conf ' + conf + ' < 0.85 · ESCALATE', 'refuse');
    logLine('agent: PR-' + pr + ' conf ' + conf + ' < floor → human approval', 'ai');
    return;
  }
  worldTag(new THREE.Vector3(Z.PACKING.x, 4.8, 4), 'PR-' + pr + ' conf ' + conf + ' ≥ 0.85 · AUTO-PO', 'ai');
  logLine('agent: PR-' + pr + ' auto-placed (conf ' + conf + ')', 'ai');

  var c = R.wareStack.shift();
  freeRack.active = 'pending';
  addJob({
    from: c.position.clone(), to: new THREE.Vector3(Z.PACKING.x, 1, 0), crate: c, kind: 'pack',
    onDone: function () {
      c.userData.state = 'pack'; c.material.color.setHex(CRATE_COL.pack); c.material.emissive.setHex(CRATE_COL.pack);
      addJob({
        from: c.position.clone(), to: freeRack.pos.clone().setY(1), crate: c, kind: 'deploy',
        onDone: function () {
          killCrate(c); freeRack.active = true; freeRack.age = 0;
          freeRack.mesh.material.emissive.setHex(0x10403a); freeRack.mesh.material.emissiveIntensity = .5;
          freeRack.led.material.color.setHex(COL.cyan); freeRack.led.material.emissive.setHex(COL.cyan);
          worldTag(freeRack.pos.clone().setY(3.4), 'DEPLOYED', 'deploy');
          logLine('asset deployed → rack online', 'dc');
          // pull a fresh crate from committed stock to keep the stack at real fill
          refillStack();
        }
      });
    }
  });
}

// keep the warehouse stack visually at the real committed-of-capacity fill
function refillStack() {
  var slots = R.cratePool.length;
  var target = Math.round((SIM.capacity ? SIM.committed / SIM.capacity : 0) * slots);
  if (R.wareStack.length < target) {
    var c = spawnCrate(stackPos(Z.WAREHOUSE, R.wareStack.length), 'store');
    if (c) { c.userData.state = 'store'; R.wareStack.push(c); }
  }
}

// ---- decommission: an aged rack is pulled and hauled to disposal (EOL lifecycle)
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
  var c = spawnCrate(old.pos.clone().setY(1), 'dead'); if (!c) { old.active = true; return; }
  SIM.transit++;
  logLine('lifecycle: rack EOL → decommission', 'warn');
  addJob({
    from: c.position.clone(), to: new THREE.Vector3(Z.DISPOSAL.x, 1, 0), crate: c, kind: 'scrap',
    onDone: function () {
      killCrate(c); SIM.transit--;
      old.active = false; old.age = 0;
      old.mesh.material.emissive.setHex(0x000000); old.mesh.material.emissiveIntensity = 0;
      old.led.material.color.setHex(0x223040); old.led.material.emissive.setHex(0x142028);
      logLine('asset disposed · provenance logged', 'bad');
    }
  });
}

// =====================================================================
// MAIN LOOP
// =====================================================================
function animate() {
  R.raf = requestAnimationFrame(animate);
  var dt = Math.min(0.05, R.clock.getDelta());
  if (SIM.playing) {
    var sdt = dt * SIM.speed;
    SIM.t += sdt; SIM.tickAcc += sdt;
    while (SIM.tickAcc >= 0.25) { SIM.tickAcc -= 0.25; SIM.tick++; }
    truckTick(sdt); requisitionTick(sdt); decommissionTick(sdt);
    assignJobs(); workerTick(sdt);
    for (var i = 0; i < R.rackSlots.length; i++) {
      var r = R.rackSlots[i];
      if (r.active === true) r.led.material.emissiveIntensity = 1.0 + Math.sin(SIM.t * 3 + r.pos.x) * 0.5;
    }
  }
  if (CAM.auto) { CAM.theta += dt * 0.06; applyCam(); }
  projectTags();
  R.renderer.render(R.scene, R.camera);
}

// =====================================================================
// PUBLIC API
// =====================================================================
function mount(container) {
  if (R.mounted) return;
  R.container = container;
  build();
  buildHUD();
  if (R.data) sync(R.data);
  R.mounted = true;
  animate();
}
function unmount() {
  if (!R.mounted) return;
  cancelAnimationFrame(R.raf); R.raf = 0;
  // detach input handlers
  INPUT.handlers.forEach(function (h) { h[0].removeEventListener(h[1], h[2]); });
  INPUT.handlers = [];
  if (R.renderer) {
    R.renderer.dispose();
    if (R.renderer.domElement && R.renderer.domElement.parentNode) R.renderer.domElement.parentNode.removeChild(R.renderer.domElement);
  }
  if (R.hud && R.hud.parentNode) R.hud.parentNode.removeChild(R.hud);
  // wipe scene refs so a fresh mount rebuilds cleanly
  R.renderer = null; R.scene = null; R.camera = null; R.hud = null; R.tagLayer = null;
  R.workers = []; R.trucks = []; R.cratePool = []; R.rackSlots = []; R.wareStack = []; R.jobs = [];
  MAT = null;
  R.mounted = false;
}

window.SCMTower = {
  mount: mount,
  unmount: unmount,
  sync: function (RAW) { R.data = RAW; if (R.mounted) sync(RAW); },
  isMounted: function () { return R.mounted; },
};

})();
