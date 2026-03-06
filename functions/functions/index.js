/**
 * FLAPPY COIN — Firebase Cloud Functions
 * Монетизація: Stars, Ads, Виведення, Реферали
 *
 * Встановлення:
 *   npm install -g firebase-tools
 *   firebase login
 *   firebase init functions   (вибери свій проект flappy-8f1c2)
 *   замінити цей файл в папці functions/
 *   firebase deploy --only functions
 */

const { onRequest, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions }  = require("firebase-functions/v2");
const admin  = require("firebase-admin");
const fetch  = require("node-fetch"); // npm i node-fetch@2

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "europe-west1" });

// ─── ТВІЙ BOT TOKEN (отримай у @BotFather) ───
const BOT_TOKEN  = "8651643968:AAF417ji8NNlsKzqTxV3Y9bLo8ghaHUoAME";
const BOT_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Курс виведення: скільки монет = 1 Star ───
const COINS_PER_STAR = 100;

/* ════════════════════════════════════════════════════════
   1. TELEGRAM STARS — СТВОРЕННЯ ІНВОЙСУ
   Викликається з фронтенду: createStarsInvoice({ itemId })
   ════════════════════════════════════════════════════════ */
exports.createStarsInvoice = onCall(async (request) => {
    const { itemId } = request.data;
    const userId     = request.auth?.uid;

    if (!userId) throw new Error("Unauthorized");

    // Каталог товарів
    const SHOP_ITEMS = {
        coins_100:  { title: "💰 100 Монет",  description: "Додай 100 монет на баланс",            stars: 15,  coins: 100  },
        coins_500:  { title: "💰 500 Монет",  description: "Додай 500 монет + 50 бонус",            stars: 60,  coins: 550  },
        coins_1000: { title: "💰 1000 Монет", description: "Додай 1000 монет + 200 бонус",          stars: 100, coins: 1200 },
        skin_fire:  { title: "🔥 Скін Вогонь", description: "Розблокуй ракету з вогняним двигуном", stars: 50,  skin: "fire" },
        skin_ice:   { title: "❄️ Скін Крига",  description: "Розблокуй крижану ракету",             stars: 50,  skin: "ice"  },
        skin_gold:  { title: "⭐ Золота ракета", description: "Ексклюзивний золотий скін",           stars: 200, skin: "gold" },
        extra_life: { title: "💎 +1 Життя",    description: "Продовжити гру після смерті",          stars: 5,   type: "life" },
        shield:     { title: "🛡️ Щит x3",      description: "3 щити для захисту від труб",          stars: 10,  type: "shield", amount: 3 },
    };

    const item = SHOP_ITEMS[itemId];
    if (!item) throw new Error("Item not found");

    // Створюємо інвойс через Telegram Bot API
    const resp = await fetch(`${BOT_API}/createInvoiceLink`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title:           item.title,
            description:     item.description,
            payload:         JSON.stringify({ userId, itemId }),
            currency:        "XTR",           // Telegram Stars
            prices:          [{ label: item.title, amount: item.stars }],
            provider_token:  "",              // порожній для Stars
        })
    });

    const data = await resp.json();
    if (!data.ok) throw new Error("Telegram API error: " + data.description);

    return { invoiceLink: data.result };
});

/* ════════════════════════════════════════════════════════
   2. WEBHOOK — ПІДТВЕРДЖЕННЯ ОПЛАТИ STARS
   Telegram надсилає сюди successful_payment після оплати
   URL: https://europe-west1-flappy-8f1c2.cloudfunctions.net/botWebhook
   Встанови командою:
     curl "https://api.telegram.org/botТВІЙ_ТОКЕН/setWebhook?url=ТВІЙ_URL/botWebhook"
   ════════════════════════════════════════════════════════ */
