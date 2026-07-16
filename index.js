/**
 * Cloud Functions لتطبيق Heye
 * -----------------------------------------------------
 * الفانكشن دي هي المسؤولة عن إرسال الإشعار الفعلي (Push) لما حد يبعت رسالة،
 * سواء التطبيق مفتوح أو مقفول خالص على جهاز المستلم.
 *
 * ليه محتاجين السيرفر ده أصلاً؟
 * متصفح المستقبِل (اللي التطبيق مقفول عنده) مبيشتغلش JavaScript خالص وقتها،
 * فمفيش طريقة إن كود الشات نفسه (اللي في هيye.html) يبعت له إشعار مباشرة.
 * لازم سيرفر (Cloud Function) يراقب قاعدة البيانات، ولما تلاقي رسالة جديدة
 * تتبعت لأي إشعار عن طريق Firebase Cloud Messaging (FCM) لجهاز المستلم.
 */

const { onValueCreated } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// يشتغل تلقائيًا كل ما تتضاف رسالة جديدة تحت أي محادثة
exports.onNewMessage = onValueCreated(
  "/chats/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data.val();
    const { chatId } = event.params;
    if (!message || !message.senderId) return;

    const db = getDatabase();

    // 1) نجيب بيانات المحادثة عشان نعرف مين المستقبِل
    const chatSnap = await db.ref(`chats/${chatId}`).get();
    if (!chatSnap.exists()) return;
    const chat = chatSnap.val();
    const participants = Object.keys(chat.participants || {});
    const recipientUid = participants.find((uid) => uid !== message.senderId);
    if (!recipientUid) return;

    // 2) لو المستقبِل حاظر المرسل، منبعتش إشعار
    const blockedSnap = await db.ref(`blocked/${recipientUid}/${message.senderId}`).get();
    if (blockedSnap.exists() && blockedSnap.val() === true) return;

    // 3) لو المستقبِل كاتم المحادثة دي، منبعتش إشعار
    const mutedSnap = await db.ref(`chatMeta/${recipientUid}/${chatId}/muted`).get();
    if (mutedSnap.exists() && mutedSnap.val() === true) return;

    // 4) نجيب كل التوكنز (الأجهزة) المسجلة للمستقبِل
    const tokensSnap = await db.ref(`fcmTokens/${recipientUid}`).get();
    if (!tokensSnap.exists()) return;
    const tokens = Object.keys(tokensSnap.val());
    if (!tokens.length) return;

    // 5) نجهز نص الإشعار حسب نوع الرسالة
    let body = message.text || "";
    if (message.type === "image") body = "📷 صورة";
    else if (message.type === "video") body = "🎬 فيديو";
    else if (message.type === "voice") body = "🎤 رسالة صوتية";
    else if (message.type === "call") body = message.callStatus === "missed" ? "📞 مكالمة فائتة" : "📞 مكالمة";
    if (message.forwarded) body = "↪️ " + body;
    if (!body) body = "رسالة جديدة";

    const payload = {
      notification: {
        title: message.senderName || "رسالة جديدة",
        body: body.slice(0, 120),
      },
      data: { chatId: String(chatId) },
      tokens,
    };

    try {
      const resp = await getMessaging().sendEachForMulticast(payload);
      // ننضف أي توكنز بايظة/ملغية عشان نوفر ونمنع أخطاء لاحقة
      const invalidTokens = [];
      resp.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error && r.error.code;
          if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
            invalidTokens.push(tokens[i]);
          }
        }
      });
      await Promise.all(
        invalidTokens.map((t) => db.ref(`fcmTokens/${recipientUid}/${t}`).remove())
      );
    } catch (err) {
      console.error("FCM send failed:", err);
    }
  }
);

// نفس الفكرة للمكالمات الواردة — إشعار فوري عند الاتصال
exports.onIncomingCall = onValueCreated(
  "/calls/{calleeUid}",
  async (event) => {
    const call = event.data.val();
    const { calleeUid } = event.params;
    if (!call || call.status !== "ringing") return;

    const db = getDatabase();
    const tokensSnap = await db.ref(`fcmTokens/${calleeUid}`).get();
    if (!tokensSnap.exists()) return;
    const tokens = Object.keys(tokensSnap.val());
    if (!tokens.length) return;

    const payload = {
      notification: {
        title: "📞 مكالمة واردة",
        body: `${call.callerName || "مستخدم"} بيتصل بك الآن`,
      },
      data: { type: "call", callId: String(call.callId || "") },
      tokens,
    };

    try {
      await getMessaging().sendEachForMulticast(payload);
    } catch (err) {
      console.error("FCM call notify failed:", err);
    }
  }
);
