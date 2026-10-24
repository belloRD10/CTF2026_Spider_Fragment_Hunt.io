const game = document.getElementById("game");
const toast = document.getElementById("toast");
const statusText = document.getElementById("statusText");
const progressBar = document.getElementById("progressBar");
const count = document.getElementById("count");
const webBar = document.getElementById("webBar");
const webText = document.getElementById("webText");
const zoneText = document.getElementById("zoneText");
const movesText = document.getElementById("movesText");
const fragmentLayer = document.getElementById("fragmentLayer");
const cursorMarker = document.getElementById("cursorMarker");
const silkLayer = document.getElementById("silkLayer");
const threatLayer = document.getElementById("threatLayer");
const spider = document.getElementById("spider");
const spiderGlyph = document.getElementById("spiderGlyph");
const spiderBank = spiderGlyph.querySelector(".spider-bank");
const spiderInner = spiderGlyph.querySelector(".spider-inner");
const fxLayer = document.getElementById("fxLayer");
const damageFlash = document.getElementById("damageFlash");
const modal = document.getElementById("complete");
const finalFlag = document.getElementById("finalFlag");
const slots = [...document.querySelectorAll(".slot")];

const parts = [
  "cybersurferCTF{5p1d3r_",
  "follows_3v3ry_cur5or_",
  "7hr0ugh_th3_h1dd3n_",
  "v1ll4g3_p4th5}"
];

const finalFlagText =
  "cybersurferCTF{5p1d3r_follows_3v3ry_cur5or_7hr0ugh_th3_h1dd3n_v1ll4g3_p4th5}";

// ── tuning ────────────────────────────────────────────────────
const SPIDER_SPEED = 300;   // px/s top speed
const SPIDER_ACCEL = 1550;  // px/s^2 — gives the crawl weight
const SPIDER_DRAG = 0.88;   // per 1/60s, lets the spider overshoot and settle
const SPIDER_STOP = 18;     // px dead-zone around the cursor
const SPIDER_TURN = 11;     // heading lerp rate
const GAIT_SLOW = 0.40;     // stride duration at a crawl
const GAIT_FAST = 0.155;    // stride duration at top speed
const TWITCH_MIN = 1.1;     // idle leg-twitch interval, seconds
const TWITCH_MAX = 3.4;
const WEB_MAX = 100;
const HIT_DAMAGE = 34;
const HIT_REACH = 15;       // spider body radius used for collisions
const INVULN = 1.3;
const SCAN_TIME = 0.45;     // base seconds to scan a village
const DRONE_SPEED = 116;
const HUNT_SPEED = 268;     // deliberately slower than the spider, so escape is possible
const SEARCH_SPEED = 190;
const DRONE_COUNT = 4;
const DRONE_SIGHT = 300;    // px — how far the vision cone reaches
const DRONE_CONE = 56;      // degrees either side of facing that the drone can see
const DRONE_BUBBLE = 46;    // px — point-blank detection regardless of facing
const DRONE_LEASH = 340;    // px — a drone breaks off the chase beyond this
const HUNT_MAX = 3.6;       // seconds — hard cap on a single chase
const DRONE_WIND = 0.55;    // telegraph before a drone is allowed to strike
const DRONE_SEARCH = 1.5;   // beat spent sweeping the last known position
const REACQUIRE = 1.8;      // blind period after losing the spider
const STRIKE_COOLDOWN = 2.4;// blind period after landing a hit — no re-locking
const SILK_MOTES = 22;

// Safe playable regions. These are not shown to the player.
// Four of them hide a fragment, the rest are decoys.
const villages = [
  {name:"North Ridge", x:[47,58], y:[16,31]},
  {name:"Sunfield", x:[14,29], y:[34,51]},
  {name:"Rivermoor", x:[67,82], y:[36,54]},
  {name:"Forestvale", x:[25,43], y:[62,78]},
  {name:"Central Crossroads", x:[43,62], y:[43,66]},
  {name:"Eastern Woods", x:[73,90], y:[19,37]},
  {name:"Western Woods", x:[8,22], y:[18,36]},
  {name:"Southern Forest", x:[8,26], y:[60,82]},
  {name:"Harbor Path", x:[58,76], y:[75,91]}
];

// Leg rig, authored for one side (right, +x) and mirrored for the other so the
// eight legs always spread away from the body instead of piling up on one
// flank. Per leg: hy = hip position along the body (front -> rear), a = hip
// angle, f/t/u = femur/tibia/tarsus bends relative to the previous joint,
// splay = how far the leg fans out while standing still.
const LEG_RIG = [
  {hy:-11, a: -50, f:-14, t:26, u:-12, splay:-7},   // front
  {hy: -4, a: -17, f:-16, t:28, u:-10, splay:-3},
  {hy:  3, a:  15, f:-16, t:28, u:-10, splay: 3},
  {hy: 10, a:  46, f:-14, t:26, u:-12, splay: 7}    // rear
];

