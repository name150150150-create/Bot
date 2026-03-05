const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const bestElement = document.getElementById('best');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = 0;
let bestScore = localStorage.getItem('bestScore') || 0;
bestElement.innerText = "Рекорд: " + bestScore;

let bird = { x: 50, y: canvas.height/2, w: 30, h: 30, gravity: 0.5, lift: -8, velocity: 0 };
let pipes = [];
let frame = 0;

function draw() {
    ctx.fillStyle = "#70c5ce"; // Колір неба
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Пташка
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    ctx.fillStyle = "#f1c40f"; // Жовта пташка
    ctx.fillRect(bird.x, bird.y, bird.w, bird.h);

    // Труби
    if (frame % 90 === 0) {
        let hole = 150;
        let pos = Math.random() * (canvas.height - hole - 100) + 50;
        pipes.push({ x: canvas.width, top: pos, bottom: pos + hole });
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= 3;
        ctx.fillStyle = "#2ecc71"; // Зелена труба
        ctx.fillRect(pipes[i].x, 0, 50, pipes[i].top);
        ctx.fillRect(pipes[i].x, pipes[i].bottom, 50, canvas.height);

        // Програш
        if (bird.x + bird.w > pipes[i].x && bird.x < pipes[i].x + 50) {
            if (bird.y < pipes[i].top || bird.y + bird.h > pipes[i].bottom) resetGame();
        }
        if (pipes[i].x === 20) { score++; scoreElement.innerText = "Монети: " + score; }
        if (pipes[i].x < -50) pipes.splice(i, 1);
    }

    if (bird.y > canvas.height || bird.y < 0) resetGame();
    frame++;
    requestAnimationFrame(draw);
}

function resetGame() {
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
        bestElement.innerText = "Рекорд: " + bestScore;
    }
    score = 0;
    scoreElement.innerText = "Монети: 0";
    bird.y = canvas.height/2;
    bird.velocity = 0;
    pipes = [];
}

window.addEventListener('touchstart', () => bird.velocity = bird.lift);
window.addEventListener('mousedown', () => bird.velocity = bird.lift);

draw();
