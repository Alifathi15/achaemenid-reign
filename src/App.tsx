import React, { useEffect, useState, useCallback } from 'react';
import { IconSprite } from './components/Icons';
import { HomeScreen } from './screens/HomeScreen';
import { ReignStartScreen } from './screens/ReignStartScreen';
import { MainGameScreen } from './screens/MainGameScreen';
import { DeathScreen } from './screens/DeathScreen';
import { ProgressSummaryScreen } from './screens/ProgressSummaryScreen';
import { ShopScreen } from './screens/ShopScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import {
  createInitialState,
  createNextReignState,
  selectNextCard,
  applyDecision,
  resolveDuelOutcome,
  resolveDungeonOutcome,
  loadUnlockedObjectives,
  getUnlockedObjectiveNames,
  serializeGameState,
  deserializeGameState,
  CARDS,
} from './engine/gameEngine';
import type { CardRow, GameState } from './engine/types';
import { computeCoinsEarned, ABILITY_PRICES, COIN_PACKS } from './economy/economy';
import {
  getOrCreateProfile,
  saveProfile,
  recordReign,
  saveLiveReign,
  getLiveReign,
  clearLiveReign,
  type PlayerProfile,
} from './db/db';
import { DuelScreen } from './screens/DuelScreen';
import { DungeonScreen } from './screens/DungeonScreen';
import bearersData from './data/bearers.json';

const BEARERS = bearersData as { key: string; role: string; persianName: string }[];

type Screen = 'loading' | 'home' | 'reignStart' | 'game' | 'duel' | 'dungeon' | 'death' | 'progress' | 'shop' | 'settings';