// Eight legs, front to back, left side first then mirrored right side. The
// opposite side mirrors the hip angle and negates every joint bend; the gait
// itself flips with --dir. Alternating tripod: the diagonals step together,
// with a small front-to-back ripple layered on top.
const legs = LEG_RIG.flatMap((l,i)=>[1,-1].map(dir=>{
  const side = dir > 0
    ? {hy:l.hy, a:l.a, f:l.f, t:l.t, u:l.u, splay:l.splay}
    : {hy:l.hy, a:180-l.a, f:-l.f, t:-l.t, u:-l.u, splay:-l.splay};
  const lead = (i % 2 === 0) === (dir > 0);
  return { ...side, dir, p: (lead ? 0 : 0.5) + l.hy*0.01 };
}));

// Shard palettes for the randomised flag fragments.
const SHARD_COLOURS = [
  ["#ff314f","#6d0d21"],
  ["#ffc85b","#6b4708"],
  ["#48e6ff","#0a4d5e"],
  ["#c66bff","#3d1163"],
  ["#5bff9d","#0d5c33"],
  ["#ff6bd6","#6b0f52"],
  ["#ff9d3c","#6b3408"]
];
const SHARD_ENTRANCES = ["rv-spin","rv-drop","rv-blast"];

let found = [false,false,false,false];
// Discs already claimed by recovered shards — {x, y, r} in game pixels.
// buildShard() never lets a new block land on top of one of these.
let placedShards = [];
const SHARD_GAP = 14;   // breathing room kept between two resting shards (covers the halo)
let zones = [];
let threats = [];
let motes = [];
let moteIndex = 0;
let moteTimer = 0;
let travel = 0;
let toastTimer = null;
let loopRunning = false;
let lastFrame = 0;
let shownTravel = 0;
let twitchTimer = 1.5;
let legEls = [];

const pointer = {x:0, y:0};
const bug = {
  x:0, y:0, vx:0, vy:0,
  heading:0,
  bank:0,
  scuttle:0,
  amp:0,
  load:0,
  prevSpeed:0,
  moving:false,
  integrity:WEB_MAX,
  invuln:0
};

// ── setup ─────────────────────────────────────────────────────
function villageRect(v){
  const w = game.clientWidth;
  const h = game.clientHeight;
  return {
    l: v.x[0]/100*w,
    t: v.y[0]/100*h,
    r: v.x[1]/100*w,
    b: v.y[1]/100*h
  };
}

function seedZones(){
  const order = villages.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }

  zones = villages.map(v=>({
    village:v,
    name:v.name,
    rect:villageRect(v),
    frag:null,
    scan:0,
    // Every village takes a slightly different amount of time to scan, so the
    // player cannot learn a single "safe" dwell length.
    need:SCAN_TIME * (0.72 + Math.random()*0.7),
    done:false,
    fx:null
  }));

  order.forEach((villageIndex,slot)=>{
    if(slot < parts.length) zones[villageIndex].frag = slot;
  });
}

function buildLegs(){
  spiderInner.innerHTML =
    `<div class="spider-shadow"></div>` +
    legs.map(l=>
      `<i class="leg" style="--a:${l.a}deg;--f:${l.f}deg;--t:${l.t}deg;--u:${l.u}deg;` +
      `--hy:${l.hy}px;--splay:${l.splay}deg;--dir:${l.dir};--p:${l.p.toFixed(3)}">` +
      `<b class="femur"><b class="tibia"><b class="tarsus"></b></b></b></i>`
    ).join("") +
    `<div class="spider-aura"></div>` +
    `<div class="spider-abdomen">
       <i class="abd-mark"></i><i class="abd-gloss"></i>
       <i class="spider-spin"><b></b><b></b></i>
     </div>` +
    `<div class="spider-pedicel"></div>` +
    `<div class="spider-ceph"><i class="ceph-mark"></i></div>` +
    `<div class="spider-fangs"><b></b><b></b></div>` +
    `<div class="spider-eyes"><b></b><b></b><b></b><b></b></div>`;
  legEls = [...spiderInner.querySelectorAll(".leg")];
}

function twitchLeg(){
  if(!legEls.length) return;
  const el = legEls[Math.floor(Math.random()*legEls.length)];
  el.classList.remove("twitch");
  void el.offsetWidth;
  el.classList.add("twitch");
  setTimeout(()=>el.classList.remove("twitch"),280);
}

function initSilk(){
  silkLayer.innerHTML = "";
  motes = [];
  for(let i=0;i<SILK_MOTES;i++){
    const m = document.createElement("i");
    m.className = "mote";
    silkLayer.appendChild(m);
    motes.push(m);
  }
  moteIndex = 0;
  moteTimer = 0;
}

