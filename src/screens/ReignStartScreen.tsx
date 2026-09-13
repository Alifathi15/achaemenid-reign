import React, { useMemo } from 'react';
import { Icon } from '../components/Icons';
import objectivesData from '../data/objectives.json';
import type { ObjectiveRow } from '../engine/types';

const OBJECTIVES = objectivesData as unknown as ObjectiveRow[];

interface ReignStartScreenProps {
  dynastyIndex: number;
  kingName: string;
  startYear: number;
  unlockedAchievements: string[];
  /** Currently-active bearer set (who's actually in the court right now).
   * Used to filter which objectives are shown as this reign's goals — see
   * isObjectiveReachable() below. */
  activeBearers: Set<string>;
  onContinue: () => void;
}

/** An objective is only meaningful to show the player as a "goal to strive
 * for" if it's actually reachable given who is currently in the court.
 * Per explicit user requirement: goals shown at reign start must reflect
 * which card-bearer groups are actually active, not the raw objective list.
 * Rule (confirmed against the data — 38/45 objectives have no has_X term at
 * all, so this rarely excludes anything unnecessarily): an objective whose
 * condition references has_X is only reachable if X is currently in
 * activeBearers. Objectives with no has_X term (age/year/dynasty/flag-based)
 * are always considered reachable, since those don't depend on which bearer
 * cards have unlocked yet. */
function isObjectiveReachable(conditions: string | null, activeBearers: Set<string>): boolean {
  if (!conditions) return true;
  const hasMatches = conditions.match(/has_(\w+)/g);
  if (!hasMatches) return true;
  return hasMatches.every((m) => activeBearers.has(m.slice(4)));
}

export function ReignStartScreen({ dynastyIndex, kingName, startYear, unlockedAchievements, activeBearers, onContinue }: ReignStartScreenProps) {
  // Show 3 objective "goals to strive for" this reign: prioritize ones not
  // yet unlocked, mark done if the player already has them from a prior
  // reign. Only ever pick from objectives that are currently REACHABLE given
  // the active bearer set — otherwise the player is shown a goal like "talk
  // to the fortune teller" when the fortune teller was never unlocked in
  // this court, with no way to know how to make it appear.
  const goals = useMemo(() => {
    const unlockedSet = new Set(unlockedAchievements);
    const reachable = OBJECTIVES.filter((o) => isObjectiveReachable(o.conditions, activeBearers));
    const notDone = reachable.filter((o) => !unlockedSet.has(o.name));
    const done = reachable.filter((o) => unlockedSet.has(o.name));
    const picked = [...notDone.slice(0, 2), ...done.slice(0, 1)].slice(0, 3);
    return picked.map((o) => ({ title: o.title, done: unlockedSet.has(o.name) }));
  }, [unlockedAchievements, activeBearers]);

  // future generation preview avatars — purely decorative, cycles a fixed set
  const futureAvatars = ['🏹', '🛕', '🏯', '⚔'];

  const totalTicks = 9;
  const currentTickIndex = Math.min(4, dynastyIndex - 1 + 3);

  return (
    <div style={{ height: '100%', background: 'var(--brown)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 36, padding: '20px 0 8px' }}>
        <Icon name="crown" style={{ width: 17, height: 17, color: 'var(--gold)' }} />
        <Icon name="scroll" style={{ width: 17, height: 17, color: 'var(--gold)' }} />
        <Icon name="gear" style={{ width: 17, height: 17, color: 'var(--gold)' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '10px 20px' }}>
        <div style={{ color: 'var(--gold)', fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{startYear}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Array.from({ length: totalTicks }).map((_, i) => {
            if (i === currentTickIndex) {
              return (
                <div
                  key="current"
                  style={{
                    width: 34, height: 34, borderRadius: '50%', background: 'var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                    boxShadow: '0 0 0 3px rgba(196,154,58,.25)',
                  }}
                >
                  👑
                </div>
              );
            }
            const isActive = i < currentTickIndex;
            return (
              <div
                key={i}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isActive ? 'var(--gold)' : 'rgba(232,220,194,.25)',
                }}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 14, opacity: 0.55 }}>
          {futureAvatars.map((a, i) => (
            <div key={i} style={{ fontSize: 18 }}>{a}</div>
          ))}
        </div>

        <div style={{ color: 'var(--ivory)', textAlign: 'center', marginTop: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{kingName}</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{dynastyIndex}اُمین شاهِ دودمان</div>
        </div>

        <div style={{ width: '100%', height: 1, background: 'rgba(232,220,194,.15)', margin: '10px 0' }} />

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {goals.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: g.done ? 'none' : '1.5px solid rgba(232,220,194,.4)',
                  background: g.done ? 'var(--gold)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'var(--brown)', fontWeight: 800,
                }}
              >
                {g.done ? '✓' : ''}
              </div>
              <div style={{ color: 'var(--ivory)', fontSize: 13, opacity: g.done ? 1 : 0.75 }}>{g.title}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 32px' }}>
        <button className="btn btn-primary" onClick={onContinue}>
          آغازِ سلطنت
        </button>
      </div>
    </div>
  );
}
