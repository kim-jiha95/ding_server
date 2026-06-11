export type GenderPreference = 'Women' | 'Men' | 'Everyone';

export interface RunnerProfile {
  id: string;
  displayName: string;
  age: number;
  badge: string;
  intro: string;
}

export interface Encounter {
  id: string;
  runner: RunnerProfile;
  place: string;
  averagePace: string;
  encounterMinutes: number;
  distanceApartKM: number;
  likedYou: boolean;
  latitude: number;
  longitude: number;
}

export interface MatchResult {
  id: string;
  runner: RunnerProfile;
  matchedAt: string;
  conversationUnlocked: boolean;
}

export interface ChatParticipant {
  id: string;
  displayName: string;
  isOnline: boolean;
}

export interface ChatMessage {
  id: string;
  senderID: string;
  body: string;
  timestamp: string;
}

export interface ChatThread {
  id: string;
  participant: ChatParticipant;
  preview: string;
  messages: ChatMessage[];
  unreadCount: number;
}

export interface RunRoutePoint {
  id: string;
  latitude: number;
  longitude: number;
}

export interface LiveRunSplit {
  id: string;
  kilometer: number;
  splitTime: string;
  paceText: string;
}

export interface RunRecord {
  id: string;
  distanceKM: number;
  duration: string;
  averagePace: string;
  calories: number;
  dateLabel: string;
  route: RunRoutePoint[];
  splits: LiveRunSplit[];
}

export interface DingSummary {
  encounters: number;
  sentCount: number;
  matchCount: number;
  topLocations: number;
  received: Encounter[];
  candidates: Encounter[];
  matches: MatchResult[];
}

export interface UserProfile {
  id: string;
  name: string;
  level: number;
  bio: string;
  totalDistance: number;
  longestRun: number;
  averagePace: string;
  currentStreak: number;
}

export interface AuthSession {
  userID: string;
  username: string;
  accessToken: string;
  hasCompletedOnboarding: boolean;
  preference: GenderPreference;
}

export interface UserEntity {
  id: string;
  email: string;
  password: string;
  username: string;
  hasCompletedOnboarding: boolean;
  preference: GenderPreference;
  profile: UserProfile;
  runs: RunRecord[];
  dingSummary: DingSummary;
  threads: ChatThread[];
}