function spawnDrones(){
  threatLayer.innerHTML = "";
  threats = [];
  const w = game.clientWidth;
  const h = game.clientHeight;

  for(let i=0;i<DRONE_COUNT;i++){
    const el = document.createElement("div");
    el.className = "drone";
    el.innerHTML =
      `<span class="d-glow"></span>` +
      `<b class="d-cone"></b>` +
      `<b class="d-ring"></b>` +
      `<b class="d-ring2"></b>` +
      `<i class="d-chassis"></i>` +
      `<i class="d-core"></i>` +
      `<em class="d-reticle"></em>` +
      `<em class="d-strobe"></em>` +
      `<em class="d-label">PATROL</em>`;
    threatLayer.appendChild(el);

    const t = {
      el,
      blade:el.querySelector(".d-chassis"),
      label:el.querySelector(".d-label"),
      x:70 + Math.random()*(w-140),
      y:70 + Math.random()*(h-140),
      tx:0, ty:0,
      lx:0, ly:0,
      r:23,
      spin:0,
      facing:Math.random()*360,
      // each drone gets its own patrol speed so they don't move in lockstep
      cruise:DRONE_SPEED * (0.82 + Math.random()*0.42),
      state:"patrol",
      timer:0,
      huntTime:0,
      // blind > 0 means this drone cannot see the spider at all, whatever
      // the range or angle. This is what stops them gluing to it.
      blind:Math.random()*REACQUIRE
    };
    t.lx = t.x;
    t.ly = t.y;
    pickWaypoint(t);
    threats.push(t);
  }
}

function pickWaypoint(t){
  const z = zones[Math.floor(Math.random()*zones.length)];
  t.tx = z.rect.l + Math.random()*(z.rect.r - z.rect.l);
  t.ty = z.rect.t + Math.random()*(z.rect.b - z.rect.t);
}

function resetBug(){
  const w = game.clientWidth;
  const h = game.clientHeight;
  bug.x = w*0.5;
  bug.y = h*0.62;
  bug.vx = 0;
  bug.vy = 0;
  bug.heading = -90;
  bug.bank = 0;
  bug.scuttle = 0;
  bug.amp = 0;
  bug.prevSpeed = 0;
  bug.moving = false;
  bug.integrity = WEB_MAX;
  bug.invuln = 0;
  twitchTimer = 1.5;
  spiderGlyph.style.removeProperty("--gait");
  spiderGlyph.style.removeProperty("--amp");
  spiderGlyph.classList.remove("moving");
  spiderGlyph.classList.add("idle");
  spider.classList.remove("hurt","weak");
  syncWeb();
}

function resetBugAt(x,y){
  bug.x = x;
  bug.y = y;
  bug.vx = 0;
  bug.vy = 0;
  bug.integrity = WEB_MAX;
  bug.invuln = 2.2;
  spider.classList.add("hurt");
  syncWeb();
}

// ── hud ───────────────────────────────────────────────────────
function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"),1800);
}

function syncWeb(){
  const pct = Math.round(bug.integrity);
  webBar.style.width = pct+"%";
  webText.textContent = pct+"%";
  webBar.style.background = pct <= 34
    ? "linear-gradient(90deg,#ff2947,#ff8a5b)"
    : "linear-gradient(90deg,#48e6ff,#8affd6)";
  spider.classList.toggle("weak", pct <= 34);
}

function syncCounters(){
  const scanned = zones.filter(z=>z.done).length;
  zoneText.textContent = scanned+" / "+zones.length;
  movesText.textContent = Math.round(travel/8)+" m";
}

function resetSlots(){
  found=[false,false,false,false];
  slots.forEach((s,i)=>{
    s.classList.remove("found");
    s.style.removeProperty("--c1");
    s.style.removeProperty("--c2");
    s.removeAttribute("title");
    s.querySelector("span").textContent="?";
    s.querySelector("small").textContent="PART "+(i+1);
  });
  progressBar.style.width="0%";
  count.textContent="0 / 4 FOUND";
}

// ── scan fields ───────────────────────────────────────────────
function openScan(z){
  const el = document.createElement("div");
  el.className = "scan";
  el.style.left = ((z.rect.l+z.rect.r)/2)+"px";
  el.style.top = ((z.rect.t+z.rect.b)/2)+"px";
  el.innerHTML = `<i></i><span>SCANNING ${z.name.toUpperCase()}</span>`;
  fxLayer.appendChild(el);
  z.fx = el;
}

function closeScan(z){
  if(!z.fx) return;
  z.fx.remove();
  z.fx = null;
}

