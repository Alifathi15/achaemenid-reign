/**
 * economy.ts — the CONFIRMED monetization economy for Achaemenid Reign.
 * All numbers below are final decisions made with the user; do not
 * "improve" or rebalance without explicit instruction.
 *
 * Coin-earning formula (base x8 scale, confirmed):
 *   coins/year = base_rate_for_bracket
 *   brackets (age): <=20:4, 20-40:5, 40-60:6, 60-80:8, 80-100:10, 100-200:12, 200+:14
 *   flat one-time threshold bonuses: +8(20) +16(40) +24(60) +32(80) +40(100) +80(200)
 *
 * Ability prices (confirmed):
 *   undoCard = 100 coins
 *   life     = 350 coins
 *
 * Coin packs for direct life-bundle purchase (confirmed):
 *   base:   2000 coins / 99,000 toman
 *   medium: 3750 coins / 179,000 toman
 *   large:  5500 coins / 249,000 toman
 */

export interface AgeBracket {
  minAge: number;
  maxAge: number;
  coinsPerYear: number;
  bonusAtUpperBound: number; // one-time bonus applied once age crosses maxAge
}

export const AGE_BRACKETS: AgeBracket[] = [
  { minAge: 18, maxAge: 20, coinsPerYear: 4, bonusAtUpperBound: 8 },
  { minAge: 20, maxAge: 40, coinsPerYear: 5, bonusAtUpperBound: 16 },
  { minAge: 40, maxAge: 60, coinsPerYear: 6, bonusAtUpperBound: 24 },
  { minAge: 60, maxAge: 80, coinsPerYear: 8, bonusAtUpperBound: 32 },
  { minAge: 80, maxAge: 100, coinsPerYear: 10, bonusAtUpperBound: 40 },
  { minAge: 100, maxAge: 200, coinsPerYear: 12, bonusAtUpperBound: 80 },
  { minAge: 200, maxAge: Infinity, coinsPerYear: 14, bonusAtUpperBound: 0 },
];

/**
 * Computes total coins earned for a reign that ended at `deathAge`
 * (age 18 = 0 years lived = 0 coins, per the confirmed boundary rule).
 * Rounding happens ONLY once, at the very end (anti-accumulation-error rule).
 */
export function computeCoinsEarned(deathAge: number): number {
  if (deathAge <= 18) return 0;
  let total = 0;
  for (const bracket of AGE_BRACKETS) {
    if (deathAge <= bracket.minAge) break;
    const yearsInBracket = Math.min(deathAge, bracket.maxAge) - bracket.minAge;
    if (yearsInBracket <= 0) continue;
    total += yearsInBracket * bracket.coinsPerYear;
    if (deathAge >= bracket.maxAge) {
      total += bracket.bonusAtUpperBound;
    }
  }
  return Math.round(total);
}

export const ABILITY_PRICES = {
  undoCard: 100,
  life: 350,
} as const;

export interface CoinPack {
  id: string;
  coins: number;
  priceToman: number;
  label: string;
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'base', coins: 2000, priceToman: 99000, label: 'پکِ پایه' },
  { id: 'medium', coins: 3750, priceToman: 179000, label: 'پکِ متوسط' },
  { id: 'large', coins: 5500, priceToman: 249000, label: 'پکِ بزرگ' },
];
