import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Encounter, RunRecord, RunnerProfile } from './types';

const id = () => randomUUID();

const runnerPool: RunnerProfile[] = [
  { id: id(), displayName: 'Runner #302', age: 29, badge: '10K Finisher', intro: 'Sunset interval lover' },
  { id: id(), displayName: 'Runner #511', age: 31, badge: 'Tempo Specialist', intro: 'Always at Central Park' },
  { id: id(), displayName: 'Runner #920', age: 26, badge: 'Sub-20 5K', intro: 'Fast but friendly' },
  { id: id(), displayName: 'Runner #108', age: 28, badge: 'Beginner Streak 22', intro: 'Training for first 10K' },
];

@Injectable()
export class EncounterGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForRun(userId: string, run: RunRecord) {
    const center = this.routeCenter(run);
    const runPaceSeconds = this.parsePace(run.averagePace);
    const candidates = runnerPool.map((runner, index) => {
      const minutes = Math.max(8, Math.round(run.distanceKM * (2 + index) + 6));
      const paceOffset = [-12, 6, -20, 18][index] ?? 0;
      const pace = this.formatPace(Math.max(240, runPaceSeconds + paceOffset));
      const distanceApartKM = Number((0.15 + index * 0.17 + Math.min(run.distanceKM / 50, 0.3)).toFixed(1));
      const latitude = center.latitude + (index - 1.5) * 0.0009;
      const longitude = center.longitude + (1.5 - index) * 0.0008;
      const place = ['Han River Park', 'Central Park', 'Seoul Forest', 'Olympic Park'][index] ?? 'City Loop';
      return this.makeEncounter(runner, index < 2 || run.distanceKM >= 8, latitude, longitude, place, pace, minutes, distanceApartKM);
    });

    for (const encounter of candidates) {
      await this.prisma.encounter.upsert({
        where: { userId_runnerId: { userId, runnerId: encounter.runner.id } },
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
          runnerId: encounter.runner.id,
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
  }

  private routeCenter(run: RunRecord) {
    if (!run.route.length) return { latitude: 37.5207, longitude: 126.9245 };
    const total = run.route.reduce(
      (acc, point) => ({ latitude: acc.latitude + point.latitude, longitude: acc.longitude + point.longitude }),
      { latitude: 0, longitude: 0 },
    );
    return { latitude: total.latitude / run.route.length, longitude: total.longitude / run.route.length };
  }

  private parsePace(text: string) {
    const match = text.match(/(\d+)'(\d+)/);
    if (!match) return 330;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private formatPace(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remaining = String(seconds % 60).padStart(2, '0');
    return `${minutes}'${remaining}/km`;
  }

  private makeEncounter(
    runner: RunnerProfile,
    likedYou: boolean,
    latitude: number,
    longitude: number,
    place: string,
    averagePace: string,
    encounterMinutes: number,
    distanceApartKM: number,
  ): Encounter {
    return { id: id(), runner, place, averagePace, encounterMinutes, distanceApartKM, likedYou, latitude, longitude };
  }
}
