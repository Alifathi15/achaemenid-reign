/**
 * db.ts — local persistence layer using Dexie (IndexedDB wrapper).
 * Stores: player profile (coins, dynasty count, unlocked achievements,
 * settings) and reign history summaries.
 */
import Dexie, { type Table } from 'dexie';

export interface PlayerProfile {
  id: 'main'; // singleton row
  coins: number;
  dynastyCount: number;
  totalReigns: number;
  unlockedAchievements: string[];
  soundEnabled: boolean;
  musicEnabled: boolean;
  language: string;
}

export interface ReignRecord {
  id?: number;
  dynastyIndex: number;
  kingName: string;
  ageAtDeath: number;
  yearsRuled: number;
  deathReason: string;
  coinsEarned: number;
  decisionsCount: number;
  finishedAt: number; // epoch ms
}

class AchaemenidDB extends Dexie {
  profile!: Table<PlayerProfile, string>;
  reigns!: Table<ReignRecord, number>;

  constructor() {
    super('AchaemenidReignDB');
    this.version(1).stores({
      profile: 'id',
      reigns: '++id, dynastyIndex, finishedAt',
    });
  }
}

export const db = new AchaemenidDB();

export async function getOrCreateProfile(): Promise<PlayerProfile> {
  const existing = await db.profile.get('main');
  if (existing) return existing;
  const fresh: PlayerProfile = {
    id: 'main',
    coins: 0,
    dynastyCount: 1,
    totalReigns: 0,
    unlockedAchievements: [],
    soundEnabled: true,
    musicEnabled: true,
    language: 'fa',
  };
  await db.profile.put(fresh);
  return fresh;
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  await db.profile.put(profile);
}

export async function recordReign(record: ReignRecord): Promise<void> {
  await db.reigns.add(record);
}

export async function listReigns(): Promise<ReignRecord[]> {
  return db.reigns.orderBy('finishedAt').reverse().toArray();
}
