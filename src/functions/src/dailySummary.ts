import { schedule } from 'firebase-functions/v2';
import { admin } from 'firebase-admin';
import { sendPush } from './notifications';

export const dailySummary = schedule('0 8 * * *', {
  timeZone: 'UTC',
  onRun: async () => {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const ordersSnap = await admin.firestore().collection('orders')
      .where('createdAt', '>=', startOfDay)
      .where('createdAt', '<', endOfDay)
      .get();
    const summary = ordersSnap.docs
      .map(doc => `Order ${doc.id}: ${doc.data().status}`)
      .join('\n');
    const usersSnap = await admin.firestore().collection('users').get();
    const pushPromises = usersSnap.docs.map(userDoc => {
      const token = userDoc.data().deviceToken;
      if (token) {
        return sendPush(token, 'Daily Summary', summary);
      }
      return Promise.resolve();
    });
    await Promise.all(pushPromises);
  }
});
