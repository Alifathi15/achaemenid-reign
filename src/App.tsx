import React, { useEffect, useState, useCallback } from 'react';
import { IconSprite } from './components/Icons';
import { HomeScreen } from './screens/HomeScreen';
import { ReignStartScreen } from './screens/ReignStartScreen';
import { MainGameScreen } from './screens/MainGameScreen';
import { DeathScreen } from './screens/DeathScreen';
import { ProgressSummaryScreen } from './screens/ProgressSummaryScreen';
import { ShopScreen } from './screens/ShopScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { createInitialState, selectNextCard, applyDecision, resetUnlockedObjectives } from './engine/gameEngine';
import type { CardRow, GameState } from './engine/types';
import { computeCoinsEarned, ABILITY_PRICES, COIN_PACKS } from './economy/economy';
import { getOrCreateProfile, saveProfile, recordReign, type PlayerProfile } from './db/db';

type Screen = 'loading' | 'home' | 'reignStart' | 'game' | 'death' | 'progress' | 'shop' | 'settings';

const KING_NAMES = ['داریوش', 'خشایارشا', 'کوروش', 'اردشیر', 'کمبوجیه', 'وشتاسپ'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [currentCard, setCurrentCard] = useState<CardRow | null>(null);
  const [decisionsCount, setDecisionsCount] = useState(0);
  const [lastReignCoins, setLastReignCoins] = useState(0);
  const [lastDeathAge, setLastDeathAge] = useState(0);
  const [lastYearsRuled, setLastYearsRuled] = useState(0);
  const [lastDeathReason, setLastDeathReason] = useState('');
  const [lastNewAchievements, setLastNewAchievements] = useState(0);

  useEffect(() => {
    getOrCreateProfile().then((p) => {
      setProfile(p);
      setScreen('home');
    });
  }, []);

  const persistProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    void saveProfile(next);
  }, []);

  function handleStart() {
    resetUnlockedObjectives();
    const fresh = createInitialState();
    fresh.dynasty = profile?.dynastyCount ?? 1;
    setState(fresh);
    setDecisionsCount(0);
    setScreen('reignStart');
  }

  function handleReignStartContinue() {
    const next = selectNextCard(state);
    setCurrentCard(next);
    setScreen('game');
  }

  function handleDecide(decision: 'yes' | 'no') {
    if (!currentCard) return;
    const result = applyDecision(state, currentCard, decision);
    setState({ ...state });
    setDecisionsCount((c) => c + 1);

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
        decisionsCount: decisionsCount + 1,
        finishedAt: Date.now(),
      });

      if (profile) {
        persistProfile({
          ...profile,
          coins: profile.coins + coinsEarned,
          dynastyCount: profile.dynastyCount + 1,
          totalReigns: profile.totalReigns + 1,
        });
      }
      setScreen('death');
      return;
    }

    const next = selectNextCard(state);
    setCurrentCard(next);
  }

  function handleDeathContinue() {
    setScreen('progress');
  }

  function handleProgressContinue() {
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
        />
      )}

      {screen === 'reignStart' && (
        <ReignStartScreen
          dynastyIndex={state.dynasty}
          kingName={KING_NAMES[state.dynasty % KING_NAMES.length]}
          onContinue={handleReignStartContinue}
        />
      )}

      {screen === 'game' && currentCard && (
        <MainGameScreen card={currentCard} state={state} onDecide={handleDecide} />
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
        />
      )}
    </div>
  );
}
