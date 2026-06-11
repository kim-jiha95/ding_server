import { Injectable, Logger } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class PushGatewayService {
  private readonly logger = new Logger(PushGatewayService.name);
  private firebaseApp?: App;

  async sendMany(tokens: Array<{ token: string; platform: string }>, payload: { title: string; body: string; data?: Record<string, string> }) {
    const firebaseApp = this.getFirebaseApp();
    if (firebaseApp) {
      const response = await getMessaging(firebaseApp).sendEachForMulticast({
        tokens: tokens.map((item) => item.token),
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
      this.logger.log(`push sent via fcm success=${response.successCount} failure=${response.failureCount}`);
      return { mode: 'fcm', count: response.successCount, failureCount: response.failureCount };
    }

    const webhookUrl = process.env.PUSH_WEBHOOK_URL;
    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, notification: payload }),
      });

      if (!response.ok) {
        throw new Error(`push webhook failed status=${response.status}`);
      }

      return { mode: 'webhook', count: tokens.length };
    }

    for (const item of tokens) {
      this.logger.log(`push simulated platform=${item.platform} token=${item.token.slice(0, 12)}... title=${payload.title}`);
    }
    return { mode: 'log', count: tokens.length };
  }

  private getFirebaseApp() {
    if (this.firebaseApp) return this.firebaseApp;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return undefined;
    }

    this.firebaseApp = getApps()[0] ?? initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    return this.firebaseApp;
  }
}
