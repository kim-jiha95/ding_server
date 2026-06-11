import { RunsController } from './runs.controller';
import { RunRecord } from '../data/types';

describe('RunsController', () => {
  const dataService = {
    finishRun: jest.fn(),
  };

  let controller: RunsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RunsController(dataService as never);
  });

  it('finish forwards userId and run to dataService', async () => {
    const run: RunRecord = {
      id: 'run-1',
      distanceKM: 5,
      duration: '27:10',
      averagePace: "5'26/km",
      calories: 320,
      dateLabel: 'Today',
      route: [],
      splits: [],
    };
    dataService.finishRun.mockResolvedValue(run);

    const result = await controller.finish({ userId: 'user-1' }, run);

    expect(dataService.finishRun).toHaveBeenCalledWith('user-1', run);
    expect(result).toEqual(run);
  });
});