function updateZones(dt){
  for(const z of zones){
    if(z.done) continue;

    const inside = bug.x > z.rect.l && bug.x < z.rect.r &&
                   bug.y > z.rect.t && bug.y < z.rect.b;

    if(inside){
      if(z.scan === 0) openScan(z);
      z.scan += dt;
      z.fx.firstChild.style.setProperty("--p", Math.min(1, z.scan/z.need).toFixed(3));

      if(z.scan >= z.need){
        z.done = true;
        closeScan(z);
        syncCounters();
        if(z.frag === null){
          showToast("SCAN COMPLETE — " + z.name.toUpperCase() + " IS EMPTY.");
          statusText.textContent = "SCANNED "+zones.filter(v=>v.done).length+"/"+zones.length+" • SEARCHING";
        } else {
          collect(z.frag, z);
        }
      }
    } else if(z.scan > 0){
      z.scan = 0;
      closeScan(z);
    }
  }
}

// Random polygon silhouette so no two shards are cut from the same "die".
function shardClip(){
  const sides = 5 + Math.floor(Math.random()*3);
  const rot = Math.random()*360;
  const pts = [];
  for(let i=0;i<sides;i++){
    const a = (rot + (360/sides)*i) * Math.PI/180;
    const r = 40 + Math.random()*10;
    pts.push(`${(50+Math.cos(a)*r).toFixed(1)}% ${(50+Math.sin(a)*r).toFixed(1)}%`);
  }
  return `polygon(${pts.join(",")})`;
}

// Nothing about a shard is fixed between games: silhouette, palette, tilt,
// size, text scale, float rate and entrance animation are all rolled fresh,
// and it lands at a random spot inside its village rather than dead centre.
function buildShard(index, x, y){
  const cols = SHARD_COLOURS[Math.floor(Math.random()*SHARD_COLOURS.length)];
  const width = 46 + Math.random()*22;
  const el = document.createElement("div");
  el.className = "fragment " + SHARD_ENTRANCES[Math.floor(Math.random()*SHARD_ENTRANCES.length)];
  el.style.left = x+"px";
  el.style.top = y+"px";
  el.style.setProperty("--c1", cols[0]);
  el.style.setProperty("--c2", cols[1]);
  el.style.setProperty("--tilt", (-26 + Math.random()*52).toFixed(1)+"deg");
  el.style.setProperty("--w", width.toFixed(0)+"px");
  // Type scales with the block so the label always wraps to ~2 lines instead
  // of stretching a miniature shard into a tall tower of text.
  const fs = Math.max(6.2, Math.min(8.4, (width - 6) / 6.9));
  el.style.setProperty("--fs", fs.toFixed(1)+"px");
  el.style.setProperty("--pulse", (0.85 + Math.random()*1.1).toFixed(2)+"s");
  el.style.setProperty("--shard", shardClip());
  el.innerHTML = `<i class="shard"><span>${parts[index]}</span></i>`;
  return el;
}

// HUD blocks that render above the fragment layer — a shard slipping under
// one of them would vanish behind the UI, so they are reserved too.
const HUD_BLOCKS = [".topbar", ".objective", ".tracker", ".hop-help", "footer"];
function hudRects(){
  const out = [];
  for(const sel of HUD_BLOCKS){
    const el = document.querySelector(sel);
    if(!el) continue;
    const r = el.getBoundingClientRect();
    out.push({l:r.left, t:r.top, r:r.right, b:r.bottom});
  }
  return out;
}

