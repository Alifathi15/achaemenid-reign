/**
 * generate_cards.mjs
 * Converts raw xlsx-derived JSON (cards_raw.json, effects_raw.json,
 * objectives_raw.json, bearers_raw.json) into clean, typed JSON files
 * under src/data/ for the app to import directly.
 *
 * Run: node scripts/generate_cards.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'src', 'data');
mkdirSync(DATA_DIR, { recursive: true });

function loadRaw(name) {
  const p = join(ROOT, `${name}_raw.json`);
  const j = JSON.parse(readFileSync(p, 'utf-8'));
  const [header, ...rows] = j.rows;
  return rows
    .filter((r) => r.some((v) => v !== null && v !== undefined && v !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));
}

// ---------- Cards ----------
const rawCards = loadRaw('cards');
const cards = rawCards.map((c) => ({
  id: c.id,
  thematic: c.thematic,
  cardKey: c.card_key,
  bearer: c.bearer,
  conditions: c.conditions,
  lockturn: c.lockturn,
  weight: c.weight,
  question: c.question,
  overrideYes: c.override_yes,
  overrideNo: c.override_no,
  answerYes: c.answer_yes,
  answerNo: c.answer_no,
  yes: {
    faith: c.yes_faith,
    army: c.yes_army,
    people: c.yes_people,
    treasury: c.yes_treasury,
    custom: c.yes_custom,
  },
  no: {
    faith: c.no_faith,
    army: c.no_army,
    people: c.no_people,
    treasury: c.no_treasury,
    custom: c.no_custom,
  },
}));

writeFileSync(join(DATA_DIR, 'cards.json'), JSON.stringify(cards), 'utf-8');
console.log(`cards.json: ${cards.length} cards`);

// ---------- Effects ----------
const rawEffects = loadRaw('effects');
const effects = rawEffects.map((e) => ({
  tag: e.tag,
  title: e.title,
  length: e.length,
  faith: e.faith,
  army: e.army,
  people: e.people,
  treasury: e.treasury,
  custom: e.custom,
}));
writeFileSync(join(DATA_DIR, 'effects.json'), JSON.stringify(effects), 'utf-8');
console.log(`effects.json: ${effects.length} effects`);

// ---------- Objectives ----------
const rawObjectives = loadRaw('objectives');
const objectives = rawObjectives.map((o) => ({
  name: o.name,
  title: o.title,
  conditions: o.conditions,
  achievementText: o.achievement_text,
  description: o.description,
}));
writeFileSync(join(DATA_DIR, 'objectives.json'), JSON.stringify(objectives), 'utf-8');
console.log(`objectives.json: ${objectives.length} objectives`);

// ---------- Bearers ----------
const rawBearers = loadRaw('bearers');
const bearers = rawBearers.map((b) => ({
  key: b.bearer_key,
  role: b['نقش'],
  persianName: b['معادل فارسی'],
}));
writeFileSync(join(DATA_DIR, 'bearers.json'), JSON.stringify(bearers), 'utf-8');
console.log(`bearers.json: ${bearers.length} bearers`);

console.log('Done. All data files generated under src/data/.');
