import { admin } from 'firebase-admin';

export const sendPush = async (token: string, title: string, body: string): Promise<void> => {
  try {
    const message = {
      notification: {
        title: title,
        body: body
      },
      token: token
    };
    
    await admin.messaging().send(message);
    console.log(`Push notification sent to token: ${token}`);
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};