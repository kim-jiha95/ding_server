import { DingController } from './ding.controller';

describe('DingController', () => {
  const dataService = {
    sendDing: jest.fn(),
  };

  let controller: DingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DingController(dataService as never);
  });

  it('send forwards encounter ids to dataService', async () => {
    const match = {
      id: 'enc-1',
      runner: { id: 'runner-1', displayName: 'Runner #1', age: 29, badge: '10K', intro: 'hi' },
      matchedAt: 'Today · 10:25 PM',
      conversationUnlocked: true,
    };
    dataService.sendDing.mockResolvedValue(match);

    const result = await controller.send(
      { userId: 'user-1' },
      { encounterIDs: ['enc-1', 'enc-2'] },
    );

    expect(dataService.sendDing).toHaveBeenCalledWith('user-1', ['enc-1', 'enc-2']);
    expect(result).toEqual(match);
  });
});
