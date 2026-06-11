import { PushGatewayService } from './push-gateway.service';

describe('PushGatewayService', () => {
  const originalWebhook = process.env.PUSH_WEBHOOK_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.PUSH_WEBHOOK_URL = originalWebhook;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns log mode when webhook is not configured', async () => {
    process.env.PUSH_WEBHOOK_URL = '';
    const service = new PushGatewayService();

    const result = await service.sendMany([{ token: 'device-token-1', platform: 'ios' }], {
      title: 'hello',
      body: 'world',
    });

    expect(result).toEqual({ mode: 'log', count: 1 });
  });

  it('posts to webhook when configured', async () => {
    process.env.PUSH_WEBHOOK_URL = 'http://localhost:4010/push';
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
    const service = new PushGatewayService();

    const result = await service.sendMany([{ token: 'device-token-1', platform: 'ios' }], {
      title: 'hello',
      body: 'world',
      data: { type: 'chat' },
    });

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:4010/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens: [{ token: 'device-token-1', platform: 'ios' }],
        notification: { title: 'hello', body: 'world', data: { type: 'chat' } },
      }),
    });
    expect(result).toEqual({ mode: 'webhook', count: 1 });
  });
});
