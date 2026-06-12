import { Injectable, Logger } from '@nestjs/common';
import { createSign } from 'crypto';
import { connect } from 'http2';
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
    const privateKey = this.normalizePrivateKey(process.env.APNS_PRIVATE_KEY);

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
      try {
        const response = await this.sendApnsRequest(host, item.token, jwt, bundleId, payload);
        if (response.status >= 200 && response.status < 300) {
          count += 1;
          continue;
        }

        this.logger.warn(`apns send failed status=${response.status} token=${item.token.slice(0, 12)}... body=${response.body}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`apns transport failed host=${host} token=${item.token.slice(0, 12)}... reason=${message}`);
      }
    }

    this.logger.log(`push sent via apns success=${count} total=${iosTokens.length}`);
    return { mode: 'apns', count, failureCount: iosTokens.length - count };
  }

  private async sendApnsRequest(
    host: string,
    token: string,
    jwt: string,
    bundleId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<{ status: number; body: string }> {
    const client = connect(host);

    return await new Promise((resolve, reject) => {
      client.on('error', reject);

      const request = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
      });

      let status = 0;
      let body = '';

      request.on('response', (headers) => {
        status = Number(headers[':status'] ?? 0);
      });
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        client.close();
        resolve({ status, body });
      });
      request.on('error', (error) => {
        client.close();
        reject(error);
      });

      request.end(
        JSON.stringify({
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: 'default',
          },
          ...(payload.data ?? {}),
        }),
      );
    });
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
    const privateKey = this.normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (!projectId || !clientEmail || !privateKey) {
      return undefined;
    }

    this.firebaseApp = getApps()[0] ?? initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    return this.firebaseApp;
  }

  private normalizePrivateKey(value?: string) {
    if (!value) return undefined;

    let normalized = value.trim();

    if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
      normalized = normalized.slice(1, -1);
    }

    normalized = normalized.replace(/\\n/g, '\n');
    normalized = normalized.replace('BEGIN PRIVATEKEY', 'BEGIN PRIVATE KEY');
    normalized = normalized.replace('END PRIVATEKEY', 'END PRIVATE KEY');

    return normalized;
  }
}
