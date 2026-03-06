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
    const c    = document.getElementById("menuBg");
    const ctx2 = c.getContext("2d");
    c.width    = window.innerWidth;
    c.height   = window.innerHeight;
    cancelAnimationFrame(menuRafId);

    // Rain drops
    const rain = Array.from({ length: 80 }, (_, i) => ({
        x:     (i * 137.5) % c.width,
        y:     (i * 97.3)  % c.height,
        len:   8 + (i % 5) * 4,
        spd:   6 + (i % 4) * 2,
        alpha: .15 + (i % 5) * .07
    }));

    // Building layout (stable)
    const BLDS = buildCyberpunkBuildings(c.width, c.height);

    function loop() {
        menuFrames++;
        ctx2.clearRect(0, 0, c.width, c.height);

        const W = c.width, H = c.height;
        const horizonY = H * .52;

        /* ── Night sky gradient ── */
        const sky = ctx2.createLinearGradient(0, 0, 0, horizonY);
        sky.addColorStop(0,   "#000510");
        sky.addColorStop(.5,  "#050d1f");
        sky.addColorStop(1,   "#0a0820");
        ctx2.fillStyle = sky;
        ctx2.fillRect(0, 0, W, horizonY);

        /* ── Moon ── */
        const mx = W * .82, my = H * .1, mr = W * .055;
        const moonG = ctx2.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
        moonG.addColorStop(0,   "#fffde8");
        moonG.addColorStop(.6,  "#e8d888");
        moonG.addColorStop(1,   "#c8b840");
        ctx2.shadowColor = "#ffe840"; ctx2.shadowBlur = 40;
        ctx2.fillStyle   = moonG;
        ctx2.beginPath(); ctx2.arc(mx, my, mr, 0, Math.PI * 2); ctx2.fill();
        ctx2.shadowBlur = 0;

        /* ── Moon glow halo ── */
        const mg = ctx2.createRadialGradient(mx, my, mr, mx, my, mr * 3);
        mg.addColorStop(0,   "rgba(255,230,80,.1)");
        mg.addColorStop(1,   "transparent");
        ctx2.fillStyle = mg;
        ctx2.beginPath(); ctx2.arc(mx, my, mr * 3, 0, Math.PI * 2); ctx2.fill();

        /* ── Stars (only top portion) ── */
        for (let i = 0; i < 60; i++) {
            const sx = (i * 173.7 + 11) % W;
            const sy = (i * 83.1  + 7)  % (horizonY * .8);
            const sa = .2 + .6 * Math.abs(Math.sin(menuFrames * .015 + i * .7));
            ctx2.globalAlpha = sa;
            ctx2.fillStyle   = i % 6 === 0 ? "#ffe8aa" : "#ffffff";
            ctx2.fillRect(sx | 0, sy | 0, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
        }
        ctx2.globalAlpha = 1;

        /* ── Far buildings (silhouette) ── */
        ctx2.fillStyle = "#08081a";
        BLDS.far.forEach(b => ctx2.fillRect(b.x, horizonY - b.h, b.w, b.h));

        /* ── Mid buildings with neon windows ── */
        BLDS.mid.forEach(b => {
            // building body
            const bg2 = ctx2.createLinearGradient(b.x, horizonY - b.h, b.x + b.w, horizonY);
            bg2.addColorStop(0, "#0d0d22");
            bg2.addColorStop(1, "#080812");
            ctx2.fillStyle = bg2;
            ctx2.fillRect(b.x, horizonY - b.h, b.w, b.h);

            // windows
            b.wins.forEach(w => {
                const flicker = Math.sin(menuFrames * w.fspd + w.phase) > .7 ? 0 : 1;
                ctx2.globalAlpha = flicker * (.5 + .5 * Math.sin(menuFrames * .03 + w.phase));
                ctx2.fillStyle   = w.color;
                ctx2.shadowColor = w.color;
                ctx2.shadowBlur  = 6;
                ctx2.fillRect(b.x + w.ox, horizonY - b.h + w.oy, w.w, w.h);
            });
            ctx2.globalAlpha = 1;
            ctx2.shadowBlur  = 0;
        });

        /* ── Ground / street ── */
        const streetG = ctx2.createLinearGradient(0, horizonY, 0, H);
        streetG.addColorStop(0,   "#0a0818");
        streetG.addColorStop(.4,  "#080614");
        streetG.addColorStop(1,   "#040408");
        ctx2.fillStyle = streetG;
        ctx2.fillRect(0, horizonY, W, H - horizonY);

        /* ── Street reflections (wet road) ── */
        BLDS.mid.forEach(b => {
            b.wins.forEach(w => {
                ctx2.globalAlpha = .12;
                ctx2.fillStyle   = w.color;
                const ry = horizonY + (H - horizonY) * .3;
                ctx2.fillRect(b.x + w.ox + (Math.sin(menuFrames * .02) * 2), ry, w.w, 3);
            });
        });
        ctx2.globalAlpha = 1;

        /* ── Neon horizon line ── */
        ctx2.save();
        ctx2.shadowColor = "#ff00cc"; ctx2.shadowBlur = 30;
        ctx2.strokeStyle = "#ff44dd"; ctx2.lineWidth = 2;
        ctx2.beginPath(); ctx2.moveTo(0, horizonY); ctx2.lineTo(W, horizonY); ctx2.stroke();
        ctx2.restore();

        /* ── Rain ── */
        ctx2.strokeStyle = "#6688ff";
        ctx2.lineWidth   = 1;
        rain.forEach(r => {
            r.y += r.spd;
            if (r.y > H) { r.y = -r.len; r.x = Math.random() * W; }
            ctx2.globalAlpha = r.alpha;
            ctx2.beginPath();
            ctx2.moveTo(r.x, r.y);
            ctx2.lineTo(r.x - 1, r.y + r.len);
            ctx2.stroke();
        });
        ctx2.globalAlpha = 1;

        /* ── Neon signs flicker on buildings ── */
        const signs = [
            { x: W * .12, y: horizonY - BLDS.mid[0]?.h * .4 || horizonY - 80, text: "NEON", color: "#ff0088" },
            { x: W * .6,  y: horizonY - (BLDS.mid[2]?.h * .5 || 100),          text: "BAR",  color: "#00ffcc" },
        ];
        signs.forEach(s => {
            const pulse = .7 + .3 * Math.sin(menuFrames * .08 + s.x);
            ctx2.globalAlpha = pulse;
            ctx2.shadowColor = s.color; ctx2.shadowBlur = 18;
            ctx2.fillStyle   = s.color;
            ctx2.font        = `bold ${W * .04}px Orbitron, monospace`;
            ctx2.fillText(s.text, s.x, s.y);
        });
        ctx2.globalAlpha = 1; ctx2.shadowBlur = 0;

        menuRafId = requestAnimationFrame(loop);
    }
    loop();
}