// Pick a resting spot for a freshly revealed shard. The block is only ever
// placed where it cannot collide with the shards already on the map: the
// whole (tilted, floating) block is treated as a circumscribed disc, and
// candidates are taken in order — points inside the revealing village, then
// just beside any HUD panel the village runs under, then widening rings
// around it — the first one that clears every reserved disc by SHARD_GAP and
// every panel wins. If nothing clears, the roomiest candidate found wins.
function shardSpot(el, z){
  const rect = z.rect;
  const gw = game.clientWidth, gh = game.clientHeight;
  const w = el.offsetWidth, h = el.offsetHeight;
  const r = Math.hypot(w, h)/2;      // circle that contains the block at any tilt
  const pad = 6;                     // keep it off the viewport edge
  const cx = (rect.l+rect.r)/2, cy = (rect.t+rect.b)/2;
  const hud = hudRects();

  // Sample range for a region grown `g` times around the village centre:
  // inside the village at g = 1, never off-screen, and never inverted — it
  // collapses to the village centre on tiny viewports.
  const range = g => {
    const l = cx - (cx - rect.l)*g, rr = cx + (rect.r - cx)*g;
    const t = cy - (cy - rect.t)*g, b = cy + (rect.b - cy)*g;
    return {
      loX: Math.min(Math.max(l + w/2, r + pad), cx),
      hiX: Math.max(Math.min(rr - w/2, gw - r - pad), cx),
      loY: Math.min(Math.max(t + h/2, r + pad), cy),
      hiY: Math.max(Math.min(b - h/2, gh - r - pad), cy)
    };
  };

  // Clearance from a candidate point to every reserved disc and HUD panel.
  const roomAt = (x, y) => {
    let room = Infinity;
    for(const s of placedShards){
      room = Math.min(room, Math.hypot(x - s.x, y - s.y) - (r + s.r) - SHARD_GAP);
    }
    for(const rc of hud){
      const dx = Math.max(rc.l - x, 0, x - rc.r);
      const dy = Math.max(rc.t - y, 0, y - rc.b);
      room = Math.min(room, (dx === 0 && dy === 0) ? -(r + 4) : Math.hypot(dx, dy) - r);
    }
    return room;
  };

  let best = null, roomiest = -Infinity;
  const consider = (x, y) => {
    x = Math.min(Math.max(x, r + pad), Math.max(r + pad, gw - r - pad));
    y = Math.min(Math.max(y, r + pad), Math.max(r + pad, gh - r - pad));
    const room = roomAt(x, y);
    if(room >= 0) return {x, y, r};          // clear spot found
    if(room > roomiest){ roomiest = room; best = {x, y, r}; }
    return null;
  };

  // 1) inside the village that revealed it — centre first, then random points.
  const here = range(1);
  let spot = consider(cx, cy);
  for(let i = 0; i < 60 && !spot; i++){
    spot = consider(here.loX + Math.random()*(here.hiX - here.loX),
                    here.loY + Math.random()*(here.hiY - here.loY));
  }
  // 2) the village runs under a panel: step just outside that panel instead —
  //    a shard nudged beside it beats one nobody can see behind it.
  for(const rc of hud){
    if(spot) break;
    if(rc.r < rect.l || rc.l > rect.r || rc.b < rect.t || rc.t > rect.b) continue;
    spot = consider(rc.r + r + 4, cy) || consider(rc.l - r - 4, cy)
        || consider(cx, rc.b + r + 4) || consider(cx, rc.t - r - 4);
  }
  // 3) widen the search to rings around the village, then give up gracefully
  //    on the roomiest spot found anywhere.
  for(let pass = 1; pass <= 2 && !spot; pass++){
    const rg = range(1 + pass*0.6);
    for(let i = 0; i < 60 && !spot; i++){
      spot = consider(rg.loX + Math.random()*(rg.hiX - rg.loX),
                      rg.loY + Math.random()*(rg.hiY - rg.loY));
    }
  }
  return spot || best || {x:cx, y:cy, r};
}

function collect(index, z){
  found[index] = true;

  // A fragment only materialises because the spider stood inside the village.
  // It is appended invisible, measured, then given a spot that clears every
  // shard already resting on the map before it reveals itself.
  const el = buildShard(index, 0, 0);
  fragmentLayer.appendChild(el);

  const spot = shardSpot(el, z);
  el.style.left = spot.x+"px";
  el.style.top = spot.y+"px";
  placedShards.push({x:spot.x, y:spot.y, r:spot.r});

  void el.offsetWidth;
  el.classList.add("revealed");

  burst(spot.x, spot.y);

  // The tracker tile keeps its own copy of the shard's palette so the panel
  // and the map fragment read as the same piece.
  const slot = slots[index];
  slot.classList.add("found");
  slot.style.setProperty("--c1", el.style.getPropertyValue("--c1"));
  slot.style.setProperty("--c2", el.style.getPropertyValue("--c2"));
  slot.title = parts[index];
  slot.querySelector("span").textContent = parts[index];
  slot.querySelector("small").textContent = "RECOVERED";

  const total = found.filter(Boolean).length;
  progressBar.style.width = (total/parts.length*100)+"%";
  count.textContent = `${total} / ${parts.length} FOUND`;
  statusText.textContent = `FRAGMENT ${index+1}/${parts.length} RECOVERED`;
  showToast(`⚡ Hidden fragment ${index+1}/${parts.length} materialised at ${z.name}!`);

  if(total === parts.length){
    setTimeout(completeGame,900);
  }
}

function burst(x,y){
  const el = document.createElement("div");
  el.className = "burst";
  el.style.left = x+"px";
  el.style.top = y+"px";
  fxLayer.appendChild(el);
  setTimeout(()=>el.remove(),900);
}

// ── spider ────────────────────────────────────────────────────
function lerpAngle(a,b,t){
  const d = ((b - a + 540) % 360) - 180;
  return a + d*t;
}