const KING_NAMES = ['داریوش', 'خشایارشا', 'کوروش', 'اردشیر', 'کمبوجیه', 'وشتاسپ'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [currentCard, setCurrentCard] = useState<CardRow | null>(null);
  const [decisionsCount, setDecisionsCount] = useState(0);
  const [hasSavedReign, setHasSavedReign] = useState(false);
  // True right after a reign ends: `state` already holds the correctly
  // carried-over heir state (see createNextReignState — stats reset,
  // dynasty-wide flags/counters/roster kept, family bearers cleared,
  // reign-scoped locks reopened). handleStart must use THIS state as-is
  // instead of calling createInitialState() again, or all that carryover
  // (including the persistence rules that make conditions/lockturn keep
  // being honored for the heir) would be silently discarded.
  const [readyForNextReign, setReadyForNextReign] = useState(false);
  const [lastReignCoins, setLastReignCoins] = useState(0);
  const [lastDeathAge, setLastDeathAge] = useState(0);
  const [lastYearsRuled, setLastYearsRuled] = useState(0);
  const [lastDeathReason, setLastDeathReason] = useState('');
  const [lastNewAchievements, setLastNewAchievements] = useState(0);

  useEffect(() => {
    getOrCreateProfile().then((p) => {
      setProfile(p);
      // Achievements are dynasty-wide (see gameEngine.ts's
      // loadUnlockedObjectives doc comment) — load them once here, NOT on
      // every reign start. Previously resetUnlockedObjectives() was called
      // in handleStart(), which wiped the whole game's achievement
      // progress back to zero every single time the player started a new
      // reign — a real bug, not just a missing save feature.
      loadUnlockedObjectives(p.unlockedAchievements);
      setScreen('home');
    });
  }, []);

  // Detect whether there's a live, in-progress reign to resume — checked
  // once on startup and re-checked whenever we return to Home, so the
  // "شروع"/"ادامه" button label and behavior stay accurate.
  const refreshSavedReignFlag = useCallback(() => {
    getLiveReign().then((rec) => setHasSavedReign(!!rec));
  }, []);
  useEffect(() => {
    refreshSavedReignFlag();
  }, [refreshSavedReignFlag]);

  const persistProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    void saveProfile(next);
  }, []);

  /** Persists the LIVE in-progress reign after every state-changing action
   * (decision, duel resolution) — not just at death. This is what makes
   * closing the app mid-reign safe: reopening resumes from exactly this
   * point, including mid-chain/mid-duel, rather than losing the reign. */
  const persistLiveReign = useCallback(
    (nextState: GameState, nextCard: CardRow | null, nextDecisionsCount: number, nextScreen: 'game' | 'duel' | 'dungeon') => {
      void saveLiveReign({
        gameState: serializeGameState(nextState),
        currentCardId: nextCard?.id ?? null,
        decisionsCount: nextDecisionsCount,
        screen: nextScreen,
      });
    },
    []
  );

  function handleStart() {
    // "شروع/ادامه": if there's a saved live reign, resume it exactly where
    // it left off (screen, current card, decision count included) instead
    // of starting a fresh one — this is the actual fix for "closing the app
    // loses your progress".
    getLiveReign().then((rec) => {
      if (rec) {
        const restoredState = deserializeGameState(rec.gameState);
        setState(restoredState);
        setDecisionsCount(rec.decisionsCount);
        if (rec.screen === 'duel' && restoredState.pendingDuelKey) {
          setScreen('duel');
        } else if (rec.screen === 'dungeon' && restoredState.pendingDungeonKey) {
          setScreen('dungeon');
        } else {
          const card = rec.currentCardId ? CARDS.find((c) => c.id === rec.currentCardId) ?? null : null;
          setCurrentCard(card);
          setScreen('game');
        }
        return;
      }
      // No saved live reign. Two cases:
      //  (a) readyForNextReign=true: a reign just ended and `state` already
      //      holds the correctly carried-over heir state — use it as-is.
      //  (b) readyForNextReign=false: genuinely the very first reign ever
      //      (or after the debug reset) — build a brand-new dynasty-1 state.
      if (!readyForNextReign) {
        const fresh = createInitialState();
        fresh.dynasty = profile?.dynastyCount ?? 1;
        setState(fresh);
      }
      setReadyForNextReign(false);
      setDecisionsCount(0);
      setScreen('reignStart');
    });
  }

  /** Debug/QA button: force-reset to dynasty 1 and start a fresh reign, so
   * the tutorial/opening card (id 575, "first_card") is guaranteed to show
   * up every time, regardless of how many reigns have been played before.
   * Persists dynastyCount=1 to the profile too, so this isn't just a
   * one-shot in-memory trick — reopening the app afterward keeps it reset.
   * Also clears any saved live reign, since this is an explicit "start
   * completely over" action. */
  function handleResetToFirstCard() {
    void clearLiveReign();
    const fresh = createInitialState();
    fresh.dynasty = 1;
    setState(fresh);
    setReadyForNextReign(false);
    setDecisionsCount(0);
    if (profile) {
      const resetProfile = { ...profile, dynastyCount: 1, unlockedAchievements: [] };
      loadUnlockedObjectives([]);
      persistProfile(resetProfile);
    }
    refreshSavedReignFlag();
    setScreen('reignStart');
  }

  function handleReignStartContinue() {
    if (state.pendingDuelKey) {
      persistLiveReign(state, null, decisionsCount, 'duel');
      setScreen('duel');
      return;
    }
    if (state.pendingDungeonKey) {
      persistLiveReign(state, null, decisionsCount, 'dungeon');
      setScreen('dungeon');
      return;
    }
    const next = selectNextCard(state);
    setCurrentCard(next);
    persistLiveReign(state, next, decisionsCount, 'game');
    setScreen('game');
  }

  function handleDecide(decision: 'yes' | 'no') {
    if (!currentCard) return;
    const result = applyDecision(state, currentCard, decision);
    setState({ ...state });
    const nextDecisionsCount = decisionsCount + 1;
    setDecisionsCount(nextDecisionsCount);

    if (result.died) {
      const coinsEarned = computeCoinsEarned(state.age);
      setLastDeathAge(state.age);
      setLastYearsRuled(state.age - 18);
      setLastDeathReason(result.deathReason ?? '');
      setLastReignCoins(coinsEarned);
      setLastNewAchievements(result.unlockedObjectives.length);

      void recordReign({
        dynastyIndex: state.dynasty,
        kingName: KING_NAMES[state.dynasty % KING_NAMES.length],
        ageAtDeath: state.age,
        yearsRuled: state.age - 18,
        deathReason: result.deathReason ?? 'unknown',
        coinsEarned,
        decisionsCount: nextDecisionsCount,
        finishedAt: Date.now(),
      });

      if (profile) {
        persistProfile({
          ...profile,
          coins: profile.coins + coinsEarned,
          dynastyCount: profile.dynastyCount + 1,
          totalReigns: profile.totalReigns + 1,
          // Achievements unlocked this reign are already in the module-level
          // tracker (applyDecision adds to it directly) — persist the full
          // current list so it survives a reload.
          unlockedAchievements: getUnlockedObjectiveNames(),
        });
      }
      // The reign is over — nothing left to resume into. Pre-build the NEXT
      // reign's carried-over state (stats reset, dynasty-wide flags/roster
      // kept, family bearers cleared — see createNextReignState's doc
      // comment) so handleDeathContinue -> handleProgressContinue -> the
      // next "شروع" press starts the heir already correctly initialized,
      // honoring every persistence rule (including lockturn/conditions)
      // exactly as they'd apply mid-reign.
      const heirState = createNextReignState(state);
      setState(heirState);
      setReadyForNextReign(true);
      void clearLiveReign();
      setScreen('death');
      return;
    }

    if (state.pendingDuelKey) {
      persistLiveReign(state, currentCard, nextDecisionsCount, 'duel');
      setScreen('duel');
      return;
    }

    if (state.pendingDungeonKey) {
      persistLiveReign(state, currentCard, nextDecisionsCount, 'dungeon');
      setScreen('dungeon');
      return;
    }

    const next = selectNextCard(state);
    setCurrentCard(next);
    persistLiveReign(state, next, nextDecisionsCount, 'game');
  }

  function handleDuelFinished(kingWon: boolean) {
    resolveDuelOutcome(state, kingWon);
    setState({ ...state });
    const next = selectNextCard(state);
    setCurrentCard(next);
    persistLiveReign(state, next, decisionsCount, 'game');
    setScreen('game');
  }

  function handleDungeonFinished(kingWon: boolean) {
    resolveDungeonOutcome(state, kingWon);
    setState({ ...state });
    const next = selectNextCard(state);
    setCurrentCard(next);
    persistLiveReign(state, next, decisionsCount, 'game');
    setScreen('game');
  }

  function handleDeathContinue() {
    setScreen('progress');
  }

  function handleProgressContinue() {
    refreshSavedReignFlag();
    setScreen('home');
  }

  function handleBuyPack(packId: string) {
    if (!profile) return;
    const pack = COIN_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    // Real IAP flow not wired in this build — simulate grant for local testing.
    persistProfile({ ...profile, coins: profile.coins + pack.coins });
  }

  function handleBuyUndo() {
    if (!profile || profile.coins < ABILITY_PRICES.undoCard) return;
    persistProfile({ ...profile, coins: profile.coins - ABILITY_PRICES.undoCard });
  }

  function handleBuyLife() {
    if (!profile || profile.coins < ABILITY_PRICES.life) return;
    persistProfile({ ...profile, coins: profile.coins - ABILITY_PRICES.life });
  }

  function handleToggleSound() {
    if (!profile) return;
    persistProfile({ ...profile, soundEnabled: !profile.soundEnabled });
  }

  function handleToggleMusic() {
    if (!profile) return;
    persistProfile({ ...profile, musicEnabled: !profile.musicEnabled });
  }

  return (
    <div className="app-shell">
      <IconSprite />
      {screen === 'loading' && <div style={{ color: 'var(--brown)', textAlign: 'center', paddingTop: 40 }}>در حالِ بارگذاری...</div>}

      {screen === 'home' && profile && (
        <HomeScreen
          onStart={handleStart}
          onOpenShop={() => setScreen('shop')}
          onOpenSettings={() => setScreen('settings')}
          onOpenDynastyHistory={() => setScreen('settings')}
          hasSavedReign={hasSavedReign}
        />
      )}

      {screen === 'reignStart' && (
        <ReignStartScreen
          dynastyIndex={state.dynasty}
          kingName={KING_NAMES[state.dynasty % KING_NAMES.length]}
          startYear={state.year}
          unlockedAchievements={profile?.unlockedAchievements ?? []}
          activeBearers={state.activeBearers}
          onContinue={handleReignStartContinue}
        />
      )}

      {screen === 'game' && currentCard && (
        <MainGameScreen card={currentCard} state={state} onDecide={handleDecide} />
      )}

      {screen === 'duel' && state.pendingDuelKey && (
        <DuelScreen
          kingName={KING_NAMES[state.dynasty % KING_NAMES.length]}
          opponentKey={state.pendingDuelKey}
          opponentLabel={
            BEARERS.find((b) => state.pendingDuelKey?.includes(b.key))?.persianName ?? 'حریف'
          }
          onFinished={handleDuelFinished}
        />
      )}

      {screen === 'dungeon' && state.pendingDungeonKey && (
        <DungeonScreen
          kingName={KING_NAMES[state.dynasty % KING_NAMES.length]}
          onFinished={handleDungeonFinished}
        />
      )}

      {screen === 'death' && (
        <DeathScreen
          ageAtDeath={lastDeathAge}
          yearsRuled={lastYearsRuled}
          reason={lastDeathReason}
          onContinue={handleDeathContinue}
        />
      )}

      {screen === 'progress' && (
        <ProgressSummaryScreen
          yearsRuled={lastYearsRuled}
          decisionsCount={decisionsCount}
          coinsEarned={lastReignCoins}
          newAchievementsCount={lastNewAchievements}
          onContinue={handleProgressContinue}
        />
      )}

      {screen === 'shop' && profile && (
        <ShopScreen
          coins={profile.coins}
          onBack={() => setScreen('home')}
          onBuyUndo={handleBuyUndo}
          onBuyLife={handleBuyLife}
          onBuyPack={handleBuyPack}
        />
      )}

      {screen === 'settings' && profile && (
        <SettingsScreen
          soundEnabled={profile.soundEnabled}
          musicEnabled={profile.musicEnabled}
          onToggleSound={handleToggleSound}
          onToggleMusic={handleToggleMusic}
          onBack={() => setScreen('home')}
          onResetToFirstCard={handleResetToFirstCard}
        />
      )}
    </div>
  );
}