function buildCyberpunkBuildings(W, H) {
    const horizonY = H * .52;
    const far = [];
    const mid = [];
    const neonColors = ["#ff0088","#00ffcc","#ff8800","#aa00ff","#00aaff","#ffff00"];

    // Far silhouette buildings
    for (let i = 0; i < 18; i++) {
        far.push({
            x: i * (W / 17) - 5,
            w: 18 + (i % 4) * 12,
            h: 40 + (i % 6) * 30
        });
    }

    // Mid detailed buildings
    const bldCount = 7;
    for (let i = 0; i < bldCount; i++) {
        const bw = 28 + (i % 3) * 22;
        const bh = 80 + (i % 5) * 55;
        const bx = i * (W / (bldCount - 1)) - bw / 2;
        const wins = [];
        const rows = Math.floor(bh / 14);
        const cols = Math.floor(bw / 10);
        for (let r = 1; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (Math.random() > .45) {
                    wins.push({
                        ox: c * 10 + 3, oy: r * 14 - 10,
                        w: 5, h: 7,
                        color:  neonColors[Math.floor(Math.random() * neonColors.length)],
                        phase: Math.random() * Math.PI * 2,
                        fspd:  .005 + Math.random() * .02
                    });
                }
            }
        }
        mid.push({ x: bx, w: bw, h: bh, wins });
    }
    return { far, mid };
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
   BACKGROUND — CYBERPUNK NIGHT CITY
   ════════════════════════════════ */

// Static city layout (built once per game session)
let CITY_BLDS_FAR  = [];
let CITY_BLDS_MID  = [];
let CITY_BLDS_NEAR = [];
let RAIN_DROPS     = [];
const NEON_COLORS  = ["#ff0088","#00ffcc","#ff8800","#aa00ff","#00aaff","#ff4400","#ffff00"];

