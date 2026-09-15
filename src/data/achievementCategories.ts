export interface AchievementCategory {
  id: string;
  title: string;
  /** objective `name` keys (from objectives.json) belonging to this group, in display order. */
  members: string[];
}

/**
 * Groups the 45 objectives (src/data/objectives.json) into related clusters
 * so the achievements screen shows e.g. all age-milestones together, all
 * duel-related ones together, etc., instead of the flat original JSON order
 * (which mixes unrelated themes randomly). Every objective `name` must
 * appear in exactly one group — this is checked at runtime in dev via
 * assertAllObjectivesCategorized() in AchievementsScreen.tsx.
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
    members: ['sword', 'crusader', 'peacemaker', 'killer', 'onehand'],
  },
  {
    id: 'court',
    title: 'اعضای دربار',
    members: ['spy', 'patron', 'blessed', 'wise', 'sorcerer', 'father', 'homunculus'],
  },
  {
    id: 'love',
    title: 'عشق و روابط',
    members: ['lover', 'hatoful', 'farmerwolf'],
  },
  {
    id: 'religion',
    title: 'مذهب',
    members: ['cathedral', 'paganist', 'schizm', 'devil'],
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
      'stone', 'survivor', 'dungeon', 'spin', 'frozen', 'america', 'hat',
      'printer', 'fortune', 'musician', 'polyglot', 'elephant', 'partygoer', 'birdy',
    ],
  },
];
