import { ChatController } from './chat.controller';

describe('ChatController', () => {
  const dataService = {
    appendThreadMessage: jest.fn(),
    threadPage: jest.fn(),
    markThreadRead: jest.fn(),
  };

  let controller: ChatController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ChatController(dataService as never);
  });

  it('appendMessage forwards payload to dataService', async () => {
    const message = { senderID: 'user-1', body: 'hello', timestamp: '10:20 AM' };
    const thread = { id: 'thread-1', messages: [{ id: 'msg-1', ...message }] };
    dataService.appendThreadMessage.mockResolvedValue(thread);

    const result = await controller.appendMessage({ userId: 'user-1' }, 'thread-1', message);

    expect(dataService.appendThreadMessage).toHaveBeenCalledWith('user-1', 'thread-1', message);
    expect(result).toEqual(thread);
  });

  it('threadPage forwards pagination to dataService', async () => {
    const pageResult = { items: [], page: 2, pageSize: 10, total: 0, hasMore: false };
    dataService.threadPage.mockResolvedValue(pageResult);

    const result = await controller.threadPage({ userId: 'user-1' }, { page: 2, pageSize: 10 });

    expect(dataService.threadPage).toHaveBeenCalledWith('user-1', 2, 10);
    expect(result).toEqual(pageResult);
  });

  it('markRead forwards thread id to dataService', async () => {
    const thread = { id: 'thread-1', unreadCount: 0, messages: [] };
    dataService.markThreadRead.mockResolvedValue(thread);

    const result = await controller.markRead({ userId: 'user-1' }, 'thread-1');

    expect(dataService.markThreadRead).toHaveBeenCalledWith('user-1', 'thread-1');
    expect(result).toEqual(thread);
  });
});
