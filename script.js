import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ═══════════════════════════════════
   FIREBASE CONFIG
   ═══════════════════════════════════ */
const firebaseConfig = {
    apiKey: "AIzaSyDGhdlbSLq_q5YXluBBpg9ug98pc72sWxM",
    authDomain: "flappy-8f1c2.firebaseapp.com",
    projectId: "flappy-8f1c2",
    storageBucket: "flappy-8f1c2.appspot.com",
    messagingSenderId: "62097720793",
    appId: "1:62097720793:web:369de18b6f345a64e085c8"
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

/* ═══════════════════════════════════
   TELEGRAM INIT (safe fallback)
   ═══════════════════════════════════ */
const tg = window.Telegram?.WebApp || { expand: () => {}, initDataUnsafe: {} };
tg.expand();

const userId = tg.initDataUnsafe?.user?.id?.toString() || "test_user";
let userData  = null;
let appConfig = { payouts_enabled: false };

/* ═══════════════════════════════════
   USER / FIREBASE LOGIC
   ═══════════════════════════════════ */
async function initUser() {
    try {
        const userSnap   = await getDoc(doc(db, "users", userId));
        const configSnap = await getDoc(doc(db, "settings", "config"));
        if (configSnap.exists()) appConfig = configSnap.data();

        if (!userSnap.exists()) {
            const startParam = tg.initDataUnsafe?.start_param || "";
            if (startParam.startsWith("ref_")) {
                await awardReferral(startParam.replace("ref_", "")).catch(() => {});
            }
            showScreen("language-screen");
        } else {
            userData = userSnap.data();
            // ensure fields exist (migration safety)
            userData.balance   = userData.balance   ?? 0;
            userData.bestScore = userData.bestScore ?? 0;
            showMenu();
        }
    } catch (err) {
        console.warn("Firebase error, running offline:", err);
        userData = { balance: 0, bestScore: 0, language: "en", skin: "default" };
        showMenu();
    }
}

async function awardReferral(inviterId) {
    await updateDoc(doc(db, "users", inviterId), { balance: increment(50) });
}

window.selectLanguage = async function (lang) {
    userData = { balance: 0, bestScore: 0, language: lang, skin: "default" };
    await setDoc(doc(db, "users", userId), userData).catch(() => {});
    showMenu();
};

/* ─── helpers ─── */
function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
}

function showMenu() {
    showScreen("menu-screen");
    document.getElementById("ui-balance").textContent = userData.balance.toFixed(1) + " 🪙";
    document.getElementById("ui-best").textContent    = userData.bestScore + " 🏆";
    startMenuAnimation();
}

window.goToMenu = function () {
    stopGame();
    showMenu();
};

/* ═══════════════════════════════════
   MENU BACKGROUND ANIMATION
   ═══════════════════════════════════ */
let menuRafId = null;
let menuFrames = 0;

