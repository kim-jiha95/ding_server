import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Encounter, RunRecord, RunRoutePoint, RunnerProfile } from './types';

const id = () => randomUUID();
const MAX_DISTANCE_METERS = 100;
const MAX_TIME_GAP_SECONDS = 300;
const RECENT_RUN_WINDOW_HOURS = 24;
const MIN_MATCHED_POINTS = 1;
const STRONG_MATCH_POINTS = 3;

@Injectable()
export class EncounterGenerationService {
  private readonly logger = new Logger(EncounterGenerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateForRun(userId: string, run: RunRecord): Promise<string[]> {
    const affectedUserIds = new Set<string>([userId]);

    await this.prisma.encounter.deleteMany({ where: { userId } });

    if (run.route.length < 1) {
      this.logger.log(`skip encounter generation userId=${userId} reason=insufficient-route-points count=${run.route.length}`);
      return Array.from(affectedUserIds);
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!currentUser) return Array.from(affectedUserIds);

    const currentRunner = this.toRunnerProfile(currentUser);
    const runStart = this.routeStart(run.route);
    const runEnd = this.routeEnd(run.route);
    const recentThreshold = new Date(runEnd.getTime() - RECENT_RUN_WINDOW_HOURS * 60 * 60 * 1000);

    const otherRuns = await this.prisma.run.findMany({
      where: {
        userId: { not: userId },
        createdAt: { gte: recentThreshold },
      },
      include: {
        routePoints: { orderBy: { pointOrder: 'asc' } },
        user: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    for (const otherRun of otherRuns) {
      const otherRoute = otherRun.routePoints.map((point) => ({
        id: point.id,
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
      }));

      if (otherRoute.length < 1) continue;

      const otherStart = this.routeStart(otherRoute);
      const otherEnd = this.routeEnd(otherRoute);
      if (!this.timeWindowsOverlap(runStart, runEnd, otherStart, otherEnd, MAX_TIME_GAP_SECONDS)) continue;

      const overlap = this.findEncounter(run.route, otherRoute);
      if (!overlap) continue;

      const otherRunner = this.toRunnerProfile(otherRun.user);
      const currentEncounter = this.makeEncounterFromOverlap(otherRunner, overlap, run.averagePace);
      const reciprocalEncounter = this.makeEncounterFromOverlap(currentRunner, overlap, otherRun.averagePace);

      await this.upsertEncounter(userId, otherRunner.id, currentEncounter);
      await this.upsertEncounter(otherRunner.id, currentRunner.id, reciprocalEncounter);
      affectedUserIds.add(otherRunner.id);
    }

    this.logger.log(`encounter generation finished userId=${userId} affected=${Array.from(affectedUserIds).join(',')}`);
    return Array.from(affectedUserIds);
  }

  private async upsertEncounter(userId: string, runnerId: string, encounter: Encounter) {
    await this.prisma.encounter.upsert({
      where: { userId_runnerId: { userId, runnerId } },
      update: {
        runnerDisplayName: encounter.runner.displayName,
        age: encounter.runner.age,
        badge: encounter.runner.badge,
        intro: encounter.runner.intro,
        place: encounter.place,
        averagePace: encounter.averagePace,
        encounterMinutes: encounter.encounterMinutes,
        distanceApartKM: encounter.distanceApartKM,
        likedYou: encounter.likedYou,
        latitude: encounter.latitude,
        longitude: encounter.longitude,
      },
      create: {
        id: encounter.id,
        userId,
        runnerId,
        runnerDisplayName: encounter.runner.displayName,
        age: encounter.runner.age,
        badge: encounter.runner.badge,
        intro: encounter.runner.intro,
        place: encounter.place,
        averagePace: encounter.averagePace,
        encounterMinutes: encounter.encounterMinutes,
        distanceApartKM: encounter.distanceApartKM,
        likedYou: encounter.likedYou,
        latitude: encounter.latitude,
        longitude: encounter.longitude,
      },
    });
  }

  private makeEncounterFromOverlap(runner: RunnerProfile, overlap: EncounterOverlap, averagePace: string): Encounter {
    return {
      id: id(),
      runner,
      place: 'Run Route Nearby',
      averagePace,
      encounterMinutes: overlap.encounterMinutes,
      distanceApartKM: Number((overlap.minDistanceMeters / 1000).toFixed(2)),
      likedYou: false,
      latitude: overlap.center.latitude,
      longitude: overlap.center.longitude,
    };
  }

  private findEncounter(routeA: RunRoutePoint[], routeB: RunRoutePoint[]): EncounterOverlap | null {
    const matches: Array<{ a: RunRoutePoint; b: RunRoutePoint; distanceMeters: number; midpoint: { latitude: number; longitude: number } }> = [];

    for (const pointA of routeA) {
      let bestMatch: { point: RunRoutePoint; distanceMeters: number } | null = null;
      for (const pointB of routeB) {
        const timeGapSeconds = Math.abs(pointA.timestamp.getTime() - pointB.timestamp.getTime()) / 1000;
        if (timeGapSeconds > MAX_TIME_GAP_SECONDS) continue;

        const distanceMeters = this.distanceMeters(pointA.latitude, pointA.longitude, pointB.latitude, pointB.longitude);
        if (distanceMeters > MAX_DISTANCE_METERS) continue;

        if (!bestMatch || distanceMeters < bestMatch.distanceMeters) {
          bestMatch = { point: pointB, distanceMeters };
        }
      }

      if (bestMatch) {
        matches.push({
          a: pointA,
          b: bestMatch.point,
          distanceMeters: bestMatch.distanceMeters,
          midpoint: {
            latitude: (pointA.latitude + bestMatch.point.latitude) / 2,
            longitude: (pointA.longitude + bestMatch.point.longitude) / 2,
          },
        });
      }
    }

    if (matches.length < MIN_MATCHED_POINTS) return null;

    const sorted = matches.sort((lhs, rhs) => lhs.a.timestamp.getTime() - rhs.a.timestamp.getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const rawDurationSeconds = Math.abs(last.a.timestamp.getTime() - first.a.timestamp.getTime()) / 1000;
    const durationSeconds = sorted.length >= STRONG_MATCH_POINTS
      ? Math.max(60, rawDurationSeconds)
      : Math.max(15, rawDurationSeconds);
    const encounterMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const minDistanceMeters = Math.min(...sorted.map((item) => item.distanceMeters));
    const center = sorted.reduce(
      (acc, item) => ({ latitude: acc.latitude + item.midpoint.latitude, longitude: acc.longitude + item.midpoint.longitude }),
      { latitude: 0, longitude: 0 },
    );

    return {
      encounterMinutes,
      minDistanceMeters,
      center: {
        latitude: center.latitude / sorted.length,
        longitude: center.longitude / sorted.length,
      },
    };
  }

  private toRunnerProfile(user: { id: string; username: string; profile: { level: number; bio: string } | null }): RunnerProfile {
    return {
      id: user.id,
      displayName: user.username,
      age: 0,
      badge: user.profile ? `Level ${user.profile.level}` : 'Runner',
      intro: user.profile?.bio ?? 'DING runner',
    };
  }

  private routeStart(route: RunRoutePoint[]): Date {
    return route.reduce((min, point) => (point.timestamp < min ? point.timestamp : min), route[0].timestamp);
  }

  private routeEnd(route: RunRoutePoint[]): Date {
    return route.reduce((max, point) => (point.timestamp > max ? point.timestamp : max), route[0].timestamp);
  }

  private timeWindowsOverlap(startA: Date, endA: Date, startB: Date, endB: Date, bufferSeconds: number): boolean {
    const bufferMs = bufferSeconds * 1000;
    return startA.getTime() <= endB.getTime() + bufferMs && startB.getTime() <= endA.getTime() + bufferMs;
  }

  private distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6_371_000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  }
}

interface EncounterOverlap {
  encounterMinutes: number;
  minDistanceMeters: number;
  center: {
    latitude: number;
    longitude: number;
  };
}