function updateBug(dt){
  const dx = pointer.x - bug.x;
  const dy = pointer.y - bug.y;
  const dist = Math.hypot(dx,dy) || 1;
  const chasing = dist > SPIDER_STOP;

  if(chasing){
    bug.vx += (dx/dist)*SPIDER_ACCEL*dt;
    bug.vy += (dy/dist)*SPIDER_ACCEL*dt;
  }

  // Heavier damping inside the dead-zone so the spider settles instead of jittering.
  const drag = Math.pow(chasing ? SPIDER_DRAG : 0.55, dt*60);
  bug.vx *= drag;
  bug.vy *= drag;

  const cap = SPIDER_SPEED * (bug.integrity <= 34 ? 0.72 : 1);
  const speed = Math.hypot(bug.vx,bug.vy);
  if(speed > cap){
    bug.vx = bug.vx/speed*cap;
    bug.vy = bug.vy/speed*cap;
  }

  bug.x += bug.vx*dt;
  bug.y += bug.vy*dt;

  const pad = 24;
  const w = game.clientWidth;
  const h = game.clientHeight;
  if(bug.x < pad){ bug.x = pad; bug.vx = Math.abs(bug.vx)*0.4; }
  if(bug.x > w-pad){ bug.x = w-pad; bug.vx = -Math.abs(bug.vx)*0.4; }
  if(bug.y < pad){ bug.y = pad; bug.vy = Math.abs(bug.vy)*0.4; }
  if(bug.y > h-pad){ bug.y = h-pad; bug.vy = -Math.abs(bug.vy)*0.4; }

  const moving = speed > 14;
  // 0..1 speed factor: drives the contact shadow, stride size and leg flex.
  const load = Math.min(1, speed/SPIDER_SPEED);
  bug.load += ((moving ? load : 0) - bug.load) * Math.min(1, dt*6);
  spiderGlyph.style.setProperty("--load", bug.load.toFixed(3));

  if(moving !== bug.moving){
    bug.moving = moving;
    spiderGlyph.classList.toggle("moving", moving);
    spiderGlyph.classList.toggle("idle", !moving);
    if(!moving) twitchTimer = TWITCH_MIN + Math.random()*(TWITCH_MAX - TWITCH_MIN);
  }

  if(moving){
    travel += speed*dt;
    const target = Math.atan2(bug.vy, bug.vx)*180/Math.PI + 90;
    const before = bug.heading;
    bug.heading = lerpAngle(bug.heading, target, Math.min(1, dt*SPIDER_TURN));

    // How hard is the spider swerving or accelerating? Sharp turns and hard
    // launches trigger a scuttle burst — the stride gets faster and wider.
    const turn = Math.abs(((bug.heading - before + 540) % 360) - 180);
    const push = Math.max(0, speed - bug.prevSpeed)/Math.max(dt, 1e-4);
    bug.prevSpeed = speed;
    bug.scuttle = Math.max(0, Math.min(1, bug.scuttle + turn*0.9 + push/2600));
    bug.scuttle *= Math.pow(0.9, dt*60);

    const stride = GAIT_SLOW - (load + bug.scuttle*0.45)*(GAIT_SLOW - GAIT_FAST)/1.45;
    bug.amp = Math.max(0, Math.min(1.15, bug.amp + (load*0.75 + bug.scuttle*0.35 - bug.amp)*Math.min(1, dt*9)));

    spiderGlyph.style.setProperty("--gait", Math.max(GAIT_FAST*0.72, stride).toFixed(3)+"s");
    spiderGlyph.style.setProperty("--amp", bug.amp.toFixed(3));

    // Bank into the turn.
    const bankTarget = Math.max(-9, Math.min(9, turn*0.42));
    bug.bank += (bankTarget - bug.bank)*Math.min(1, dt*8);
  } else {
    bug.scuttle *= Math.pow(0.86, dt*60);
    bug.amp = Math.max(0, bug.amp - bug.amp*Math.min(1, dt*6));
    bug.bank += (0 - bug.bank)*Math.min(1, dt*6);

    twitchTimer -= dt;
    if(twitchTimer <= 0){
      twitchLeg();
      twitchTimer = TWITCH_MIN + Math.random()*(TWITCH_MAX - TWITCH_MIN);
    }
  }

  if(bug.invuln > 0){
    bug.invuln -= dt;
    if(bug.invuln <= 0) spider.classList.remove("hurt");
  }
}

function updateSilk(dt){
  if(!bug.moving) return;
  moteTimer -= dt;
  if(moteTimer > 0) return;
  moteTimer = 0.045;

  const m = motes[moteIndex];
  moteIndex = (moteIndex+1) % motes.length;
  m.style.left = bug.x+"px";
  m.style.top = bug.y+"px";
  m.classList.remove("pop");
  void m.offsetWidth;
  m.classList.add("pop");
}

