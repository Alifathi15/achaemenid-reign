import React, { useMemo } from 'react';
import objectivesData from '../data/objectives.json';
import { ACHIEVEMENT_CATEGORIES } from '../data/achievementCategories';
import type { ObjectiveRow } from '../engine/types';

const OBJECTIVES = objectivesData as unknown as ObjectiveRow[];
const OBJECTIVES_BY_NAME = new Map(OBJECTIVES.map((o) => [o.name, o]));

// Dev-only sanity check: every objective must be categorized exactly once,
// and no category may reference a nonexistent objective. Catches the doc
// going stale if objectives.json ever gets a new/renamed entry.
if (import.meta.env.DEV) {
  const seen = new Set<string>();
  for (const cat of ACHIEVEMENT_CATEGORIES) {
    for (const name of cat.members) {
      if (!OBJECTIVES_BY_NAME.has(name)) {
        console.error(`achievementCategories: "${name}" in group "${cat.id}" is not a real objective`);
      }
      if (seen.has(name)) {
        console.error(`achievementCategories: "${name}" appears in more than one group`);
      }
      seen.add(name);
    }
  }
  for (const o of OBJECTIVES) {
    if (!seen.has(o.name)) {
      console.error(`achievementCategories: objective "${o.name}" is not in any group`);
    }
  }
}

interface AchievementsScreenProps {
  unlockedAchievements: string[];
  onBack: () => void;
}

export function AchievementsScreen({ unlockedAchievements, onBack }: AchievementsScreenProps) {
  const unlockedSet = useMemo(() => new Set(unlockedAchievements), [unlockedAchievements]);
  const unlockedCount = OBJECTIVES.filter((o) => unlockedSet.has(o.name)).length;

  return (
    <div style={{ height: '100%', background: 'var(--ivory)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 20px 12px', textAlign: 'center', flexShrink: 0 }}>
        <div style={{ color: 'var(--brown)', fontSize: 20, fontWeight: 700 }}>دستاوردها</div>
        <div style={{ color: 'var(--lapis)', fontSize: 13, marginTop: 4 }}>
          {unlockedCount.toLocaleString('fa-IR')} از {OBJECTIVES.length.toLocaleString('fa-IR')} باز شده
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {ACHIEVEMENT_CATEGORIES.map((cat) => {
          const items = cat.members
            .map((name) => OBJECTIVES_BY_NAME.get(name))
            .filter((o): o is ObjectiveRow => !!o);
          const catUnlocked = items.filter((o) => unlockedSet.has(o.name)).length;
          return (
            <div key={cat.id}>
              <div
                style={{
                  color: 'var(--brown)', fontSize: 13, fontWeight: 700, marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                }}
              >
                <span>{cat.title}</span>
                <span style={{ color: 'var(--lapis)', fontSize: 11, fontWeight: 600 }}>
                  {catUnlocked.toLocaleString('fa-IR')}/{items.length.toLocaleString('fa-IR')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((o) => {
                  const done = unlockedSet.has(o.name);
                  return (
                    <div
                      key={o.name}
                      style={{
                        background: '#fff', borderRadius: 12, padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        opacity: done ? 1 : 0.55,
                        boxShadow: '0 1px 4px rgba(0,0,0,.05)',
                      }}
                    >
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: done ? 'var(--gold)' : 'rgba(58,45,35,.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15,
                        }}
                      >
                        {done ? '✓' : '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--brown)', fontSize: 14, fontWeight: 700 }}>{o.title}</div>
                        <div style={{ color: 'var(--brown)', fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                          {done ? o.description : '؟؟؟'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '12px 20px 24px', flexShrink: 0 }}>
        <button className="btn btn-secondary" onClick={onBack}>
          بازگشت
        </button>
      </div>
    </div>
  );
}
