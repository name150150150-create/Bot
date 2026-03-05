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
    const ctx = c.getContext("2d");
    c.width   = window.innerWidth;
    c.height  = window.innerHeight;

    cancelAnimationFrame(menuRafId);
    const stars = Array.from({ length: 80 }, () => ({
        x: Math.random() * c.width,
        y: Math.random() * c.height * .8,
        r: Math.random() * 1.5 + .3,
        phase: Math.random() * Math.PI * 2
    }));

    function loop() {
        menuFrames++;
        ctx.clearRect(0, 0, c.width, c.height);

        // sky
        const sky = ctx.createLinearGradient(0, 0, 0, c.height);
        sky.addColorStop(0,   "#060318");
        sky.addColorStop(.55, "#100840");
        sky.addColorStop(.85, "#2a1060");
        sky.addColorStop(1,   "#0a0520");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, c.width, c.height);

        // stars
        stars.forEach(s => {
            const a = .4 + .6 * Math.sin(menuFrames * .02 + s.phase);
            ctx.globalAlpha = a;
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // nebula blobs
        [[c.width * .3, c.height * .2, 120, "#7711cc"],
         [c.width * .75, c.height * .35, 90, "#3311cc"]].forEach(([x, y, r, col]) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, col + "44");
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        });

        // ground
        const groundY = c.height - 55;
        const groundG = ctx.createLinearGradient(0, groundY, 0, c.height);
        groundG.addColorStop(0, "#1a0a40");
        groundG.addColorStop(1, "#0a0520");
        ctx.fillStyle = groundG;
        ctx.fillRect(0, groundY, c.width, 55);

        // neon ground line
        ctx.shadowColor = "#7700ff";
        ctx.shadowBlur  = 14;
        ctx.strokeStyle = "#aa44ff";
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(c.width, groundY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // animated perspective grid
        ctx.globalAlpha = .25;
        ctx.strokeStyle = "#7700ff";
        ctx.lineWidth   = 1;
        const seg = 32;
        const off = (menuFrames * 1.2) % seg;
        for (let x = -off; x < c.width; x += seg) {
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.lineTo(x + 28, c.height);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;

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

/* Sky + ground */
function drawBg() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0,    "#06031a");
    sky.addColorStop(.55,  "#100840");
    sky.addColorStop(.85,  "#22104a");
    sky.addColorStop(1,    "#0a0520");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // stars (deterministic, no loop object)
    for (let i = 0; i < 55; i++) {
        const sx = (i * 137.5 + 40) % canvas.width;
        const sy = (i * 97.3  + 20) % (canvas.height * .7);
        ctx.globalAlpha = .35 + .55 * Math.abs(Math.sin(frames * .018 + i));
        ctx.fillStyle = "#fff";
        ctx.fillRect(sx | 0, sy | 0, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    // nebula
    CLOUDS.forEach(c => {
        c.x -= c.spd;
        if (c.x + c.r < 0) c.x = canvas.width + c.r;
        const ng = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        ng.addColorStop(0, `rgba(120,40,220,${c.alpha})`);
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // ground
    const groundY = canvas.height - GROUND;
    const gg = ctx.createLinearGradient(0, groundY, 0, canvas.height);
    gg.addColorStop(0, "#1a0a40");
    gg.addColorStop(1, "#060318");
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundY, canvas.width, GROUND);

    // neon line
    ctx.save();
    ctx.shadowColor = "#7700ff";
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = "#aa44ff";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();
    ctx.restore();

    // perspective grid on ground
    ctx.save();
    ctx.globalAlpha = .22;
    ctx.strokeStyle = "#7700ff";
    ctx.lineWidth   = 1;
    const seg = 30, off2 = (frames * speed * .6) % seg;
    for (let x = -off2; x < canvas.width; x += seg) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x + 25, canvas.height);
        ctx.stroke();
    }
    ctx.restore();
}

/* Pipe */
function drawPipe(x, topH, bottomY) {
    const W   = PIPE_W;
    const capH = 22, capX = x - 6, capW = W + 12;

    const bodyGrad = ctx.createLinearGradient(x, 0, x + W, 0);
    bodyGrad.addColorStop(0,   "#0d3d17");
    bodyGrad.addColorStop(.25, "#2da844");
    bodyGrad.addColorStop(.55, "#3dcc5a");
    bodyGrad.addColorStop(.8,  "#2da844");
    bodyGrad.addColorStop(1,   "#0d3d17");

    ctx.save();
    ctx.shadowColor = "#00ff66";
    ctx.shadowBlur  = 8;

    // ── top pipe body
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x, 0, W, topH - capH);

    // ── top pipe cap
    const capGrad = ctx.createLinearGradient(capX, 0, capX + capW, 0);
    capGrad.addColorStop(0,   "#0d3d17");
    capGrad.addColorStop(.2,  "#1a6b2a");
    capGrad.addColorStop(.45, "#4ddc6a");
    capGrad.addColorStop(.7,  "#2da844");
    capGrad.addColorStop(1,   "#0d3d17");
    ctx.fillStyle = capGrad;
    ctx.fillRect(capX, topH - capH, capW, capH);

    // ── bottom pipe cap
    ctx.fillStyle = capGrad;
    ctx.fillRect(capX, bottomY, capW, capH);

    // ── bottom pipe body
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x, bottomY + capH, W, canvas.height - (bottomY + capH));

    // ── shine strips
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = .25;
    ctx.fillStyle   = "#ffffff";
    ctx.fillRect(x + 6, 0, 5, topH - capH);
    ctx.fillRect(x + 6, bottomY + capH, 5, canvas.height - (bottomY + capH));

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

/* Bird */
function drawBird(b) {
    ctx.save();
    ctx.translate(b.x + 20, b.y + 15);

    // rotation
    const angle = Math.min(Math.max(b.vel * .06, -.5), 1.1);
    ctx.rotate(angle);

    // glow
    ctx.shadowColor = "#ffe844";
    ctx.shadowBlur  = 22;

    // wing (flap animation)
    const wingA = Math.sin(b.wingT) * .45;
    ctx.save();
    ctx.rotate(-wingA);
    ctx.fillStyle = "#e08800";
    ctx.beginPath();
    ctx.ellipse(-5, 4, 11, 6, -.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // body
    const bg = ctx.createRadialGradient(-6, -6, 2, 0, 0, 20);
    bg.addColorStop(0, "#fff5a0");
    bg.addColorStop(.5, "#FFD700");
    bg.addColorStop(1,  "#d48000");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // eye white
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = "#fff";
    ctx.beginPath();
    ctx.arc(8, -4, 6, 0, Math.PI * 2);
    ctx.fill();

    // pupil
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(9, -3.5, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // gleam
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(10, -5, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.lineTo(24, .5);
    ctx.lineTo(14, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
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