function startMenuAnimation() {
    const c   = document.getElementById("menuBg");
    const ctx2 = c.getContext("2d");
    c.width   = window.innerWidth;
    c.height  = window.innerHeight;

    cancelAnimationFrame(menuRafId);

    const stars = Array.from({ length: 100 }, (_, i) => ({
        x: (i * 173.7 + 31) % c.width,
        y: (i * 97.3  + 17) % (c.height * .82),
        r: .4 + (i % 5) * .28,
        phase: i * .61,
        color: i % 9 === 0 ? "#aaddff" : i % 7 === 0 ? "#ffddaa" : "#ffffff"
    }));

    const nebulas = [
        { x: c.width * .25, y: c.height * .18, r: 80,  hue: 220, a: .08 },
        { x: c.width * .7,  y: c.height * .32, r: 60,  hue: 280, a: .07 },
        { x: c.width * .5,  y: c.height * .55, r: 100, hue: 200, a: .06 },
    ];

    const menuShoots = [];
    let mShootTimer = 0;

    function loop() {
        menuFrames++;
        mShootTimer++;
        ctx2.clearRect(0, 0, c.width, c.height);

        /* ── Deep space sky ── */
        const sky = ctx2.createLinearGradient(0, 0, 0, c.height);
        sky.addColorStop(0,   "#00010d");
        sky.addColorStop(.4,  "#010620");
        sky.addColorStop(.75, "#020b30");
        sky.addColorStop(1,   "#030d3a");
        ctx2.fillStyle = sky;
        ctx2.fillRect(0, 0, c.width, c.height);

        /* ── Nebulas ── */
        nebulas.forEach(n => {
            const ng = ctx2.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
            ng.addColorStop(0,   `hsla(${n.hue},80%,55%,${n.a * 2})`);
            ng.addColorStop(.5,  `hsla(${n.hue},70%,40%,${n.a})`);
            ng.addColorStop(1,   "transparent");
            ctx2.fillStyle = ng;
            ctx2.beginPath(); ctx2.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx2.fill();
        });

        /* ── Stars ── */
        stars.forEach(s => {
            ctx2.globalAlpha = .3 + .7 * Math.abs(Math.sin(menuFrames * .016 + s.phase));
            ctx2.fillStyle   = s.color;
            ctx2.beginPath(); ctx2.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx2.fill();
        });
        ctx2.globalAlpha = 1;

        /* ── Saturn planet ── */
        const px = c.width * .78, py = c.height * .14, pr = c.width * .065;
        const pg = ctx2.createRadialGradient(px - pr * .3, py - pr * .3, pr * .1, px, py, pr);
        pg.addColorStop(0,   "#fff4cc"); pg.addColorStop(.5, "#ddaa44"); pg.addColorStop(1, "#665500");
        ctx2.fillStyle = pg;
        ctx2.beginPath(); ctx2.arc(px, py, pr, 0, Math.PI * 2); ctx2.fill();
        ctx2.save();
        ctx2.globalAlpha = .6;
        ctx2.strokeStyle = "#ddaa44"; ctx2.lineWidth = pr * .3;
        ctx2.beginPath(); ctx2.ellipse(px, py, pr * 1.85, pr * .4, -.25, 0, Math.PI * 2); ctx2.stroke();
        ctx2.restore();

        /* ── Small planet ── */
        const p2x = c.width * .14, p2y = c.height * .22, p2r = c.width * .035;
        const p2g = ctx2.createRadialGradient(p2x - p2r * .3, p2y - p2r * .3, p2r * .1, p2x, p2y, p2r);
        p2g.addColorStop(0, "#aaffcc"); p2g.addColorStop(.5, "#33aa66"); p2g.addColorStop(1, "#114422");
        ctx2.fillStyle = p2g;
        ctx2.beginPath(); ctx2.arc(p2x, p2y, p2r, 0, Math.PI * 2); ctx2.fill();

        /* ── Shooting stars ── */
        if (mShootTimer > 180) {
            mShootTimer = 0;
            menuShoots.push({
                x: Math.random() * c.width * .7, y: Math.random() * c.height * .4,
                vx: 4 + Math.random() * 3, vy: 1.5 + Math.random() * 1.5,
                life: 35, maxLife: 35
            });
        }
        for (let i = menuShoots.length - 1; i >= 0; i--) {
            const s = menuShoots[i];
            s.x += s.vx; s.y += s.vy; s.life--;
            if (s.life <= 0) { menuShoots.splice(i, 1); continue; }
            const a2 = s.life / s.maxLife;
            const sg2 = ctx2.createLinearGradient(s.x, s.y, s.x - s.vx * 10, s.y - s.vy * 10);
            sg2.addColorStop(0,   `rgba(255,255,255,${a2})`);
            sg2.addColorStop(1,   "transparent");
            ctx2.strokeStyle = sg2; ctx2.lineWidth = 1.5 * a2;
            ctx2.beginPath(); ctx2.moveTo(s.x, s.y); ctx2.lineTo(s.x - s.vx * 10, s.y - s.vy * 10); ctx2.stroke();
        }

        /* ── Ground ── */
        const groundY = c.height - 60;
        const gg = ctx2.createLinearGradient(0, groundY, 0, c.height);
        gg.addColorStop(0, "#1a1424"); gg.addColorStop(1, "#0a0812");
        ctx2.fillStyle = gg; ctx2.fillRect(0, groundY, c.width, 60);

        // rocky silhouette
        ctx2.fillStyle = "#1a1424";
        ctx2.beginPath(); ctx2.moveTo(0, groundY);
        const rp = [0,.6,.09,.3,.18,.7,.27,.4,.36,.8,.45,.35,.54,.65,.63,.28,.72,.72,.81,.42,.90,.68,1,.4];
        for (let i = 0; i < rp.length; i += 2)
            ctx2.lineTo(rp[i] * c.width, groundY - rp[i+1] * 14);
        ctx2.lineTo(c.width, groundY); ctx2.closePath(); ctx2.fill();

        // horizon glow
        ctx2.save();
        ctx2.shadowColor = "#4488ff"; ctx2.shadowBlur = 24;
        ctx2.strokeStyle = "#6699ff"; ctx2.lineWidth = 2;
        ctx2.beginPath(); ctx2.moveTo(0, groundY); ctx2.lineTo(c.width, groundY); ctx2.stroke();
        ctx2.restore();

        menuRafId = requestAnimationFrame(loop);
    }
    loop();
}