function buildCityLayout() {
    const W = canvas.width, H = canvas.height;
    const groundY = H - GROUND;
    CITY_BLDS_FAR  = [];
    CITY_BLDS_MID  = [];
    CITY_BLDS_NEAR = [];
    RAIN_DROPS     = [];

    // Far silhouette
    for (let i = 0; i < 22; i++) {
        CITY_BLDS_FAR.push({
            x: i * (W / 20) - 8,
            w: 20 + (i % 4) * 14,
            h: 35 + (i % 6) * 28
        });
    }
    // Mid buildings with neon windows
    for (let i = 0; i < 9; i++) {
        const bw = 26 + (i % 3) * 20;
        const bh = 70 + (i % 5) * 50;
        const bx = i * (W / 8) - bw / 2;
        const wins = [];
        const rows = Math.floor(bh / 13);
        const cols = Math.floor(bw / 9);
        for (let r = 1; r < rows; r++) {
            for (let c2 = 0; c2 < cols; c2++) {
                if (Math.random() > .48) {
                    wins.push({
                        ox: c2 * 9 + 2, oy: r * 13 - 9,
                        w: 4, h: 6,
                        color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
                        phase: Math.random() * Math.PI * 2,
                        fspd: .004 + Math.random() * .015
                    });
                }
            }
        }
        CITY_BLDS_MID.push({ x: bx, w: bw, h: bh, wins, scrollFactor: .3 });
    }
    // Near buildings (fast parallax, just silhouette)
    for (let i = 0; i < 6; i++) {
        CITY_BLDS_NEAR.push({
            x: i * (W / 5) - 15,
            w: 35 + (i % 3) * 18,
            h: 30 + (i % 4) * 20,
            scrollFactor: .7
        });
    }
    // Rain
    for (let i = 0; i < 100; i++) {
        RAIN_DROPS.push({
            x:     Math.random() * W,
            y:     Math.random() * H,
            len:   6 + (i % 5) * 3,
            spd:   7 + (i % 4) * 2,
            alpha: .1 + (i % 6) * .04
        });
    }
}

