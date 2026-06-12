import { Injectable, Logger } from '@nestjs/common';
import { createSign } from 'crypto';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class PushGatewayService {
  private readonly logger = new Logger(PushGatewayService.name);
  private firebaseApp?: App;

  async sendMany(tokens: Array<{ token: string; platform: string; environment?: string }>, payload: { title: string; body: string; data?: Record<string, string> }) {
    const apnsResult = await this.sendViaApns(tokens, payload);
    if (apnsResult) {
      return apnsResult;
    }

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

  private async sendViaApns(tokens: Array<{ token: string; platform: string; environment?: string }>, payload: { title: string; body: string; data?: Record<string, string> }) {
    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    const bundleId = process.env.APNS_BUNDLE_ID;
    const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!keyId || !teamId || !bundleId || !privateKey) {
      return undefined;
    }

    const iosTokens = tokens.filter((item) => item.platform === 'ios');
    if (!iosTokens.length) {
      return undefined;
    }

    const jwt = this.createApnsJwt(teamId, keyId, privateKey);
    let count = 0;

    for (const item of iosTokens) {
      const host = item.environment === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
      const response = await fetch(`${host}/3/device/${item.token}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: 'default',
          },
          ...(payload.data ?? {}),
        }),
      });

      if (response.ok) {
        count += 1;
        continue;
      }

      const errorText = await response.text();
      this.logger.warn(`apns send failed status=${response.status} token=${item.token.slice(0, 12)}... body=${errorText}`);
    }

    this.logger.log(`push sent via apns success=${count} total=${iosTokens.length}`);
    return { mode: 'apns', count, failureCount: iosTokens.length - count };
  }

  private createApnsJwt(teamId: string, keyId: string, privateKey: string) {
    const header = this.base64Url(JSON.stringify({ alg: 'ES256', kid: keyId }));
    const claims = this.base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
    const unsignedToken = `${header}.${claims}`;
    const signer = createSign('SHA256');
    signer.update(unsignedToken);
    signer.end();
    const signature = signer.sign(privateKey);
    return `${unsignedToken}.${this.base64Url(signature)}`;
  }

  private base64Url(value: string | Buffer) {
    const buffer = typeof value === 'string' ? Buffer.from(value) : value;
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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