/* ═══════════════════════════════════
   GAME ENGINE
   ═══════════════════════════════════ */
const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");

/* ─── State ─── */
let gameState     = "idle"; // "playing" | "dead" | "idle"
let gameLoopId    = null;
let deathLock     = false;

let bird, pipes, coins, particles, score, coinsCollected, frames, speed;

const PIPE_W  = 54;
const GAP_H   = 155;
const GROUND  = 56; // px from bottom

/* ─── Clouds for parallax ─── */
const CLOUDS = [];
function buildClouds() {
    CLOUDS.length = 0;
    for (let i = 0; i < 7; i++) {
        CLOUDS.push({
            x:     Math.random() * canvas.width,
            y:     20 + Math.random() * canvas.height * .45,
            r:     22 + Math.random() * 45,
            spd:   .15 + Math.random() * .25,
            alpha: .08 + Math.random() * .18
        });
    }
}

/* ─── Pre-render pipe cap to offscreen canvas ─── */
function makePipeCapCanvas(w, h) {
    const oc  = document.createElement("canvas");
    oc.width  = w + 12;
    oc.height = h;
    const c   = oc.getContext("2d");
    const g   = c.createLinearGradient(0, 0, oc.width, 0);
    g.addColorStop(0,    "#0d3d17");
    g.addColorStop(.2,   "#1a6b2a");
    g.addColorStop(.45,  "#4ddc6a");
    g.addColorStop(.7,   "#2da844");
    g.addColorStop(1,    "#0d3d17");
    c.fillStyle = g;
    c.fillRect(0, 0, oc.width, h);
    // shine
    c.globalAlpha = .22;
    c.fillStyle   = "#ffffff";
    c.fillRect(6, 2, 7, h - 4);
    c.globalAlpha = 1;
    return oc;
}

/* ════════════════════
   DRAW FUNCTIONS
   ════════════════════ */

/* ════════════════════════════════
   BACKGROUND — DEEP SPACE
   ════════════════════════════════ */

// Pre-built star field (stable positions, no per-frame random)
const STAR_FIELD = Array.from({ length: 120 }, (_, i) => ({
    x:     (i * 173.7 + 31) % 1,   // 0-1 normalized
    y:     (i * 97.3  + 17) % 1,
    r:     .4 + (i % 5) * .28,
    phase: i * .61,
    color: i % 9 === 0 ? "#aaddff" : i % 7 === 0 ? "#ffddaa" : "#ffffff"
}));

// Nebula clouds (static per session, rebuilt on initGame)
let NEBULAS = [];
function buildNebulas() {
    NEBULAS = Array.from({ length: 5 }, (_, i) => ({
        x:     (.1 + (i * .21)) % 1,
        y:     .05 + (i * .18) % .65,
        r:     55 + i * 22,
        hue:   [200, 280, 320, 180, 260][i],
        alpha: .06 + i * .012
    }));
}

// Planets (static per session)
let PLANETS = [];
function buildPlanets() {
    PLANETS = [
        { xN: .78, yN: .12, r: 22, hue: 38,  ring: true  },
        { xN: .14, yN: .22, r: 13, hue: 160, ring: false },
        { xN: .62, yN: .06, r:  8, hue: 320, ring: false },
    ];
}

// Shooting stars
let SHOOTS = [];
let lastShootFrame = -300;

