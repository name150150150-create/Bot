import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. ТВОЯ КОНФІГУРАЦІЯ FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDGhdlbSLq_q5YXluBBpg9ug98pc72sWxM",
    authDomain: "flappy-8f1c2.firebaseapp.com",
    projectId: "flappy-8f1c2",
    storageBucket: "flappy-8f1c2.appspot.com",
    messagingSenderId: "62097720793",
    appId: "1:62097720793:web:369de18b6f345a64e085c8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tg = window.Telegram.WebApp;

tg.expand();

const userId = tg.initDataUnsafe?.user?.id?.toString() || "test_user";
let userData = null;
let appConfig = { payouts_enabled: false };
let frames = 0; 

// 2. ЛОГІКА КОРИСТУВАЧА ТА РЕФЕРАЛІВ
async function initUser() {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    const configSnap = await getDoc(doc(db, "settings", "config"));
    if (configSnap.exists()) appConfig = configSnap.data();

    if (!userSnap.exists()) {
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith('ref_')) {
            const inviterId = startParam.replace('ref_', '');
            await awardReferral(inviterId);
        }
        document.getElementById('language-screen').classList.remove('hidden');
    } else {
        userData = userSnap.data();
        showMenu();
    }
}

async function awardReferral(inviterId) {
    const inviterRef = doc(db, "users", inviterId);
    await updateDoc(inviterRef, { balance: increment(50.0) });
}

window.selectLanguage = async function(lang) {
    userData = { balance: 0.0, bestScore: 0, language: lang, skin: 'default' };
    await setDoc(doc(db, "users", userId), userData);
    document.getElementById('language-screen').classList.add('hidden');
    showMenu();
};

function showMenu() {
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('ui-balance').innerText = userData.balance.toFixed(1);
    document.getElementById('ui-best').innerText = userData.bestScore;
}

// 3. ГЕЙМПЛЕЙ (ЗАМІНЕНО НА .JPG)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameLoop, bird, pipes, coinsArr, score, coinsCollected;

const birdImg = new Image();
birdImg.src = 'bird.jpg'; // Твоя картинка JPG

const bgImg = new Image();
bgImg.src = 'bg.jpg'; // Твій фон JPG

const pipeImg = new Image();
pipeImg.src = 'pipe.jpg'; // Твоя труба JPG

const coinImg = new Image();
coinImg.src = 'coin.jpg'; // Твоя монета JPG

class Bird {
    constructor() {
        this.x = 50; this.y = canvas.height / 2;
        this.velocity = 0; this.gravity = 0.25;
    }
    update() {
        this.velocity += this.gravity;
        this.y += this.velocity;
    }
    draw() {
        ctx.drawImage(birdImg, this.x, this.y, 40, 30);
    }
}

window.startGame = function() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    bird = new Bird();
    pipes = [];
    coinsArr = [];
    coinsCollected = 0;
    frames = 0;
    gameUpdate();
};

function spawnPipe() {
    const gap = 170;
    const top = Math.random() * (canvas.height - gap - 100) + 50;
    pipes.push({ x: canvas.width, top, gap });
    
    if (Math.random() < 0.5) {
        coinsArr.push({ x: canvas.width + 20, y: top + gap/2, collected: false });
    }
}

function gameUpdate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Малюємо фон
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    
    bird.update();
    bird.draw();

    pipes.forEach((p, i) => {
        p.x -= 2;
        // Малюємо труби як картинки
        ctx.drawImage(pipeImg, p.x, 0, 50, p.top); // Верхня
        ctx.drawImage(pipeImg, p.x, p.top + p.gap, 50, canvas.height - (p.top + p.gap)); // Нижня

        if (bird.x + 30 > p.x && bird.x < p.x + 50 && (bird.y < p.top || bird.y + 25 > p.top + p.gap)) {
            endGame();
        }
        if (p.x < -50) pipes.splice(i, 1);
    });

    coinsArr.forEach((c, i) => {
        c.x -= 2;
        if (!c.collected) {
            // Малюємо монету як картинку
            ctx.drawImage(coinImg, c.x - 10, c.y - 10, 20, 20);

            let dist = Math.hypot(bird.x - c.x, bird.y - c.y);
            if (dist < 35) {
                c.collected = true;
                coinsCollected += 0.1;
                document.getElementById('game-coins').innerText = coinsCollected.toFixed(1) + " 🪙";
            }
        }
        if (c.x < -20) coinsArr.splice(i, 1);
    });

    if (frames % 120 === 0) spawnPipe();
    if (bird.y > canvas.height || bird.y < 0) endGame();
    
    frames++;
    gameLoop = requestAnimationFrame(gameUpdate);
}

async function endGame() {
    cancelAnimationFrame(gameLoop);
    userData.balance += coinsCollected;
    if (coinsCollected > userData.bestScore) userData.bestScore = Math.floor(coinsCollected);
    
    await updateDoc(doc(db, "users", userId), {
        balance: userData.balance,
        bestScore: userData.bestScore
    });
    
    alert("Game Over! Coins: " + coinsCollected.toFixed(1));
    location.reload();
}

// 4. МЕНЮ ТА МОДАЛКИ
window.openTab = function(tab) {
    const modal = document.getElementById('tab-modal');
    const content = document.getElementById('tab-content');
    modal.classList.remove('hidden');

    if (tab === 'shop') {
        content.innerHTML = `<h2>Shop</h2><p>100 Coins = 1 Star ⭐</p><button>Coming Soon</button>`;
    } else if (tab === 'gifts') {
        const status = appConfig.payouts_enabled ? "Active" : "Coming Soon";
        content.innerHTML = `<h2>Gifts</h2><p>Status: ${status}</p><ul><li>15 Stars</li><li>25 Stars</li><li>100 Stars</li></ul>`;
    } else if (tab === 'invite') {
        const link = `https://t.me/your_bot_name/app?startapp=ref_${userId}`;
        content.innerHTML = `<h2>Invite</h2><button onclick="window.Telegram.WebApp.openTelegramLink('https://t.me/share/url?url=${link}')">Share Link</button>`;
    }
};

window.closeModal = () => document.getElementById('tab-modal').classList.add('hidden');

window.showRewardedAd = async function() {
    alert("Ad Finished! +5.0 Coins");
    await updateDoc(doc(db, "users", userId), { balance: increment(5.0) });
    location.reload();
};

canvas.addEventListener('touchstart', () => { bird.velocity = -5; });
document.addEventListener('keydown', (e) => { if(e.code === 'Space') bird.velocity = -5; });

initUser();