exports.botWebhook = onRequest(async (req, res) => {
    const update = req.body;

    // pre_checkout_query — треба відповісти протягом 10 секунд
    if (update.pre_checkout_query) {
        await fetch(`${BOT_API}/answerPreCheckoutQuery`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true })
        });
        return res.json({ ok: true });
    }

    // successful_payment — нараховуємо товар
    const msg     = update.message;
    const payment = msg?.successful_payment;
    if (!payment) return res.json({ ok: true });

    let payload;
    try { payload = JSON.parse(payment.invoice_payload); }
    catch { return res.json({ ok: true }); }

    const { userId, itemId } = payload;
    if (!userId || !itemId) return res.json({ ok: true });

    // Захист від подвійного нарахування
    const payRef = db.collection("payments").doc(msg.message_id.toString());
    const paySnap = await payRef.get();
    if (paySnap.exists) return res.json({ ok: true });  // вже оброблено

    await payRef.set({ userId, itemId, ts: admin.firestore.FieldValue.serverTimestamp() });

    // Нараховуємо товар
    const SHOP_ITEMS = {
        coins_100:  { coins: 100  },
        coins_500:  { coins: 550  },
        coins_1000: { coins: 1200 },
        skin_fire:  { skin: "fire"   },
        skin_ice:   { skin: "ice"    },
        skin_gold:  { skin: "gold"   },
        extra_life: { type: "life"   },
        shield:     { type: "shield", amount: 3 },
    };

    const item    = SHOP_ITEMS[itemId];
    const userRef = db.collection("users").doc(userId);
    const update2 = {};

    if (item.coins)  update2.balance  = admin.firestore.FieldValue.increment(item.coins);
    if (item.skin)   update2[`skins.${item.skin}`] = true;
    if (item.type === "life")   update2.extraLives  = admin.firestore.FieldValue.increment(1);
    if (item.type === "shield") update2.shields     = admin.firestore.FieldValue.increment(item.amount ?? 1);

    await userRef.update(update2);

    // Надсилаємо повідомлення гравцю
    const names = {
        coins_100: "💰 100 монет", coins_500: "💰 550 монет", coins_1000: "💰 1200 монет",
        skin_fire: "🔥 Скін Вогонь", skin_ice: "❄️ Скін Крига", skin_gold: "⭐ Золота ракета",
        extra_life: "💎 +1 Життя", shield: "🛡️ Щит x3"
    };
    await fetch(`${BOT_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: msg.chat.id,
            text: `✅ Оплата успішна! ${names[itemId] || itemId} додано до твого акаунту. Повертайся до гри! 🚀`
        })
    });

    res.json({ ok: true });
});

/* ════════════════════════════════════════════════════════
   3. РЕФЕРАЛЬНА СИСТЕМА (захищена)
   Викликається один раз при реєстрації нового юзера
   ════════════════════════════════════════════════════════ */
exports.processReferral = onCall(async (request) => {
    const { inviterId } = request.data;
    const newUserId     = request.auth?.uid;

    if (!newUserId || !inviterId) throw new Error("Invalid data");
    if (newUserId === inviterId)  throw new Error("Self-referral");

    const newUserRef = db.collection("users").doc(newUserId);
    const newSnap    = await newUserRef.get();

    // Якщо вже є referredBy — не нараховуємо знову
    if (newSnap.exists && newSnap.data().referredBy) {
        return { ok: false, reason: "already_referred" };
    }

    // Перевіряємо що inviterId існує
    const inviterSnap = await db.collection("users").doc(inviterId).get();
    if (!inviterSnap.exists) return { ok: false, reason: "inviter_not_found" };

    // Нараховуємо бонуси
    const REFERRAL_BONUS_INVITER = 50;
    const REFERRAL_BONUS_NEW     = 10;

    await db.runTransaction(async (t) => {
        t.update(newUserRef, {
            referredBy: inviterId,
            balance: admin.firestore.FieldValue.increment(REFERRAL_BONUS_NEW)
        });
        t.update(db.collection("users").doc(inviterId), {
            balance:      admin.firestore.FieldValue.increment(REFERRAL_BONUS_INVITER),
            referralCount: admin.firestore.FieldValue.increment(1)
        });
    });

    // Сповіщаємо запрошувача через бота
    const inviterData = inviterSnap.data();
    if (inviterData.telegramId) {
        await fetch(`${BOT_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: inviterData.telegramId,
                text: `🎉 Друг приєднався за твоїм посиланням! Ти отримав +${REFERRAL_BONUS_INVITER} монет! 👥`
            })
        }).catch(() => {});
    }

    return { ok: true };
});

/* ════════════════════════════════════════════════════════
   4. ВИВЕДЕННЯ МОНЕТ → STARS
   Гравець подає заявку, ти відправляєш Stars вручну
   ════════════════════════════════════════════════════════ */
exports.requestWithdrawal = onCall(async (request) => {
    const { coinsAmount } = request.data;
    const userId          = request.auth?.uid;

    if (!userId) throw new Error("Unauthorized");
    if (!coinsAmount || coinsAmount < COINS_PER_STAR) {
        throw new Error(`Мінімум ${COINS_PER_STAR} монет (= 1 Star)`);
    }

    const starsAmount = Math.floor(coinsAmount / COINS_PER_STAR);
    const coinsToSpend = starsAmount * COINS_PER_STAR;

    const userRef  = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("User not found");

    const userData = userSnap.data();
    if ((userData.balance ?? 0) < coinsToSpend) {
        throw new Error("Недостатньо монет");
    }

    // Перевіряємо чи немає вже активної заявки
    const pendingSnap = await db.collection("withdrawals")
        .where("userId", "==", userId)
        .where("status", "==", "pending")
        .limit(1).get();

    if (!pendingSnap.empty) throw new Error("У тебе вже є активна заявка");

    // Знімаємо монети і створюємо заявку
    await db.runTransaction(async (t) => {
        t.update(userRef, {
            balance: admin.firestore.FieldValue.increment(-coinsToSpend)
        });
        t.set(db.collection("withdrawals").doc(), {
            userId,
            telegramId: userData.telegramId || userId,
            coinsAmount: coinsToSpend,
            starsAmount,
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    return { ok: true, starsAmount, coinsSpent: coinsToSpend };
});

/* ════════════════════════════════════════════════════════
   5. АДМІН — ВИПЛАТИТИ STARS (викликай вручну)
   approveWithdrawal({ withdrawalId }) з Firebase Console
   або через свій адмін-бот
   ════════════════════════════════════════════════════════ */
exports.approveWithdrawal = onCall(async (request) => {
    // TODO: додай перевірку що caller є адміном
    const { withdrawalId } = request.data;
    const wRef  = db.collection("withdrawals").doc(withdrawalId);
    const wSnap = await wRef.get();

    if (!wSnap.exists) throw new Error("Withdrawal not found");
    const w = wSnap.data();
    if (w.status !== "pending") throw new Error("Already processed");

    // Відправляємо Stars через Bot API
    const resp = await fetch(`${BOT_API}/sendStars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: w.telegramId,
            amount:  w.starsAmount
        })
    });

    const data = await resp.json();
    if (!data.ok) {
        await wRef.update({ status: "failed", error: data.description });
        throw new Error("Telegram error: " + data.description);
    }

    await wRef.update({ status: "completed", completedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true };
});