function drawBg() {
    const W = canvas.width, H = canvas.height;
    const groundY = H - GROUND;

    /* ── Deep space base ── */
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,    "#00010d");
    sky.addColorStop(.4,   "#010620");
    sky.addColorStop(.75,  "#020b30");
    sky.addColorStop(1,    "#030d3a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    /* ── Nebulas ── */
    NEBULAS.forEach(n => {
        const nx = n.x * W, ny = n.y * H;
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r * (W / 400));
        ng.addColorStop(0,   `hsla(${n.hue},80%,55%,${n.alpha * 2})`);
        ng.addColorStop(.5,  `hsla(${n.hue},70%,40%,${n.alpha})`);
        ng.addColorStop(1,   "transparent");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(nx, ny, n.r * (W / 400), 0, Math.PI * 2);
        ctx.fill();
    });

    /* ── Stars (twinkle) ── */
    STAR_FIELD.forEach((s, i) => {
        const sx = s.x * W;
        const sy = s.y * groundY * 1.05;
        if (sy > groundY) return;
        const alpha = .3 + .7 * Math.abs(Math.sin(frames * .014 + s.phase));
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = s.color;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    /* ── Shooting stars ── */
    if (frames - lastShootFrame > 220 + (Math.random() * 180 | 0)) {
        lastShootFrame = frames;
        SHOOTS.push({
            x: Math.random() * W * .8, y: Math.random() * groundY * .4,
            vx: 4 + Math.random() * 3, vy: 1.5 + Math.random() * 2,
            life: 35, maxLife: 35
        });
    }
    for (let i = SHOOTS.length - 1; i >= 0; i--) {
        const s = SHOOTS[i];
        s.x += s.vx; s.y += s.vy; s.life--;
        if (s.life <= 0 || s.x > W || s.y > groundY) { SHOOTS.splice(i, 1); continue; }
        const a = s.life / s.maxLife;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 10, s.y - s.vy * 10);
        grad.addColorStop(0,   `rgba(255,255,255,${a})`);
        grad.addColorStop(1,   "transparent");
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1.5 * a;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 10, s.y - s.vy * 10);
        ctx.stroke();
    }

    /* ── Planets ── */
    PLANETS.forEach(p => {
        const px = p.xN * W, py = p.yN * groundY;
        const r  = p.r * (W / 390);
        ctx.save();
        // planet glow
        const glow = ctx.createRadialGradient(px, py, r * .4, px, py, r * 2.2);
        glow.addColorStop(0,   `hsla(${p.hue},70%,55%,.14)`);
        glow.addColorStop(1,   "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(px, py, r * 2.2, 0, Math.PI * 2); ctx.fill();

        // planet body
        const pg = ctx.createRadialGradient(px - r * .35, py - r * .35, r * .1, px, py, r);
        pg.addColorStop(0,   `hsl(${p.hue},60%,75%)`);
        pg.addColorStop(.5,  `hsl(${p.hue},55%,45%)`);
        pg.addColorStop(1,   `hsl(${p.hue},50%,20%)`);
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();

        // ring (Saturn-style)
        if (p.ring) {
            ctx.globalAlpha = .55;
            ctx.strokeStyle = `hsl(${p.hue},60%,65%)`;
            ctx.lineWidth   = r * .28;
            ctx.beginPath();
            ctx.ellipse(px, py, r * 1.9, r * .45, -.3, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    });

    /* ── Asteroid belt / ground ── */
    const asteroidY = groundY;
    // dark rocky surface
    const groundG = ctx.createLinearGradient(0, asteroidY, 0, H);
    groundG.addColorStop(0,   "#1a1424");
    groundG.addColorStop(.3,  "#120e1c");
    groundG.addColorStop(1,   "#0a0812");
    ctx.fillStyle = groundG;
    ctx.fillRect(0, asteroidY, W, GROUND);

    // rocky surface silhouette
    ctx.fillStyle = "#1a1424";
    ctx.beginPath();
    ctx.moveTo(0, asteroidY);
    const rockPts = [0,.6, .08,.3, .16,.7, .24,.4, .33,.8, .41,.35,
                     .5,.65, .58,.28, .67,.72, .75,.42, .83,.68, .92,.3, 1,.55];
    for (let i = 0; i < rockPts.length; i += 2) {
        ctx.lineTo(rockPts[i] * W, asteroidY - rockPts[i+1] * 14);
    }
    ctx.lineTo(W, asteroidY); ctx.closePath(); ctx.fill();

    // neon horizon glow
    ctx.save();
    ctx.shadowColor = "#4488ff";
    ctx.shadowBlur  = 28;
    ctx.strokeStyle = "#6699ff";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, asteroidY); ctx.lineTo(W, asteroidY);
    ctx.stroke();
    ctx.restore();

    // subtle space dust streaks on ground
    ctx.save();
    ctx.globalAlpha = .18;
    ctx.strokeStyle = "#4466cc";
    ctx.lineWidth   = 1;
    const dustOff = (frames * speed * .4) % 50;
    for (let x = -dustOff; x < W; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, asteroidY + 8);
        ctx.lineTo(x + 35, H);
        ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
}

/* ════════════════════════════════
   PIPE — ASTEROID ROCK PILLARS
   ════════════════════════════════ */
function drawPipe(x, topH, bottomY) {
    const W    = PIPE_W;
    const capH = 28;
    const capX = x - 9;
    const capW = W + 18;

    ctx.save();

    /* ── Helper: draw one pillar segment ── */
    function drawRockBody(rx, ry, rw, rh) {
        if (rh <= 0) return;
        const bg = ctx.createLinearGradient(rx, 0, rx + rw, 0);
        bg.addColorStop(0,    "#1a0e2e");
        bg.addColorStop(.18,  "#3a2060");
        bg.addColorStop(.42,  "#6a3aaa");
        bg.addColorStop(.62,  "#4a2888");
        bg.addColorStop(.82,  "#2d1655");
        bg.addColorStop(1,    "#130828");
        ctx.fillStyle = bg;
        ctx.fillRect(rx, ry, rw, rh);

        // crack lines — give rocky texture
        ctx.globalAlpha = .22;
        ctx.strokeStyle = "#aa66ff";
        ctx.lineWidth   = 1;
        [[.28, .45], [.6, .72]].forEach(([t1, t2]) => {
            ctx.beginPath();
            ctx.moveTo(rx + rw * t1, ry);
            ctx.lineTo(rx + rw * t2, ry + rh * .45);
            ctx.lineTo(rx + rw * (t2 - .12), ry + rh);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        // shine strip
        ctx.globalAlpha = .18;
        ctx.fillStyle   = "#cc99ff";
        ctx.fillRect(rx + 7, ry, 4, rh);
        ctx.globalAlpha = 1;
    }

    /* ── Helper: draw cap + crystal spikes ── */
    function drawCap(cx, cy, cw, ch, flipped) {
        ctx.shadowColor = "#bb44ff";
        ctx.shadowBlur  = 18;

        const cg = ctx.createLinearGradient(cx, 0, cx + cw, 0);
        cg.addColorStop(0,    "#160826");
        cg.addColorStop(.2,   "#5522aa");
        cg.addColorStop(.48,  "#cc88ff");
        cg.addColorStop(.72,  "#6633bb");
        cg.addColorStop(1,    "#160826");
        ctx.fillStyle = cg;

        // beveled cap
        const bev = 5;
        ctx.beginPath();
        if (!flipped) {
            ctx.moveTo(cx + bev, cy);
            ctx.lineTo(cx + cw - bev, cy);
            ctx.lineTo(cx + cw, cy + ch);
            ctx.lineTo(cx, cy + ch);
        } else {
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + cw, cy);
            ctx.lineTo(cx + cw - bev, cy + ch);
            ctx.lineTo(cx + bev, cy + ch);
        }
        ctx.closePath();
        ctx.fill();

        // crystal spikes
        const spikeDir = flipped ? -1 : 1;
        const spikeBase = flipped ? cy : cy;
        const spikeTip  = flipped ? cy - 1 : cy;  // direction of spikes
        ctx.fillStyle   = "#eeccff";
        ctx.shadowColor = "#dd99ff";
        ctx.shadowBlur  = 12;

        const sCount = 6;
        const sw2 = cw / sCount;
        const spikeHeights = [10, 15, 8, 18, 11, 13];
        for (let s = 0; s < sCount; s++) {
            const sx  = cx + s * sw2;
            const sh2 = spikeHeights[s % spikeHeights.length];
            const tipY = flipped ? cy - sh2 : cy - sh2;
            ctx.beginPath();
            ctx.moveTo(sx,         cy);
            ctx.lineTo(sx + sw2 * .5, cy - sh2 * spikeDir);
            ctx.lineTo(sx + sw2,   cy);
            ctx.closePath();
            ctx.fill();
        }

        // glowing rune dots along cap center
        ctx.shadowBlur = 8;
        [.2, .5, .8].forEach(t => {
            const dotX = cx + cw * t;
            const dotY = cy + ch * .5;
            const pulse = .5 + .5 * Math.sin(frames * .07 + t * 10);
            ctx.globalAlpha = .5 + pulse * .5;
            ctx.fillStyle   = "#ff99ff";
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
    }

    /* ── Draw ── */
    ctx.shadowColor = "#8833cc";
    ctx.shadowBlur  = 10;

    // top body
    drawRockBody(x, 0, W, topH - capH);
    // top cap (spikes point UP = not flipped)
    drawCap(capX, topH - capH, capW, capH, false);

    // bottom cap (spikes point DOWN = flipped)
    drawCap(capX, bottomY, capW, capH, true);
    // bottom body
    drawRockBody(x, bottomY + capH, W, canvas.height - (bottomY + capH));

    ctx.restore();
}
/* Coin – spinning illusion */
function drawCoin(x, y, frame) {
    const scaleX = Math.abs(Math.cos(frame * .09));

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, 1);
    ctx.shadowColor = "#ffcc00";
    ctx.shadowBlur  = 18;

    const cg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 13);
    cg.addColorStop(0,   "#fffaaa");
    cg.addColorStop(.4,  "#ffd700");
    cg.addColorStop(1,   "#a07000");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();

    // inner ring
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = "#8b6400";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();

    // symbol
    if (scaleX > .25) {
        ctx.globalAlpha = scaleX;
        ctx.fillStyle   = "#7a5500";
        ctx.font        = "bold 10px Rajdhani, sans-serif";
        ctx.textAlign   = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("¢", 0, 0);
    }
    ctx.restore();
}

/* ════════════════════════════════
   BIRD — ROCKET SHIP 🚀
   ════════════════════════════════ */
function drawBird(b) {
    ctx.save();
    ctx.translate(b.x + 20, b.y + 15);

    // tilt with velocity
    const angle = Math.min(Math.max(b.vel * .055, -.5), 1.1);
    ctx.rotate(angle);

    /* ── Engine exhaust trail ── */
    const exhaustFlicker = .6 + .4 * Math.sin(frames * .55);
    for (let t = 6; t >= 1; t--) {
        const tx   = -t * 6.5;
        const ty   = Math.sin(frames * .42 + t) * 2.2;
        const tr   = (7 - t) * exhaustFlicker;
        const ta   = (1 - t / 7) * .75;
        const eg   = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr + 2);
        // core: white-blue → orange rim → transparent
        eg.addColorStop(0,   `rgba(200,230,255,${ta})`);
        eg.addColorStop(.3,  `rgba(80,160,255,${ta * .9})`);
        eg.addColorStop(.65, `rgba(255,100,20,${ta * .55})`);
        eg.addColorStop(1,   "transparent");
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(tx, ty, tr + 4, 0, Math.PI * 2);
        ctx.fill();
    }

    /* ── Side fins ── */
    ctx.shadowColor = "#4488ff";
    ctx.shadowBlur  = 8;
    // left fin (bottom)
    const finG = ctx.createLinearGradient(0, 4, -10, 14);
    finG.addColorStop(0,   "#335588");
    finG.addColorStop(1,   "#112244");
    ctx.fillStyle = finG;
    ctx.beginPath();
    ctx.moveTo(-2, 6);
    ctx.lineTo(-12, 14);
    ctx.lineTo(-2, 11);
    ctx.closePath();
    ctx.fill();
    // right fin (top)
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.lineTo(-12, -14);
    ctx.lineTo(-2, -11);
    ctx.closePath();
    ctx.fill();

    /* ── Body — metallic fuselage ── */
    ctx.shadowColor = "#88bbff";
    ctx.shadowBlur  = 16;
    const bodyG = ctx.createLinearGradient(-14, -12, 14, 12);
    bodyG.addColorStop(0,   "#eef4ff");
    bodyG.addColorStop(.25, "#aaccff");
    bodyG.addColorStop(.55, "#4477cc");
    bodyG.addColorStop(.8,  "#224488");
    bodyG.addColorStop(1,   "#112255");
    ctx.fillStyle = bodyG;
    // rounded rectangle body
    ctx.beginPath();
    ctx.moveTo(-14,  0);
    ctx.bezierCurveTo(-14, -12,  -6, -14,  2, -12);
    ctx.lineTo(18, -4);
    ctx.bezierCurveTo(22, -2, 22, 2, 18, 4);
    ctx.lineTo(2, 12);
    ctx.bezierCurveTo(-6, 14, -14, 12, -14, 0);
    ctx.closePath();
    ctx.fill();

    /* ── Nose cone ── */
    ctx.shadowBlur = 10;
    const noseG = ctx.createLinearGradient(16, -4, 26, 0);
    noseG.addColorStop(0,   "#ffffff");
    noseG.addColorStop(.4,  "#ff5544");
    noseG.addColorStop(1,   "#cc2200");
    ctx.fillStyle = noseG;
    ctx.beginPath();
    ctx.moveTo(18, -4);
    ctx.lineTo(28, 0);
    ctx.lineTo(18, 4);
    ctx.closePath();
    ctx.fill();

    /* ── Window / cockpit ── */
    ctx.shadowBlur  = 0;
    // outer ring
    ctx.fillStyle   = "#1a3366";
    ctx.beginPath();
    ctx.arc(4, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    // glass
    const winG = ctx.createRadialGradient(2, -2, .5, 4, 0, 7);
    winG.addColorStop(0,   "#cceeff");
    winG.addColorStop(.4,  "#5599ff");
    winG.addColorStop(1,   "#002266");
    ctx.fillStyle = winG;
    ctx.beginPath();
    ctx.arc(4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // gleam
    ctx.fillStyle   = "rgba(255,255,255,.7)";
    ctx.beginPath();
    ctx.arc(2, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    /* ── Panel lines ── */
    ctx.globalAlpha = .3;
    ctx.strokeStyle = "#aaccff";
    ctx.lineWidth   = .8;
    [[-10, -8, -4, -10], [-10, 8, -4, 10]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.stroke();
    });
    ctx.globalAlpha = 1;

    /* ── Star decal on body ── */
    ctx.fillStyle   = "#ffdd44";
    ctx.shadowColor = "#ffaa00";
    ctx.shadowBlur  = 5;
    drawStar(ctx, -6, 0, 4, 2, 5);

    ctx.restore();
}

function drawStar(ctx, cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (Math.PI / points) * i - Math.PI / 2;
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
}

/* Particles */
function spawnCoinFX(x, y) {
    for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const v = 2 + Math.random() * 2.5;
        particles.push({
            x, y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 1,
            life: 28 + Math.random() * 12 | 0,
            maxLife: 40,
            hue: 35 + Math.random() * 20
        });
    }
}

function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += .12;
        p.life--;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const a = p.life / p.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle   = `hsl(${p.hue}, 100%, 60%)`;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 60%)`;
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * a + .5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
    }
}

/* Death flash */
function flashRed() {
    ctx.save();
    ctx.fillStyle = "rgba(255,30,30,.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

/* ════════════════════
   GAME LOGIC
   ════════════════════ */

function initGame() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    bird = {
        x:     canvas.width  * .18,
        y:     canvas.height * .45,
        vel:   0,
        grav:  0.35,
        wingT: 0,
        dead:  false
    };

    pipes         = [];
    coins         = [];
    particles     = [];
    score         = 0;
    coinsCollected = 0;
    frames        = 0;
    speed         = 2.6;
    deathLock     = false;
    gameState     = "playing";

    buildClouds();
    buildNebulas();
    buildPlanets();
    SHOOTS.length  = 0;
    lastShootFrame = -300;

    document.getElementById("game-over-overlay").classList.add("hidden");
    document.getElementById("game-score").textContent  = "0";
    document.getElementById("game-coins").textContent  = "0.0 🪙";
}

function spawnPipe() {
    const minTop = 70;
    const maxTop = canvas.height - GROUND - GAP_H - minTop;
    const top    = minTop + Math.random() * maxTop;

    pipes.push({ x: canvas.width + 10, top, passed: false });

    if (Math.random() < .68) {
        coins.push({
            x:    canvas.width + 10 + PIPE_W * .5,
            y:    top + GAP_H * .5,
            collected: false,
            frame: Math.random() * 100 | 0
        });
    }
}

/* Collision with 5px forgiveness */
function collidesWithPipe(p) {
    const bx = bird.x + 4,  bW = 34;
    const by = bird.y + 4,  bH = 22;
    const px = p.x - 6,     pW = PIPE_W + 12; // include cap width

    if (bx + bW > px && bx < px + pW) {
        if (by < p.top || by + bH > p.top + GAP_H) return true;
    }
    return false;
}

/* Main loop */
function gameFrame() {
    if (gameState !== "playing") return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBg();

    // ── bird physics
    bird.vel   += bird.grav;
    bird.vel    = Math.min(bird.vel, 13);  // terminal velocity
    bird.y     += bird.vel;
    bird.wingT += .22;

    // ── pipes
    // use filter to avoid splice-in-forEach bug
    pipes = pipes.filter(p => p.x + PIPE_W + 12 > -10);
    pipes.forEach(p => {
        p.x -= speed;
        drawPipe(p.x, p.top, p.top + GAP_H);

        if (!p.passed && p.x + PIPE_W < bird.x) {
            p.passed = true;
            score++;
            document.getElementById("game-score").textContent = score;
            speed = Math.min(2.6 + score * .07, 6.5);
        }

        if (collidesWithPipe(p)) triggerDeath();
    });

    // ── coins
    coins = coins.filter(c => c.x > -25);
    coins.forEach(c => {
        c.x -= speed;
        c.frame++;
        if (!c.collected) {
            drawCoin(c.x, c.y, c.frame);
            const dist = Math.hypot(bird.x + 20 - c.x, bird.y + 15 - c.y);
            if (dist < 30) {
                c.collected  = true;
                coinsCollected += .1;
                document.getElementById("game-coins").textContent =
                    coinsCollected.toFixed(1) + " 🪙";
                spawnCoinFX(c.x, c.y);
            }
        }
    });

    // ── particles
    drawParticles();

    // ── bird (drawn last = on top)
    drawBird(bird);

    // ── ground & ceiling kill
    if (bird.y + 26 > canvas.height - GROUND || bird.y < -40) triggerDeath();

    // ── spawn
    if (frames % 115 === 0) spawnPipe();

    frames++;
    gameLoopId = requestAnimationFrame(gameFrame);
}

/* ─── Death ─── */
function triggerDeath() {
    if (deathLock) return;
    deathLock = true;
    gameState = "dead";
    cancelAnimationFrame(gameLoopId);
    flashRed();
    endGame();
}

async function endGame() {
    userData.balance += coinsCollected;
    if (score > userData.bestScore) userData.bestScore = score;

    document.getElementById("go-score").textContent = score;
    document.getElementById("go-coins").textContent = coinsCollected.toFixed(1);
    document.getElementById("go-best").textContent  = userData.bestScore;

    setTimeout(() => {
        document.getElementById("game-over-overlay").classList.remove("hidden");
    }, 450);

    try {
        await updateDoc(doc(db, "users", userId), {
            balance:   userData.balance,
            bestScore: userData.bestScore
        });
    } catch (e) { /* offline */ }
}

function stopGame() {
    gameState = "idle";
    cancelAnimationFrame(gameLoopId);
}

/* ─── Public start ─── */
window.startGame = function () {
    cancelAnimationFrame(gameLoopId);
    showScreen("game-screen");
    initGame();
    gameLoopId = requestAnimationFrame(gameFrame);
};

/* ─── Input ─── */
function flap() {
    if (gameState === "playing") {
        bird.vel    = -7.2;
        bird.wingT  = 0;   // reset wing cycle for satisfying flap feel
    }
}

canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    flap();
}, { passive: false });

document.addEventListener("keydown", e => {
    if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
    }
});

/* ════════════════════
   MODALS / TABS
   ════════════════════ */
window.openTab = function (tab) {
    const modal   = document.getElementById("tab-modal");
    const content = document.getElementById("tab-content");
    modal.classList.remove("hidden");

    const T = {
        ua: { shop: "Магазин", gifts: "Подарунки", friends: "Друзі",   coming: "Скоро",  active: "Активно", share: "Поділитись" },
        en: { shop: "Shop",    gifts: "Gifts",      friends: "Friends", coming: "Coming Soon", active: "Active", share: "Share Link" },
        ru: { shop: "Магазин", gifts: "Подарки",    friends: "Друзья",  coming: "Скоро",  active: "Активно", share: "Поделиться" }
    }[userData?.language || "en"];

    if (tab === "shop") {
        content.innerHTML = `
            <h2>${T.shop} 🛒</h2>
            <p>100 Coins = 1 ⭐ Star</p>
            <button class="modal-btn" disabled>${T.coming}</button>`;

    } else if (tab === "gifts") {
        const status = appConfig.payouts_enabled ? T.active : T.coming;
        content.innerHTML = `
            <h2>${T.gifts} 🎁</h2>
            <p>Status: <b style="color:#ffd700">${status}</b></p>
            <div class="gift-list">
                <div class="gift-item">🌟 15 Stars</div>
                <div class="gift-item">⭐ 25 Stars</div>
                <div class="gift-item">💫 100 Stars</div>
            </div>`;

    } else if (tab === "invite") {
        const link = `https://t.me/your_bot_name/app?startapp=ref_${userId}`;
        content.innerHTML = `
            <h2>${T.friends} 👥</h2>
            <p>+50 Coins per invite! 🎉</p>
            <button class="modal-btn"
                onclick="tg.openTelegramLink('https://t.me/share/url?url=${encodeURIComponent(link)}')"
            >${T.share} 🔗</button>`;
    }
};

window.closeModal = () =>
    document.getElementById("tab-modal").classList.add("hidden");

window.showRewardedAd = async function () {
    // Replace with real Telegram Ad SDK call when available
    alert("Ad watched! +5.0 Coins 🎉");
    userData.balance += 5;
    document.getElementById("ui-balance").textContent =
        userData.balance.toFixed(1) + " 🪙";
    try {
        await updateDoc(doc(db, "users", userId), { balance: increment(5) });
    } catch (e) { /* offline */ }
};

/* ════════════════════
   RESIZE
   ════════════════════ */
window.addEventListener("resize", () => {
    if (gameState === "playing") {
        // Safe resize: just update canvas dimensions, positions stay proportional
        const ratioY = window.innerHeight / canvas.height;
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        bird.y *= ratioY;
    }
});

/* ─── Boot ─── */
initUser();
