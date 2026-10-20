import { schedule } from 'firebase-functions/v2';
import { admin } from 'firebase-admin';
import { sendPush } from './notifications';

export const dailySummary = schedule('every 24 hours', {
  timeZone: 'UTC',
  onRun: async () => {
    try {
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
      const usersWithTokens = usersSnap.docs.filter(userDoc => {
        return userDoc.data().deviceToken;
      });
      
      const pushPromises = usersWithTokens.map(userDoc => {
        const token = userDoc.data().deviceToken;
        return sendPush(token, 'Daily Summary', summary);
      });
      
      await Promise.all(pushPromises);
    } catch (error) {
      console.error('Error in dailySummary function:', error);
      throw error;
    }
  }
});
