const { onValueCreated } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// بتشتغل تلقائيًا كل ما رسالة جديدة تتضاف تحت أي محادثة
exports.sendMessageNotification = onValueCreated(
  {
    ref: "/chats/{chatId}/messages/{messageId}",
    region: "us-central1", // نفس الريجن اللي الـ Realtime Database بتاعتك عليه غالبًا. غيّرها لو محتاج
  },
  async (event) => {
    const message = event.data.val();
    const { chatId } = event.params;

    if (!message || !message.senderId || !message.text) return;

    const db = getDatabase();

    // هات بيانات المحادثة عشان نعرف مين المستقبل
    const chatSnap = await db.ref(`chats/${chatId}`).get();
    if (!chatSnap.exists()) return;
    const chat = chatSnap.val();

    const participants = Object.keys(chat.participants || {});
    const recipientUid = participants.find((uid) => uid !== message.senderId);
    if (!recipientUid) return;

    // هات توكنات الجهاز بتاعة المستقبل
    const userSnap = await db.ref(`users/${recipientUid}`).get();
    if (!userSnap.exists()) return;
    const userData = userSnap.val();
    const tokens = userData.fcmTokens ? Object.keys(userData.fcmTokens) : [];
    if (!tokens.length) return; // المستقبل معندوش توكن مسجل (يعني مفعلش الإشعارات)

    const senderName = message.senderName || "شخص ما";
    const bodyText = message.text.length > 100 ? message.text.slice(0, 100) + "…" : message.text;

    const payload = {
      notification: {
        title: senderName,
        body: bodyText,
      },
      data: {
        chatId: chatId,
        senderId: message.senderId,
      },
      tokens: tokens,
    };

    try {
      const response = await getMessaging().sendEachForMulticast(payload);

      // نظف التوكنات اللي بقت غير صالحة (المستخدم مسح التطبيق مثلاً)
      const invalidTokens = [];
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code || "";
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length) {
        const updates = {};
        invalidTokens.forEach((t) => {
          updates[`users/${recipientUid}/fcmTokens/${t}`] = null;
        });
        await db.ref().update(updates);
      }
    } catch (err) {
      console.error("FCM send error:", err);
    }
  }
);
