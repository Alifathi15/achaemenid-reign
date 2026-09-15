/**
 * db.ts — local persistence layer using Dexie (IndexedDB wrapper).
 * Stores: player profile (coins, dynasty count, unlocked achievements,
 * settings), the LIVE in-progress reign's game state (so closing the app
 * mid-reign doesn't lose the year/stats/story progress — see
 * gameEngine.ts's SerializedGameState/serializeGameState), and reign
 * history summaries.
 */
import Dexie, { type Table } from 'dexie';
import type { SerializedGameState } from '../engine/gameEngine';

export interface PlayerProfile {
  id: 'main'; // singleton row
  coins: number;
  dynastyCount: number;
  totalReigns: number;
  /** Objective names (ObjectiveRow.name) unlocked so far — DYNASTY-WIDE,
   * never reset per reign. See gameEngine.ts's loadUnlockedObjectives(). */
  unlockedAchievements: string[];
  soundEnabled: boolean;
  musicEnabled: boolean;
  language: string;
  /** The tester's own display name, entered once before their first reign.
   * Sent alongside the card-draw debug log on every death so the developer
   * can tell whose playtest a given log came from — see
   * telegramReport.ts's sendDeathReportToTelegram(). Empty string means
   * "not yet asked" (see App.tsx's namePrompt screen). */
  playerName: string;
}

/** The currently in-progress reign, if any. Saved after every decision so
 * the app can resume exactly where the player left off — including mid
 * story-chain, mid-duel, or with an ending card ready to show — rather than
 * only checkpointing at death. Cleared once the reign ends (dies) or the
 * player deliberately abandons it. `screen` records which screen to resume
 * on (mainly 'game' vs 'duel'; other screens are transient and don't need
 * resuming into). */
export interface LiveReignRecord {
  id: 'current'; // singleton row
  gameState: SerializedGameState;
  currentCardId: number | null;
  decisionsCount: number;
  screen: 'game' | 'duel' | 'dungeon';
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
  liveReign!: Table<LiveReignRecord, string>;
  reigns!: Table<ReignRecord, number>;

  constructor() {
    super('AchaemenidReignDB');
    // v2 adds the liveReign table for in-progress-reign persistence.
    // Dexie migrates existing v1 installs automatically; no data is lost.
    this.version(2).stores({
      profile: 'id',
      liveReign: 'id',
      reigns: '++id, dynastyIndex, finishedAt',
    });
  }
}

export const db = new AchaemenidDB();

export async function getOrCreateProfile(): Promise<PlayerProfile> {
  const existing = await db.profile.get('main');
  if (existing) {
    // Backfill playerName for profiles created before this field existed —
    // Dexie doesn't enforce a schema on non-indexed fields, so an old
    // record simply won't have it, and `undefined` would break the
    // "not yet asked" empty-string check in App.tsx's namePrompt logic.
    if (existing.playerName === undefined) {
      existing.playerName = '';
    }
    return existing;
  }
  const fresh: PlayerProfile = {
    id: 'main',
    coins: 0,
    dynastyCount: 1,
    totalReigns: 0,
    unlockedAchievements: [],
    soundEnabled: true,
    musicEnabled: true,
    language: 'fa',
    playerName: '',
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

/** Persists the live, in-progress reign. Call after every decision (and on
 * duel start/finish) — cheap enough for IndexedDB, and it's what makes
 * closing the app mid-reign safe. */
export async function saveLiveReign(record: Omit<LiveReignRecord, 'id'>): Promise<void> {
  await db.liveReign.put({ id: 'current', ...record });
}

export async function getLiveReign(): Promise<LiveReignRecord | undefined> {
  return db.liveReign.get('current');
}

/** Clears the live-reign checkpoint — call when a reign ends (death) or is
 * deliberately abandoned (debug reset), since there's nothing to resume
 * into anymore. */
export async function clearLiveReign(): Promise<void> {
  await db.liveReign.delete('current');
}