// ── drones ────────────────────────────────────────────────────
// Each drone runs patrol -> wind -> hunt -> search -> patrol.
//
// Three rules keep them from gluing onto the spider:
//   1. The vision cone has a limited range (DRONE_SIGHT), so a drone can only
//      notice the spider when the spider is genuinely nearby.
//   2. A chase is leashed twice over — by distance and by a hard time cap.
//   3. `blind` switches vision off entirely for a cooldown after the drone
//      loses the spider or lands a hit. During that window it physically
//      cannot re-acquire, so it always returns to patrolling the villages.
function steerDrone(t,x,y,speed,dt){
  const dx = x - t.x;
  const dy = y - t.y;
  const d = Math.hypot(dx,dy) || 1;
  t.x += dx/d*speed*dt;
  t.y += dy/d*speed*dt;
  t.facing = lerpAngle(t.facing, Math.atan2(dy,dx)*180/Math.PI, Math.min(1, dt*6));
}

function standDown(t){
  // Break off whatever it was doing and send it back to the village circuit.
  t.state = "patrol";
  t.huntTime = 0;
  t.blind = REACQUIRE;
  pickWaypoint(t);
}

function keepInside(t){
  const pad = 40;
  const w = game.clientWidth;
  const h = game.clientHeight;
  let hit = false;
  if(t.x < pad){ t.x = pad; hit = true; }
  if(t.x > w-pad){ t.x = w-pad; hit = true; }
  if(t.y < pad){ t.y = pad; hit = true; }
  if(t.y > h-pad){ t.y = h-pad; hit = true; }
  if(hit && t.state !== "hunt") pickWaypoint(t);
}

function updateDrones(dt){
  let nearest = Infinity;

  for(const t of threats){
    if(t.blind > 0) t.blind = Math.max(0, t.blind - dt);

    const gap = Math.hypot(bug.x-t.x, bug.y-t.y);
    if(gap < nearest) nearest = gap;

    const toBug = Math.atan2(bug.y-t.y, bug.x-t.x)*180/Math.PI;
    const off = Math.abs(((toBug - t.facing + 540) % 360) - 180);
    const sees = t.blind <= 0 &&
                 (gap < DRONE_BUBBLE || (gap < DRONE_SIGHT && off < DRONE_CONE));

    if(sees && t.state !== "wind" && t.state !== "hunt"){
      t.state = "wind";
      t.timer = DRONE_WIND;
      t.huntTime = 0;
      t.lx = bug.x;
      t.ly = bug.y;
    }

    if(t.state === "wind"){
      // Telegraph: lock on and strobe, but cannot strike yet.
      t.timer -= dt;
      t.huntTime += dt;
      t.facing = lerpAngle(t.facing, toBug, Math.min(1, dt*8));
      if(t.timer <= 0) t.state = "hunt";
    } else if(t.state === "hunt"){
      t.huntTime += dt;
      t.lx = bug.x;
      t.ly = bug.y;
      steerDrone(t, bug.x, bug.y, HUNT_SPEED, dt);

      if(gap > DRONE_LEASH || t.huntTime >= HUNT_MAX || t.blind > 0){
        t.state = "search";
        t.timer = DRONE_SEARCH;
        t.blind = REACQUIRE;
      }
    } else if(t.state === "search"){
      // Sweep around the last known position, then hand back to the patrol.
      t.timer -= dt;
      steerDrone(t, t.lx, t.ly, SEARCH_SPEED, dt);
      if(Math.hypot(t.x-t.lx, t.y-t.ly) < 24){
        t.lx += (Math.random()-0.5)*130;
        t.ly += (Math.random()-0.5)*130;
      }
      if(t.timer <= 0) standDown(t);
    } else {
      steerDrone(t, t.tx, t.ty, t.cruise, dt);
      if(Math.hypot(t.x-t.tx, t.y-t.ty) < 14) pickWaypoint(t);
    }

    keepInside(t);
    t.spin += dt * (t.state === "hunt" ? 250 : t.state === "wind" ? 170 : 95);

    if(t.state !== t.lastState){
      t.lastState = t.state;
      t.el.classList.toggle("alert", t.state !== "patrol");
      t.el.classList.toggle("wind", t.state === "wind");
      t.el.classList.toggle("hunt", t.state === "hunt");
      t.label.textContent = t.state === "wind" ? "LOCKING"
                          : t.state === "hunt" ? "TRACKING"
                          : t.state === "search" ? "SEARCHING" : "PATROL";
    }

    if(t.state === "hunt" && gap < t.r + HIT_REACH && bug.invuln <= 0) takeHit(t);
  }

  threatLayer.classList.toggle("danger", nearest < 200);
}