function drawBg() {
    const W = canvas.width, H = canvas.height;
    const groundY = H - GROUND;
    const horizonY = groundY - H * .18;  // city skyline sits above ground

    /* ── Night sky ── */
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0,   "#000510");
    sky.addColorStop(.5,  "#04091c");
    sky.addColorStop(1,   "#090618");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizonY);

    /* ── Stars ── */
    for (let i = 0; i < 50; i++) {
        const sx = (i * 173.7 + 11) % W;
        const sy = (i * 83.1  + 7)  % (horizonY * .75);
        ctx.globalAlpha = .2 + .6 * Math.abs(Math.sin(frames * .014 + i * .8));
        ctx.fillStyle   = i % 7 === 0 ? "#ffe8aa" : "#ffffff";
        ctx.fillRect(sx | 0, sy | 0, i % 6 === 0 ? 2 : 1, i % 6 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    /* ── Moon ── */
    const moonX = W * .85, moonY = H * .08, moonR = W * .045;
    const moonG = ctx.createRadialGradient(moonX - moonR * .3, moonY - moonR * .3, moonR * .1, moonX, moonY, moonR);
    moonG.addColorStop(0,   "#fffde8");
    moonG.addColorStop(.6,  "#e8d888");
    moonG.addColorStop(1,   "#c8b840");
    ctx.save();
    ctx.shadowColor = "#ffe840"; ctx.shadowBlur = 35;
    ctx.fillStyle   = moonG;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* ── Far buildings silhouette (no scroll) ── */
    ctx.fillStyle = "#07071a";
    CITY_BLDS_FAR.forEach(b => {
        ctx.fillRect(b.x, horizonY - b.h, b.w, b.h);
    });

    /* ── Mid buildings with windows (slow scroll) ── */
    const midOff = (frames * speed * .18) % (canvas.width * 1.2);
    CITY_BLDS_MID.forEach((b, bi) => {
        const bx = ((b.x - midOff * b.scrollFactor) % (W + b.w + 50) + W + b.w + 50) % (W + b.w + 50) - b.w;
        // building body
        const bdg = ctx.createLinearGradient(bx, horizonY - b.h, bx + b.w, horizonY);
        bdg.addColorStop(0, "#0c0c20");
        bdg.addColorStop(1, "#070710");
        ctx.fillStyle = bdg;
        ctx.fillRect(bx, horizonY - b.h, b.w, b.h);
        // windows
        b.wins.forEach(w => {
            const flicker = Math.sin(frames * w.fspd + w.phase) > .75 ? 0 : 1;
            ctx.globalAlpha = flicker * (.4 + .55 * Math.abs(Math.sin(frames * .025 + w.phase)));
            ctx.fillStyle   = w.color;
            ctx.shadowColor = w.color;
            ctx.shadowBlur  = 5;
            ctx.fillRect(bx + w.ox, horizonY - b.h + w.oy, w.w, w.h);
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
    });

    /* ── Street / ground ── */
    const streetG = ctx.createLinearGradient(0, horizonY, 0, groundY);
    streetG.addColorStop(0,   "#08061a");
    streetG.addColorStop(.6,  "#050410");
    streetG.addColorStop(1,   "#030308");
    ctx.fillStyle = streetG;
    ctx.fillRect(0, horizonY, W, groundY - horizonY);

    /* ── Wet road reflections ── */
    CITY_BLDS_MID.forEach((b, bi) => {
        const bx = ((b.x - (frames * speed * .18) * b.scrollFactor) % (W + b.w + 50) + W + b.w + 50) % (W + b.w + 50) - b.w;
        b.wins.forEach(w => {
            if (Math.random() > .06) return;
            ctx.globalAlpha = .08;
            ctx.fillStyle   = w.color;
            const ry = horizonY + (groundY - horizonY) * (.3 + Math.random() * .4);
            ctx.fillRect(bx + w.ox + Math.sin(frames * .03) * 3, ry, w.w * 2, 2);
        });
    });
    ctx.globalAlpha = 1;

    /* ── Near dark buildings (fast, no windows) ── */
    const nearOff = (frames * speed * .55) % (W * 1.5);
    ctx.fillStyle = "#040410";
    CITY_BLDS_NEAR.forEach(b => {
        const bx = ((b.x - nearOff) % (W + b.w + 60) + W + b.w + 60) % (W + b.w + 60) - b.w;
        ctx.fillRect(bx, groundY - b.h, b.w, b.h);
    });

    /* ── Ground ── */
    const gg = ctx.createLinearGradient(0, groundY, 0, H);
    gg.addColorStop(0,  "#0e0a1e");
    gg.addColorStop(.4, "#080614");
    gg.addColorStop(1,  "#040408");
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundY, W, GROUND);

    /* ── Horizon neon glow ── */
    ctx.save();
    ctx.shadowColor = "#ff00cc"; ctx.shadowBlur = 30;
    ctx.strokeStyle = "#ff44dd"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, horizonY); ctx.lineTo(W, horizonY); ctx.stroke();
    // ground line
    ctx.shadowColor = "#ff00cc"; ctx.shadowBlur = 18;
    ctx.strokeStyle = "#cc22aa"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
    ctx.restore();

    /* ── Rain ── */
    ctx.strokeStyle = "#4466cc";
    ctx.lineWidth   = .8;
    RAIN_DROPS.forEach(r => {
        r.y += r.spd;
        if (r.y > H) { r.y = -r.len; r.x = Math.random() * W; }
        ctx.globalAlpha = r.alpha;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - .8, r.y + r.len);
        ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
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
    buildCityLayout();

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
    // VIP x2 multiplier
    const isVIP     = checkVIP();
    const multiplier = isVIP ? 2 : 1;
    const earned     = coinsCollected * multiplier;

    userData.balance += earned;
    if (score > userData.bestScore) userData.bestScore = score;

    document.getElementById("go-score").textContent = score;
    document.getElementById("go-coins").textContent =
        isVIP ? `${earned.toFixed(1)} 🪙 (x2 VIP!)` : coinsCollected.toFixed(1);
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

function checkVIP() {
    const vipUntil = userData?.vipUntil;
    if (!vipUntil) return false;
    return new Date(vipUntil) > new Date();
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

    if (tab === "shop")   renderShop(content);
    if (tab === "gifts")  renderGifts(content);
    if (tab === "invite") renderInvite(content);
};

/* ─── SHOP ─── */
function renderShop(content) {
    const isVIP    = checkVIP();
    const vipUntil = userData?.vipUntil;
    const vipLabel = isVIP
        ? `✅ VIP активний до ${new Date(vipUntil).toLocaleDateString()}`
        : "❌ VIP не активний";

    content.innerHTML = `
    <h2>🛒 Магазин</h2>

    <!-- Tabs -->
    <div style="display:flex;gap:6px;margin-bottom:16px">
        ${["vip","coins","items"].map(t => `
        <button onclick="shopTab('${t}')"
            id="stab-${t}"
            style="flex:1;padding:8px 4px;border-radius:10px;border:1px solid rgba(255,255,255,.15);
                   background:${t==='vip'?'rgba(255,215,0,.15)':'rgba(255,255,255,.05)'};
                   color:#fff;font-family:Rajdhani,sans-serif;font-size:.85rem;font-weight:600;cursor:pointer">
            ${{vip:"👑 VIP", coins:"💰 Монети", items:"🎒 Предмети"}[t]}
        </button>`).join("")}
    </div>

    <div id="shop-section">
        <!-- VIP section shown by default -->
        <div style="background:linear-gradient(135deg,rgba(255,180,0,.12),rgba(255,100,0,.08));
                    border:1px solid rgba(255,215,0,.3);border-radius:16px;padding:14px;margin-bottom:12px">
            <div style="font-size:.8rem;color:var(--gold);font-weight:700;margin-bottom:4px">
                👑 ТВІЙ VIP СТАТУС
            </div>
            <div style="font-size:.85rem;color:#ddd">${vipLabel}</div>
            <div style="font-size:.75rem;color:var(--text2);margin-top:4px">🎯 VIP дає x2 монет після кожної гри</div>
        </div>

        ${[
            { id:"vip_1m", icon:"👑", title:"VIP 1 місяць",  desc:"x2 монет · 30 днів",  stars:100, months:1  },
            { id:"vip_2m", icon:"👑", title:"VIP 2 місяці",  desc:"x2 монет · 60 днів",  stars:175, months:2, badge:"ВИГОДА" },
            { id:"vip_3m", icon:"👑", title:"VIP 3 місяці",  desc:"x2 монет · 90 днів",  stars:250, months:3, badge:"BEST"   },
        ].map(item => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;
                    background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);
                    border-radius:14px;margin-bottom:8px;position:relative">
            ${item.badge ? `<span style="position:absolute;top:8px;right:8px;background:var(--gold);
                color:#000;font-size:.6rem;font-weight:700;padding:2px 6px;border-radius:6px">
                ${item.badge}</span>` : ""}
            <span style="font-size:2rem">${item.icon}</span>
            <div style="flex:1">
                <div style="font-weight:700">${item.title}</div>
                <div style="font-size:.75rem;color:var(--text2)">${item.desc}</div>
            </div>
            <button onclick="buyVIP(${item.months},${item.stars})"
                style="padding:8px 14px;background:linear-gradient(135deg,#ffaa00,#ff6600);
                       border:none;border-radius:50px;color:#000;font-weight:700;
                       font-size:.85rem;cursor:pointer;white-space:nowrap">
                ⭐ ${item.stars}
            </button>
        </div>`).join("")}
    </div>`;
}

window.shopTab = function(tab) {
    const content = document.getElementById("shop-section");
    if (!content) return;

    if (tab === "vip") {
        // re-render shop to show VIP section
        renderShop(document.getElementById("tab-content"));
        return;
    }

    if (tab === "coins") {
        content.innerHTML = [
            { stars:15,  coins:100,  badge:null        },
            { stars:60,  coins:550,  badge:"ПОПУЛЯРНЕ" },
            { stars:100, coins:1200, badge:"ВИГОДА"    },
        ].map(item => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;
                    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
                    border-radius:14px;margin-bottom:8px;position:relative">
            ${item.badge ? `<span style="position:absolute;top:8px;right:8px;background:var(--purple);
                color:#fff;font-size:.6rem;font-weight:700;padding:2px 6px;border-radius:6px">
                ${item.badge}</span>` : ""}
            <span style="font-size:2rem">💰</span>
            <div style="flex:1">
                <div style="font-weight:700">${item.coins} монет</div>
                <div style="font-size:.75rem;color:var(--text2)">${item.stars} ⭐ Stars</div>
            </div>
            <button onclick="buyCoins(${item.coins},${item.stars})"
                style="padding:8px 14px;background:linear-gradient(135deg,var(--purple),var(--purple2));
                       border:none;border-radius:50px;color:#fff;font-weight:700;
                       font-size:.85rem;cursor:pointer">
                ⭐ ${item.stars}
            </button>
        </div>`).join("");
    }

    if (tab === "items") {
        content.innerHTML = [
            { id:"extra_life", icon:"💎", title:"+1 Життя",  desc:"Продовжити гру після смерті", stars:5  },
            { id:"shield",     icon:"🛡️", title:"Щит x3",    desc:"3 захисти від труб",          stars:10 },
        ].map(item => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;
                    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
                    border-radius:14px;margin-bottom:8px">
            <span style="font-size:2rem">${item.icon}</span>
            <div style="flex:1">
                <div style="font-weight:700">${item.title}</div>
                <div style="font-size:.75rem;color:var(--text2)">${item.desc}</div>
            </div>
            <button onclick="buyItem('${item.id}',${item.stars})"
                style="padding:8px 14px;background:linear-gradient(135deg,var(--purple),var(--purple2));
                       border:none;border-radius:50px;color:#fff;font-weight:700;
                       font-size:.85rem;cursor:pointer">
                ⭐ ${item.stars}
            </button>
        </div>`).join("");
    }
};

window.buyVIP = async function(months, stars) {
    tg.showConfirm(
        `Купити VIP на ${months} міс. за ${stars} ⭐ Stars?`,
        async (ok) => {
            if (!ok) return;
            // Without backend — show instruction
            showToast("⚠️ Потрібен backend. Дивись SETUP.md");
            // When backend ready:
            // const fn = httpsCallable(functions, "createStarsInvoice");
            // const result = await fn({ itemId: `vip_${months}m` });
            // tg.openInvoice(result.data.invoiceLink, async (status) => {
            //     if (status === "paid") {
            //         await refreshUserData();
            //         showToast("✅ VIP активовано!");
            //     }
            // });
        }
    );
};

window.buyCoins = async function(coins, stars) {
    showToast("⚠️ Потрібен backend. Дивись SETUP.md");
};

window.buyItem = async function(itemId, stars) {
    showToast("⚠️ Потрібен backend. Дивись SETUP.md");
};

/* ─── GIFTS / WITHDRAWAL ─── */
function renderGifts(content) {
    const balance   = Math.floor(userData?.balance ?? 0);
    const RATE      = 200; // 200 монет = 1 Star
    const maxStars  = Math.floor(balance / RATE);
    const active    = appConfig.payouts_enabled;

    content.innerHTML = `
        <h2>💸 Виведення</h2>
        <div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);
                    border-radius:14px;padding:14px;margin-bottom:16px;text-align:left">
            <div style="font-size:.75rem;color:var(--text2);margin-bottom:4px">ТВІЙ БАЛАНС</div>
            <div style="font-family:Orbitron,monospace;font-size:1.5rem;color:var(--gold)">
                ${balance} 🪙
            </div>
            <div style="font-size:.8rem;color:#4af;margin-top:4px">≈ ${maxStars} ⭐ Stars · Курс: ${RATE} 🪙 = 1 ⭐</div>
        </div>
        ${[
            [200,  1,  null      ],
            [1000, 5,  "ВИГОДА"  ],
            [2000, 10, null      ],
            [10000,50, "МАКСИМУМ"],
        ].map(([coins, stars, badge]) => `
        <div onclick="${balance>=coins ? `doWithdraw(${coins},${stars})` : ''}"
             style="display:flex;align-items:center;justify-content:space-between;
                    padding:11px 14px;margin-bottom:7px;border-radius:12px;
                    border:1px solid rgba(255,255,255,${balance>=coins?'.14':'.05'});
                    background:rgba(255,255,255,${balance>=coins?'.05':'.02'});
                    opacity:${balance>=coins?1:.4};cursor:${balance>=coins?'pointer':'default'}">
            <span style="color:var(--gold);font-family:Orbitron,monospace;font-size:.9rem">${coins} 🪙</span>
            <div style="display:flex;align-items:center;gap:8px">
                ${badge?`<span style="background:var(--purple);color:#fff;font-size:.6rem;
                    padding:2px 6px;border-radius:6px">${badge}</span>`:""}
                <span style="color:#4af;font-weight:700;font-size:.95rem">${stars} ⭐</span>
            </div>
        </div>`).join("")}
        <div style="font-size:.72rem;color:var(--text2);line-height:1.6;margin-top:10px">
            ${active
                ? "🟢 Виплати активні · Обробка 24–48 год"
                : "🟡 Виплати тимчасово призупинені"}
        </div>`;
}

window.doWithdraw = function(coins, stars) {
    if (!appConfig.payouts_enabled) return showToast("⚠️ Виплати тимчасово недоступні");
    tg.showConfirm(
        `Вивести ${coins} 🪙 → ${stars} ⭐ Stars?`,
        async (ok) => {
            if (!ok) return;
            showToast("⚠️ Потрібен backend. Дивись SETUP.md");
        }
    );
};

/* ─── INVITE ─── */
function renderInvite(content) {
    const link     = `https://t.me/Star_Fly_Bot/app?startapp=ref_${userId}`;
    const refCount = userData?.referralCount ?? 0;

    content.innerHTML = `
        <h2>👥 Запроси друзів</h2>
        <div style="display:flex;gap:8px;margin-bottom:16px">
            <div style="flex:1;padding:12px;background:rgba(255,255,255,.04);
                        border:1px solid rgba(255,255,255,.09);border-radius:14px;text-align:center">
                <div style="font-family:Orbitron,monospace;font-size:1.4rem;color:var(--gold)">${refCount}</div>
                <div style="font-size:.7rem;color:var(--text2);margin-top:2px">ЗАПРОШЕНИХ</div>
            </div>
            <div style="flex:1;padding:12px;background:rgba(255,255,255,.04);
                        border:1px solid rgba(255,255,255,.09);border-radius:14px;text-align:center">
                <div style="font-family:Orbitron,monospace;font-size:1.4rem;color:#4af">${refCount * 50}</div>
                <div style="font-size:.7rem;color:var(--text2);margin-top:2px">МОНЕТ ЗАРОБЛЕНО</div>
            </div>
        </div>
        <div style="background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);
                    border-radius:14px;padding:12px;margin-bottom:16px;text-align:left;
                    font-size:.85rem;line-height:2;color:#ddd">
            👤 Друг приєднався → +50 монет тобі<br>
            🎮 Друг отримує → +10 монет старт<br>
            ♾️ Без ліміту запрошень
        </div>
        <button onclick="shareLink('${encodeURIComponent(link)}')"
            class="modal-btn" style="width:100%;justify-content:center;margin-bottom:10px">
            📤 Поділитись посиланням
        </button>
        <button onclick="copyLink('${link}')"
            class="modal-btn" style="width:100%;justify-content:center;
            background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.15);color:var(--text2)">
            📋 Скопіювати
        </button>`;
}

window.shareLink = function(encodedLink) {
    const text = encodeURIComponent("🚀 Грай у Flappy Coin! Заробляй Telegram Stars!");
    tg.openTelegramLink(`https://t.me/share/url?url=${encodedLink}&text=${text}`);
};
window.copyLink  = function(link) {
    navigator.clipboard?.writeText(link).then(() => showToast("✅ Посилання скопійовано!"));
};

window.closeModal = () =>
    document.getElementById("tab-modal").classList.add("hidden");

/* ────── REWARDED AD ────── */
window.showRewardedAd = async function () {
    try {
        const AdController = window.Adsgram.init({ blockId: "24451" });
        const result = await AdController.show();
        if (result.done) {
            userData.balance = (userData.balance ?? 0) + 5;
            document.getElementById("ui-balance").textContent = userData.balance.toFixed(1) + " 🪙";
            await updateDoc(doc(db, "users", userId), { balance: increment(5) }).catch(() => {});
            showToast("🎉 +5 монет за перегляд реклами!");
        }
    } catch (e) {
        // Якщо Adsgram не завантажився — нараховуємо монети
        if (!window.Adsgram) {
            userData.balance = (userData.balance ?? 0) + 5;
            document.getElementById("ui-balance").textContent = userData.balance.toFixed(1) + " 🪙";
            await updateDoc(doc(db, "users", userId), { balance: increment(5) }).catch(() => {});
            showToast("🎉 +5 монет!");
        } else {
            showToast("❌ Реклама недоступна, спробуй пізніше");
        }
    }
};

/* ────── TOAST ────── */
function showToast(msg) {
    const ex = document.getElementById("toast");
    if (ex) ex.remove();
    const t = document.createElement("div");
    t.id = "toast";
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:rgba(10,15,40,.95);border:1px solid rgba(34,102,255,.4);color:#fff;
        padding:12px 22px;border-radius:50px;z-index:999;font-family:Rajdhani,sans-serif;
        font-size:1rem;font-weight:600;box-shadow:0 4px 24px rgba(34,102,255,.3);
        white-space:nowrap;max-width:90vw;text-align:center`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

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
