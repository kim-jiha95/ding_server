import { AuthService } from './auth.service';

describe('AuthService', () => {
  const session = {
    userID: 'user-1',
    username: 'alex',
    accessToken: 'raw-token',
    hasCompletedOnboarding: false,
    preference: 'Women' as const,
  };

  const profile = {
    id: 'profile-1',
    name: 'alex',
    level: 1,
    bio: 'New to DING',
    totalDistance: 0,
    longestRun: 0,
    averagePace: "--'--/km",
    currentStreak: 0,
  };

  const dataService = {
    signup: jest.fn(),
    login: jest.fn(),
    profile: jest.fn(),
    bootstrap: jest.fn(),
    updatePreference: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-jwt'),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(dataService as never, jwtService as never);
  });

  it('signup returns signed session with profile', async () => {
    dataService.signup.mockResolvedValue(session);
    dataService.profile.mockResolvedValue(profile);

    const result = await service.signup({
      email: 'alex@ding.run',
      password: '1234',
      username: 'alex',
    });

    expect(dataService.signup).toHaveBeenCalledWith('alex@ding.run', '1234', 'alex');
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-1' });
    expect(dataService.profile).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      session: { ...session, accessToken: 'signed-jwt' },
      profile,
    });
  });

  it('login returns signed session with profile', async () => {
    dataService.login.mockResolvedValue(session);
    dataService.profile.mockResolvedValue(profile);

    const result = await service.login({
      email: 'alex@ding.run',
      password: '1234',
    });

    expect(dataService.login).toHaveBeenCalledWith('alex@ding.run', '1234');
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-1' });
    expect(result).toEqual({
      session: { ...session, accessToken: 'signed-jwt' },
      profile,
    });
  });
});