function takeHit(t){
  bug.integrity = Math.max(0, bug.integrity - HIT_DAMAGE);
  bug.invuln = INVULN;

  // The striking drone breaks off completely: it returns to the village
  // circuit and goes blind, so a hit buys recovery time instead of pinning
  // the player while the other three close in.
  standDown(t);

  const dx = bug.x - t.x;
  const dy = bug.y - t.y;
  const d = Math.hypot(dx,dy) || 1;
  bug.vx += (dx/d)*430;
  bug.vy += (dy/d)*430;

  spider.classList.add("hurt");
  damageFlash.classList.remove("fire");
  void damageFlash.offsetWidth;
  damageFlash.classList.add("fire");
  syncWeb();

  if(bug.integrity <= 0){
    const z = nearestZone(bug.x,bug.y);
    if(z){
      resetBugAt((z.rect.l+z.rect.r)/2, (z.rect.t+z.rect.b)/2);
      showToast("✖ WEB SHREDDED — respun at "+z.name+".");
    } else {
      resetBugAt(game.clientWidth*0.5, game.clientHeight*0.5);
      showToast("✖ WEB SHREDDED — respun at the crossroads.");
    }
    statusText.textContent = "WEB REBUILT • HUNT RESUMES";
    // A respawn is a clean break — every drone stands down and regroups.
    for(const d of threats) standDown(d);
  } else {
    showToast("⚠ WEB SNARED — integrity "+Math.round(bug.integrity)+"%");
    statusText.textContent = "WEB DAMAGED • EVADE THE DRONES";
  }
}

function nearestZone(x,y){
  let best = null;
  let bestD = Infinity;
  for(const z of zones){
    const cx = (z.rect.l+z.rect.r)/2;
    const cy = (z.rect.t+z.rect.b)/2;
    const d = Math.hypot(x-cx, y-cy);
    if(d < bestD){
      bestD = d;
      best = z;
    }
  }
  return best;
}

// ── frame ─────────────────────────────────────────────────────
function render(){
  spider.style.transform = `translate3d(${bug.x.toFixed(1)}px,${bug.y.toFixed(1)}px,0)`;
  spiderGlyph.style.setProperty("--h", bug.heading.toFixed(1)+"deg");
  spiderBank.style.setProperty("--bank", bug.bank.toFixed(2)+"deg");

  const metres = Math.round(travel/8);
  if(metres !== shownTravel){
    shownTravel = metres;
    movesText.textContent = metres+" m";
  }

  for(const t of threats){
    t.el.style.transform = `translate3d(${t.x.toFixed(1)}px,${t.y.toFixed(1)}px,0)`;
    t.el.style.setProperty("--facing", t.facing.toFixed(1)+"deg");
    t.blade.style.transform = `rotate(${t.spin.toFixed(1)}deg)`;
  }
}

function frame(now){
  const dt = Math.min((now - lastFrame)/1000, 0.05) || 0;
  lastFrame = now;

  // The hunt freezes once the flag is assembled.
  if(modal.classList.contains("hidden")){
    updateBug(dt);
    updateDrones(dt);
    updateZones(dt);
    updateSilk(dt);
  }
  render();

  requestAnimationFrame(frame);
}

// ── lifecycle ─────────────────────────────────────────────────
function completeGame(){
  finalFlag.textContent = finalFlagText;
  modal.classList.remove("hidden");
  // Stop the legs mid-step, otherwise the gait keeps animating in place
  // behind the modal.
  spiderGlyph.classList.remove("moving");
  spiderGlyph.classList.add("idle");
  bug.moving = false;
  statusText.textContent = "ALL FRAGMENTS RECOVERED";
  document.getElementById("statusDot").style.background = "#ffc85b";
}

function boot(){
  buildLegs();
  seedZones();
  initSilk();
  spawnDrones();
  resetBug();
  resetSlots();
  travel = 0;
  shownTravel = 0;
  syncCounters();
  fxLayer.innerHTML = "";
  placedShards = [];

  pointer.x = game.clientWidth*0.5;
  pointer.y = game.clientHeight*0.4;
  cursorMarker.style.left = pointer.x+"px";
  cursorMarker.style.top = pointer.y+"px";

  statusText.textContent = "SPIDER DEPLOYED • LEAD IT WITH THE CURSOR";
  document.getElementById("statusDot").style.background = "#56f28a";

  if(!loopRunning){
    loopRunning = true;
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }
}

window.addEventListener("pointermove", e=>{
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  cursorMarker.style.left = e.clientX+"px";
  cursorMarker.style.top = e.clientY+"px";
}, {passive:true});

window.addEventListener("resize", ()=>{
  for(const z of zones) z.rect = villageRect(z.village);
});

document.getElementById("restart").addEventListener("click",()=>{
  modal.classList.add("hidden");
  document.getElementById("statusDot").style.background = "#56f28a";
  fragmentLayer.innerHTML = "";
  boot();
});

boot();
