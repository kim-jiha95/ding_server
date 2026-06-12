import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncounterGenerationService } from './encounter-generation.service';
import { EncounterQueueService } from '../queue/encounter-queue.service';
import { NotificationQueueService } from '../queue/notification-queue.service';
import {
  AuthSession,
  ChatMessage,
  ChatThread,
  DingSummary,
  Encounter,
  MatchResult,
  RunRecord,
  RunnerProfile,
  UserEntity,
  UserProfile,
} from './types';

const id = () => randomUUID();

@Injectable()
export class DataService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly encounterGenerationService: EncounterGenerationService,
    private readonly encounterQueueService: EncounterQueueService,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  async onModuleInit() {
    const count = await this.prisma.user.count();
    if (count > 0) return;

    const seeded = await this.buildUser('alex@ding.run', '1234', 'Alex');
    seeded.hasCompletedOnboarding = true;
    seeded.profile.level = 12;
    seeded.profile.bio = 'Night runner · Han River · Sub-25 5K';
    seeded.profile.totalDistance = 512;
    seeded.profile.longestRun = 21.1;
    seeded.profile.averagePace = "5'24/km";
    seeded.profile.currentStreak = 14;
    seeded.runs = [
      { id: id(), distanceKM: 6.3, duration: '34:25', averagePace: "5'27/km", calories: 410, dateLabel: 'Today', route: [], splits: [] },
      { id: id(), distanceKM: 5.8, duration: '30:48', averagePace: "5'21/km", calories: 392, dateLabel: '2 days ago', route: [], splits: [] },
      { id: id(), distanceKM: 10.2, duration: '55:10', averagePace: "5'24/km", calories: 672, dateLabel: '4 days ago', route: [], splits: [] },
    ];
    await this.createUser(seeded);
    for (const run of seeded.runs) {
      await this.persistRun(seeded.id, run);
    }
  }

  async signup(email: string, password: string, username: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('EMAIL_EXISTS');
    const user = await this.buildUser(email, password, username);
    await this.createUser(user);
    return this.toSession(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new NotFoundException('Invalid credentials');
    }
    return this.toSession(await this.findByUserId(user.id));
  }

  async findByUserId(userId: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        runs: {
          include: {
            routePoints: { orderBy: { pointOrder: 'asc' } },
            splits: { orderBy: { kilometer: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
        encounters: { orderBy: { createdAt: 'desc' } },
        matches: { orderBy: { createdAt: 'desc' } },
        threads: {
          include: { messages: { orderBy: { createdAt: 'asc' } } },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!user || !user.profile) throw new NotFoundException('User not found');

    const encounters = user.encounters.map<Encounter>((item) => ({
      id: item.id,
      runner: { id: item.runnerId, displayName: item.runnerDisplayName, age: item.age, badge: item.badge, intro: item.intro },
      place: item.place,
      averagePace: item.averagePace,
      encounterMinutes: item.encounterMinutes,
      distanceApartKM: item.distanceApartKM,
      likedYou: item.likedYou,
      latitude: item.latitude,
      longitude: item.longitude,
    }));

    const matches = user.matches.map<MatchResult>((item) => ({
      id: item.id,
      runner: { id: item.runnerId, displayName: item.runnerDisplayName, age: item.age, badge: item.badge, intro: item.intro },
      matchedAt: item.matchedAt,
      conversationUnlocked: item.conversationUnlocked,
    }));

    return {
      id: user.id,
      email: user.email,
      password: user.passwordHash,
      username: user.username,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      preference: user.preference as AuthSession['preference'],
      profile: {
        id: user.id,
        name: user.profile.name,
        level: user.profile.level,
        bio: user.profile.bio,
        totalDistance: user.profile.totalDistance,
        longestRun: user.profile.longestRun,
        averagePace: user.profile.averagePace,
        currentStreak: user.profile.currentStreak,
      },
      runs: user.runs.map((run) => this.mapRun(run)),
      dingSummary: this.buildDingSummary(encounters, matches, 0),
      threads: user.threads.map((thread) => this.mapThread(thread)),
    };
  }

  async bootstrap(userId: string) {
    const user = await this.findByUserId(userId);
    return { session: this.toSession(user), profile: user.profile };
  }

  async updatePreference(userId: string, preference: AuthSession['preference']) {
    await this.prisma.user.update({ where: { id: userId }, data: { preference, hasCompletedOnboarding: true } });
    return this.toSession(await this.findByUserId(userId));
  }

  async updateProfile(userId: string, name: string, bio: string) {
    const user = await this.findByUserId(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { username: name } });
    await this.prisma.profile.update({ where: { userId }, data: { name, bio } });
    await this.cacheService.del(this.profileKey(userId));
    return { ...user.profile, name, bio };
  }

  async registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web', environment: 'sandbox' | 'production') {
    await this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform, environment, isActive: true },
      create: { userId, token, platform, environment, isActive: true },
    });
    return { ok: true, token, platform, environment };
  }

  async dashboard(userId: string): Promise<{ weeklyDistance: number; monthlyDistance: number; recentRuns: RunRecord[] }> {
    const key = this.dashboardKey(userId);
    const cached = await this.cacheService.get<{ weeklyDistance: number; monthlyDistance: number; recentRuns: RunRecord[] }>(key);
    if (cached) return cached;

    const recentRuns = await this.prisma.run.findMany({
      where: { userId },
      include: { routePoints: { orderBy: { pointOrder: 'asc' } }, splits: { orderBy: { kilometer: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    const result = { weeklyDistance: 24.6, monthlyDistance: 82.1, recentRuns: recentRuns.map((run) => this.mapRun(run)) };
    await this.cacheService.set(key, result, 30);
    return result;
  }

  async activity(userId: string) {
    const runs = await this.prisma.run.findMany({
      where: { userId },
      include: { routePoints: { orderBy: { pointOrder: 'asc' } }, splits: { orderBy: { kilometer: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return runs.map((run) => this.mapRun(run));
  }

  async activityPage(userId: string, page: number, pageSize: number): Promise<{ items: RunRecord[]; page: number; pageSize: number; total: number; hasMore: boolean }> {
    const key = this.activityPageKey(userId, page, pageSize);
    const cached = await this.cacheService.get<{ items: RunRecord[]; page: number; pageSize: number; total: number; hasMore: boolean }>(key);
    if (cached) return cached;

    const skip = (page - 1) * pageSize;
    const [total, runs] = await Promise.all([
      this.prisma.run.count({ where: { userId } }),
      this.prisma.run.findMany({
        where: { userId },
        include: { routePoints: { orderBy: { pointOrder: 'asc' } }, splits: { orderBy: { kilometer: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const result = {
      items: runs.map((run) => this.mapRun(run)),
      page,
      pageSize,
      total,
      hasMore: skip + runs.length < total,
    };
    await this.cacheService.set(key, result, 30);
    return result;
  }

  async finishRun(userId: string, run: RunRecord) {
    const existing = await this.prisma.run.findUnique({ where: { id: run.id } });
    await this.persistRun(userId, run);

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');

    const distanceDelta = run.distanceKM - (existing?.distanceKM ?? 0);
    await this.prisma.profile.update({
      where: { userId },
      data: {
        totalDistance: Math.max(0, profile.totalDistance + distanceDelta),
        longestRun: Math.max(profile.longestRun, run.distanceKM),
        averagePace: run.averagePace,
      },
    });

    await this.invalidateRunCaches(userId);

    await this.generateEncounters(userId, run);
    return run;
  }

  async dingSummary(userId: string): Promise<DingSummary> {
    const key = this.dingSummaryKey(userId);
    const cached = await this.cacheService.get<DingSummary>(key);
    if (cached) return cached;

    const [encountersRaw, matchesRaw, sentCount] = await Promise.all([
      this.prisma.encounter.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.match.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.dingRequest.count({ where: { fromUserId: userId } }),
    ]);
    const encounters = encountersRaw.map<Encounter>((item) => ({
      id: item.id,
      runner: { id: item.runnerId, displayName: item.runnerDisplayName, age: item.age, badge: item.badge, intro: item.intro },
      place: item.place,
      averagePace: item.averagePace,
      encounterMinutes: item.encounterMinutes,
      distanceApartKM: item.distanceApartKM,
      likedYou: item.likedYou,
      latitude: item.latitude,
      longitude: item.longitude,
    }));
    const matches = matchesRaw.map<MatchResult>((item) => ({
      id: item.id,
      runner: { id: item.runnerId, displayName: item.runnerDisplayName, age: item.age, badge: item.badge, intro: item.intro },
      matchedAt: item.matchedAt,
      conversationUnlocked: item.conversationUnlocked,
    }));
    const result = this.buildDingSummary(encounters, matches, sentCount);
    await this.cacheService.set(key, result, 20);
    return result;
  }

  async sendDing(userId: string, encounterIDs: string[]): Promise<MatchResult | null> {
    if (!encounterIDs.length) return null;

    const encounters = await this.prisma.encounter.findMany({
      where: { userId, id: { in: encounterIDs } },
      orderBy: { createdAt: 'desc' },
    });
    if (!encounters.length) return null;

    let matched: MatchResult | null = null;

    for (const encounter of encounters) {
      const existingRequest = await this.prisma.dingRequest.findUnique({
        where: { fromUserId_toUserId: { fromUserId: userId, toUserId: encounter.runnerId } },
      });
      if (!existingRequest) {
        await this.prisma.dingRequest.create({
          data: {
            encounterId: encounter.id,
            fromUserId: userId,
            toUserId: encounter.runnerId,
            status: 'pending',
          },
        });
      }

      await this.prisma.encounter.updateMany({
        where: { userId: encounter.runnerId, runnerId: userId },
        data: { likedYou: true },
      });

      const reciprocal = await this.prisma.dingRequest.findUnique({
        where: { fromUserId_toUserId: { fromUserId: encounter.runnerId, toUserId: userId } },
      });

      if (reciprocal) {
        matched = await this.createMatchPair(userId, encounter);
      } else {
        await this.notificationQueueService.enqueuePush({
          userId: encounter.runnerId,
          title: '새 DING 도착',
          body: '함께 달린 러너가 회원님에게 호감을 보냈어요.',
          data: { type: 'ding_received', runnerId: userId, encounterId: encounter.id },
        });
      }
    }

    const relatedUserIDs = Array.from(new Set(encounters.flatMap((encounter) => [userId, encounter.runnerId])));
    await Promise.all(relatedUserIDs.map((id) => this.invalidateDingCaches(id)));
    if (matched) {
      await this.invalidateChatCaches(userId);
    }

    return matched;
  }

  async threads(userId: string) {
    const threads = await this.prisma.chatThread.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return threads.map((thread) => this.mapThread(thread));
  }

  async threadPage(userId: string, page: number, pageSize: number): Promise<{ items: ChatThread[]; page: number; pageSize: number; total: number; hasMore: boolean }> {
    const key = this.threadPageKey(userId, page, pageSize);
    const cached = await this.cacheService.get<{ items: ChatThread[]; page: number; pageSize: number; total: number; hasMore: boolean }>(key);
    if (cached) return cached;

    const skip = (page - 1) * pageSize;
    const [total, threads] = await Promise.all([
      this.prisma.chatThread.count({ where: { userId } }),
      this.prisma.chatThread.findMany({
        where: { userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const result = {
      items: threads.map((thread) => this.mapThread(thread)),
      page,
      pageSize,
      total,
      hasMore: skip + threads.length < total,
    };
    await this.cacheService.set(key, result, 20);
    return result;
  }

  async saveThread(userId: string, threadID: string, messages: ChatMessage[], preview: string) {
    const thread = await this.prisma.chatThread.findFirst({ where: { id: threadID, userId } });
    if (!thread) throw new NotFoundException('Thread not found');

    await this.prisma.$transaction([
      this.prisma.chatMessage.deleteMany({ where: { threadId: threadID } }),
      this.prisma.chatThread.update({ where: { id: threadID }, data: { preview } }),
      ...(messages.length
        ? [
            this.prisma.chatMessage.createMany({
              data: messages.map((message) => ({
                id: message.id,
                threadId: threadID,
                senderID: message.senderID,
                body: message.body,
                timestamp: message.timestamp,
              })),
            }),
          ]
        : []),
    ]);

    const updated = await this.prisma.chatThread.findUnique({
      where: { id: threadID },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!updated) throw new NotFoundException('Thread not found');
    await this.invalidateChatCaches(userId, threadID);
    return this.mapThread(updated);
  }

  async appendThreadMessage(userId: string, threadID: string, message: { senderID: string; body: string; timestamp?: string; id?: string }) {
    const thread = await this.prisma.chatThread.findFirst({ where: { id: threadID, userId } });
    if (!thread) throw new NotFoundException('Thread not found');

    const isIncoming = message.senderID !== userId;

    await this.prisma.chatMessage.create({
      data: {
        id: message.id ?? id(),
        threadId: threadID,
        senderID: message.senderID,
        body: message.body,
        timestamp: message.timestamp ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    });
    await this.prisma.chatThread.update({
      where: { id: threadID },
      data: {
        preview: message.body,
        updatedAt: new Date(),
        unreadCount: isIncoming ? { increment: 1 } : 0,
      },
    });
    await this.notificationQueueService.enqueuePush({
      userId,
      title: `New message from ${thread.participantDisplayName}`,
      body: message.body,
      data: { type: 'chat', threadId: threadID, participantId: thread.participantId },
    });

    const updated = await this.prisma.chatThread.findUnique({ where: { id: threadID }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!updated) throw new NotFoundException('Thread not found');
    await this.invalidateChatCaches(userId, threadID);
    return this.mapThread(updated);
  }

  async threadMessagesPage(userId: string, threadID: string, page: number, pageSize: number): Promise<{ items: ChatMessage[]; page: number; pageSize: number; total: number; hasMore: boolean }> {
    const key = this.threadMessagesPageKey(userId, threadID, page, pageSize);
    const cached = await this.cacheService.get<{ items: ChatMessage[]; page: number; pageSize: number; total: number; hasMore: boolean }>(key);
    if (cached) return cached;

    const thread = await this.prisma.chatThread.findFirst({ where: { id: threadID, userId } });
    if (!thread) throw new NotFoundException('Thread not found');

    const skip = (page - 1) * pageSize;
    const [total, messages] = await Promise.all([
      this.prisma.chatMessage.count({ where: { threadId: threadID } }),
      this.prisma.chatMessage.findMany({ where: { threadId: threadID }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]);

    const result = {
      items: messages
        .reverse()
        .map((message) => ({ id: message.id, senderID: message.senderID, body: message.body, timestamp: message.timestamp })),
      page,
      pageSize,
      total,
      hasMore: skip + messages.length < total,
    };
    await this.cacheService.set(key, result, 20);
    return result;
  }

  async markThreadRead(userId: string, threadID: string) {
    const thread = await this.prisma.chatThread.findFirst({ where: { id: threadID, userId } });
    if (!thread) throw new NotFoundException('Thread not found');

    await this.prisma.chatThread.update({ where: { id: threadID }, data: { unreadCount: 0 } });
    const updated = await this.prisma.chatThread.findUnique({ where: { id: threadID }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!updated) throw new NotFoundException('Thread not found');
    await this.invalidateChatCaches(userId, threadID);
    return this.mapThread(updated);
  }

  async profile(userId: string) {
    const key = this.profileKey(userId);
    const cached = await this.cacheService.get<UserProfile>(key);
    if (cached) return cached;

    const result = (await this.findByUserId(userId)).profile;
    await this.cacheService.set(key, result, 60);
    return result;
  }

  private toSession(user: UserEntity): AuthSession {
    return {
      userID: user.id,
      username: user.username,
      accessToken: user.id,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      preference: user.preference,
    };
  }

  private async buildUser(email: string, password: string, username: string): Promise<UserEntity> {
    const passwordHash = await bcrypt.hash(password, 10);
    return {
      id: id(),
      email,
      password: passwordHash,
      username,
      hasCompletedOnboarding: false,
      preference: 'Women',
      profile: {
        id: id(),
        name: username,
        level: 1,
        bio: 'New to DING',
        totalDistance: 0,
        longestRun: 0,
        averagePace: "--'--/km",
        currentStreak: 0,
      },
      runs: [],
      dingSummary: { encounters: 0, sentCount: 0, matchCount: 0, topLocations: 0, received: [], candidates: [], matches: [] },
      threads: [],
    };
  }

  private async createUser(user: UserEntity) {
    await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        passwordHash: user.password,
        username: user.username,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        preference: user.preference,
        profile: {
          create: {
            id: user.profile.id,
            name: user.profile.name,
            level: user.profile.level,
            bio: user.profile.bio,
            totalDistance: user.profile.totalDistance,
            longestRun: user.profile.longestRun,
            averagePace: user.profile.averagePace,
            currentStreak: user.profile.currentStreak,
          },
        },
      },
    });
  }

  private async ensureThreadForMatch(userId: string, participantId: string, participantDisplayName: string) {
    const existing = await this.prisma.chatThread.findUnique({
      where: { userId_participantId: { userId, participantId } },
    });
    if (existing) return existing;

    return this.prisma.chatThread.create({
      data: {
        id: id(),
        userId,
        participantId,
        participantDisplayName,
        participantOnline: true,
        preview: 'Hey! Great run today 👋',
        unreadCount: 1,
        messages: {
          create: [{ id: id(), senderID: participantId, body: 'Hey! Great run today 👋', timestamp: '10:21 AM' }],
        },
      },
    });
  }

  private async generateEncounters(userId: string, run: RunRecord) {
    const affectedUserIds = await this.encounterGenerationService.generateForRun(userId, run);
    await Promise.all(Array.from(new Set(affectedUserIds)).map((id) => this.invalidateDingCaches(id)));
  }

  private async persistRun(userId: string, run: RunRecord) {
    await this.prisma.run.upsert({
      where: { id: run.id },
      update: {
        distanceKM: run.distanceKM,
        duration: run.duration,
        averagePace: run.averagePace,
        calories: run.calories,
        dateLabel: run.dateLabel,
        routePoints: {
          deleteMany: {},
          create: run.route.map((point, index) => ({ id: point.id, latitude: point.latitude, longitude: point.longitude, timestamp: point.timestamp, pointOrder: index })),
        },
        splits: {
          deleteMany: {},
          create: run.splits.map((split) => ({ id: split.id, kilometer: split.kilometer, splitTime: split.splitTime, paceText: split.paceText })),
        },
      },
      create: {
        id: run.id,
        userId,
        distanceKM: run.distanceKM,
        duration: run.duration,
        averagePace: run.averagePace,
        calories: run.calories,
        dateLabel: run.dateLabel,
        routePoints: { create: run.route.map((point, index) => ({ id: point.id, latitude: point.latitude, longitude: point.longitude, timestamp: point.timestamp, pointOrder: index })) },
        splits: { create: run.splits.map((split) => ({ id: split.id, kilometer: split.kilometer, splitTime: split.splitTime, paceText: split.paceText })) },
      },
    });
  }

  private async createMatchPair(userId: string, encounter: {
    id: string;
    runnerId: string;
    runnerDisplayName: string;
    age: number;
    badge: string;
    intro: string;
  }): Promise<MatchResult> {
    const matchedAt = new Date().toISOString();

    await this.prisma.dingRequest.updateMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: encounter.runnerId },
          { fromUserId: encounter.runnerId, toUserId: userId },
        ],
      },
      data: { status: 'matched' },
    });

    await this.prisma.match.upsert({
      where: { userId_runnerId: { userId, runnerId: encounter.runnerId } },
      update: { matchedAt, conversationUnlocked: true },
      create: {
        id: encounter.id,
        userId,
        runnerId: encounter.runnerId,
        runnerDisplayName: encounter.runnerDisplayName,
        age: encounter.age,
        badge: encounter.badge,
        intro: encounter.intro,
        matchedAt,
        conversationUnlocked: true,
      },
    });

    const currentUser = await this.findByUserId(userId);

    await this.prisma.match.upsert({
      where: { userId_runnerId: { userId: encounter.runnerId, runnerId: userId } },
      update: { matchedAt, conversationUnlocked: true },
      create: {
        id: id(),
        userId: encounter.runnerId,
        runnerId: userId,
        runnerDisplayName: currentUser.username,
        age: 0,
        badge: '',
        intro: currentUser.profile.bio,
        matchedAt,
        conversationUnlocked: true,
      },
    });

    await this.ensureThreadForMatch(userId, encounter.runnerId, encounter.runnerDisplayName);
    await this.ensureThreadForMatch(encounter.runnerId, userId, currentUser.username);
    await this.invalidateChatCaches(userId);
    await this.invalidateChatCaches(encounter.runnerId);

    await Promise.all([
      this.notificationQueueService.enqueuePush({
        userId,
        title: '매칭 성사!',
        body: `${encounter.runnerDisplayName}님과 서로 DING을 보냈어요.`,
        data: { type: 'match_success', runnerId: encounter.runnerId },
      }),
      this.notificationQueueService.enqueuePush({
        userId: encounter.runnerId,
        title: '매칭 성사!',
        body: `${currentUser.username}님과 서로 DING을 보냈어요.`,
        data: { type: 'match_success', runnerId: userId },
      }),
    ]);

    return {
      id: encounter.id,
      runner: {
        id: encounter.runnerId,
        displayName: encounter.runnerDisplayName,
        age: encounter.age,
        badge: encounter.badge,
        intro: encounter.intro,
      },
      matchedAt,
      conversationUnlocked: true,
    };
  }

  private buildDingSummary(encounters: Encounter[], matches: MatchResult[], sentCount: number): DingSummary {
    return {
      encounters: encounters.length,
      sentCount,
      matchCount: matches.length,
      topLocations: new Set(encounters.map((item) => item.place)).size,
      received: encounters.filter((item) => item.likedYou),
      candidates: encounters,
      matches,
    };
  }

  private mapRun(run: {
    id: string;
    distanceKM: number;
    duration: string;
    averagePace: string;
    calories: number;
    dateLabel: string;
    routePoints: Array<{ id: string; latitude: number; longitude: number; timestamp: Date }>;
    splits: Array<{ id: string; kilometer: number; splitTime: string; paceText: string }>;
  }): RunRecord {
    return {
      id: run.id,
      distanceKM: run.distanceKM,
      duration: run.duration,
      averagePace: run.averagePace,
      calories: run.calories,
      dateLabel: run.dateLabel,
      route: run.routePoints.map((point) => ({ id: point.id, latitude: point.latitude, longitude: point.longitude, timestamp: point.timestamp })),
      splits: run.splits.map((split) => ({ id: split.id, kilometer: split.kilometer, splitTime: split.splitTime, paceText: split.paceText })),
    };
  }

  private mapThread(thread: {
    id: string;
    participantId: string;
    participantDisplayName: string;
    participantOnline: boolean;
    preview: string;
    unreadCount: number;
    messages: Array<{ id: string; senderID: string; body: string; timestamp: string }>;
  }): ChatThread {
    return {
      id: thread.id,
      participant: { id: thread.participantId, displayName: thread.participantDisplayName, isOnline: thread.participantOnline },
      preview: thread.preview,
      unreadCount: thread.unreadCount,
      messages: thread.messages.map((message) => ({ id: message.id, senderID: message.senderID, body: message.body, timestamp: message.timestamp })),
    };
  }

  private dashboardKey(userId: string) {
    return `dashboard:${userId}`;
  }

  private activityPrefix(userId: string) {
    return `activity:${userId}:`;
  }

  private activityPageKey(userId: string, page: number, pageSize: number) {
    return `${this.activityPrefix(userId)}${page}:${pageSize}`;
  }

  private dingSummaryKey(userId: string) {
    return `ding-summary:${userId}`;
  }

  private threadPagePrefix(userId: string) {
    return `thread-page:${userId}:`;
  }

  private threadPageKey(userId: string, page: number, pageSize: number) {
    return `${this.threadPagePrefix(userId)}${page}:${pageSize}`;
  }

  private threadMessagesPrefix(userId: string, threadID: string) {
    return `thread-messages:${userId}:${threadID}:`;
  }

  private threadMessagesPageKey(userId: string, threadID: string, page: number, pageSize: number) {
    return `${this.threadMessagesPrefix(userId, threadID)}${page}:${pageSize}`;
  }

  private profileKey(userId: string) {
    return `profile:${userId}`;
  }

  private async invalidateRunCaches(userId: string) {
    await this.cacheService.del(this.dashboardKey(userId));
    await this.cacheService.invalidatePrefix(this.activityPrefix(userId));
    await this.cacheService.del(this.profileKey(userId));
    await this.cacheService.del(this.dingSummaryKey(userId));
  }

  private async invalidateDingCaches(userId: string) {
    await this.cacheService.del(this.dingSummaryKey(userId));
  }

  private async invalidateChatCaches(userId: string, threadID?: string) {
    await this.cacheService.invalidatePrefix(this.threadPagePrefix(userId));
    if (threadID) {
      await this.cacheService.invalidatePrefix(this.threadMessagesPrefix(userId, threadID));
    }
  }
}
