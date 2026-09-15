export interface AchievementCategory {
  id: string;
  title: string;
  /** objective `name` keys (from objectives.json) belonging to this group,
   * already sorted by ACHIEVEMENT_ORDER (see below) — do not reorder by
   * hand; regenerate via scripts_order_calc.cjs if objectives.json changes. */
  members: string[];
}

/**
 * Canonical, data-derived unlock order for all 45 objectives (src/data/
 * objectives.json), keyed by objective `name`. This is the SINGLE algorithm
 * applied to every achievement, so ordering is consistent and reproducible
 * instead of arbitrary:
 *
 *   - age>N objectives -> ordered by N directly (the age threshold itself).
 *   - year>N objectives -> ordered after every age objective (a year
 *     threshold is a dynasty-wide clock, not tied to any one card).
 *   - has_X (a court bearer) objectives -> ordered by the lowest card id
 *     that ever executes `add_X` (the earliest point in the full 883-card
 *     deck that bearer could join the court).
 *   - nb_X_keep counter objectives -> ordered by the lowest card id that
 *     ever increments that counter (the earliest point the counter could
 *     start moving toward the objective's threshold).
 *   - `>_chainKey` chain-jump objectives -> ordered by the lowest card id
 *     in that chain's group (the earliest point that story could begin).
 *   - plain flag objectives (isX / X_keep) -> ordered by the lowest card id
 *     that ever sets that flag true.
 *
 * This produces a "how early could a player realistically encounter this"
 * ordering, computed once by scripts_order_calc.cjs (kept at the repo root
 * during development, not shipped) and hand-verified against the real card
 * data. If objectives.json ever changes, re-run that script and update
 * ACHIEVEMENT_ORDER below — do not hand-edit the order.
 */
export const ACHIEVEMENT_ORDER: string[] = [
  'young', 'paganist', 'cathedral', 'killer', 'old', 'blessed', 'ancient',
  'conspiracy', 'grizzled', 'senile', 'lover', 'fossil', 'senator', 'crusader',
  'peacemaker', 'wise', 'dungeon', 'onehand', 'hat', 'eternal', 'shrewd',
  'america', 'stone', 'spin', 'patron', 'musician', 'father', 'sword',
  'greedy', 'farmerwolf', 'spy', 'sorcerer', 'printer', 'homunculus',
  'hatoful', 'frozen', 'fortune', 'devil', 'survivor', 'polyglot',
  'partygoer', 'elephant', 'schizm', 'birdy', 'millenium',
];

/**
 * Groups the 45 objectives into related clusters for display (so the
 * achievements screen shows all age-milestones together, all duel-related
 * ones together, etc). Every objective `name` must appear in exactly one
 * group — checked at runtime in dev via AchievementsScreen.tsx. Members
 * within each group are pre-sorted to match ACHIEVEMENT_ORDER.
 */
export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  {
    id: 'age',
    title: 'سن و بقا',
    members: ['young', 'old', 'ancient', 'grizzled', 'senile', 'fossil', 'eternal', 'millenium'],
  },
  {
    id: 'duel',
    title: 'دوئل و جنگ',
    members: ['killer', 'crusader', 'peacemaker', 'onehand', 'sword'],
  },
  {
    id: 'court',
    title: 'اعضای دربار',
    members: ['blessed', 'wise', 'patron', 'father', 'spy', 'sorcerer', 'homunculus'],
  },
  {
    id: 'love',
    title: 'عشق و روابط',
    members: ['lover', 'farmerwolf', 'hatoful'],
  },
  {
    id: 'religion',
    title: 'مذهب',
    members: ['paganist', 'cathedral', 'devil', 'schizm'],
  },
  {
    id: 'politics',
    title: 'سیاست و توطئه',
    members: ['conspiracy', 'senator', 'shrewd', 'greedy'],
  },
  {
    id: 'events',
    title: 'رویدادهای ویژه',
    members: [
      'dungeon', 'hat', 'america', 'stone', 'spin', 'musician', 'printer',
      'frozen', 'fortune', 'survivor', 'polyglot', 'partygoer', 'elephant', 'birdy',
    ],
  },
];
