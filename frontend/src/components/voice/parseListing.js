// ── Voice listing parser ───────────────────────────────────
// Turns an English speech transcript into listing fields.
// Pure functions only (no React, no browser APIs) so they can
// be unit-tested with `npm run test:voice`.

// Values must match the `neighbourhood` enum in backend/models/Listing.js
const NEIGHBOURHOODS = [
  { value: 'Kalingalinga', aliases: ['kalingalinga', 'kalinga linga'] },
  { value: 'Kanyama',      aliases: ['kanyama'] },
  { value: 'Mtendere',     aliases: ['mtendere', 'mutendere', 'm tendere'] },
  { value: 'Chilenje',     aliases: ['chilenje', 'chilenji'] },
  { value: 'Matero',       aliases: ['matero'] },
  { value: 'Bauleni',      aliases: ['bauleni', 'bauleny'] },
  { value: 'Chelstone',    aliases: ['chelstone', 'chelston'] },
  { value: 'Woodlands',    aliases: ['woodlands', 'woodland'] },
  { value: 'Kabwata',      aliases: ['kabwata'] },
  { value: 'Libala',       aliases: ['libala'] },
  { value: 'Lusaka_CBD',   aliases: ['lusaka cbd', 'cbd', 'city centre', 'city center', 'town centre', 'town center', 'in town', 'cairo road'] },
  { value: 'Munali',         aliases: ['munali'] },
  { value: 'Roma',           aliases: ['roma'] },
  { value: 'Lima',           aliases: ['lima'] },
  { value: 'Mandevu',        aliases: ['mandevu'] },
  { value: 'Makeni',         aliases: ['makeni'] },
  { value: 'Chawama',        aliases: ['chawama', 'cawama'] },
  { value: 'Feira',          aliases: ['feira', 'fera', 'fira'] },
  { value: 'Kafue West',     aliases: ['kafue west', 'kafu west'] },
  { value: 'Kafue South',    aliases: ['kafue south', 'kafu south'] },
  { value: 'Chongwe East',   aliases: ['chongwe east', 'chonwe east', 'chongwe ist'] },
  { value: 'Chongwe West',   aliases: ['chongwe west', 'chonwe west'] },
  { value: 'Chilanga South', aliases: ['chilanga south', 'cilanga south'] },
  { value: 'Chilanga North', aliases: ['chilanga north', 'cilanga north', 'chilanga noth', 'cilanga noth'] },
];

const CHARCOAL_TYPES = [
  { label: 'Hardwood', pattern: /\b(hard ?wood|miombo|mopane)\b/ },
  { label: 'Softwood', pattern: /\bsoft ?wood\b/ },
  { label: 'Mixed',    pattern: /\bmixed\b/ },
];

const SMALL = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES = { hundred: 100, thousand: 1000 };

const UNIT_WORD = '(?:bags?|sacks?|tins?|buckets?|kgs?|kilos?|kilograms?)';
const MAX_PRICE = 100000;
const MAX_QTY   = 10000;

const isNumberWord = (w) => w in SMALL || w in TENS || w in SCALES;

// "ninety five kwacha" → "95 kwacha", "one hundred and twenty" → "120"
export const wordsToDigits = (text) => {
  const words = text.split(' ');
  const out = [];
  let i = 0;

  while (i < words.length) {
    const w = words[i];
    const startsNumber =
      isNumberWord(w) || (w === 'a' && words[i + 1] in SCALES);

    if (!startsNumber) {
      out.push(w);
      i += 1;
      continue;
    }

    let total = 0;
    let current = 0;
    let consumed = false;
    let afterScale = false;

    // Only combine words that form one number: "ninety five" = 95,
    // but "five ten" stays two numbers (5 10)
    while (i < words.length) {
      const t = words[i];
      const below100 = current % 100;
      if (t === 'a' && !consumed && words[i + 1] in SCALES) {
        current = 1;
      } else if (t in SMALL && (below100 === 0 || (below100 >= 20 && below100 % 10 === 0 && SMALL[t] < 10))) {
        if (below100 === 0 && consumed && !afterScale) break;
        current += SMALL[t];
      } else if (t in TENS && below100 === 0) {
        if (consumed && !afterScale) break;
        current += TENS[t];
      } else if (t in SCALES && current < 1000) {
        current = (current || 1) * SCALES[t];
        if (SCALES[t] >= 1000) { total += current; current = 0; }
        afterScale = true;
        consumed = true;
        i += 1;
        continue;
      } else if (t === 'and' && afterScale && (words[i + 1] in SMALL || words[i + 1] in TENS)) {
        i += 1;
        continue;
      } else {
        break;
      }
      afterScale = false;
      consumed = true;
      i += 1;
    }
    out.push(String(total + current));
  }
  return out.join(' ');
};

export const normalise = (transcript) => {
  let t = String(transcript || '').toLowerCase();
  t = t.replace(/(\d),(\d{3})\b/g, '$1$2');        // 1,200 → 1200
  t = t.replace(/-/g, ' ');                         // twenty-five → twenty five
  t = t.replace(/[^a-z0-9.\s]/g, ' ');              // strip punctuation and symbols
  t = t.replace(/\.(?!\d)/g, ' ');                  // keep decimal points only
  t = t.replace(/\s+/g, ' ').trim();
  t = wordsToDigits(t);
  t = t.replace(/\bk\s?(\d)/g, 'k $1');             // k95 → k 95
  t = t.replace(/(\d)k\b/g, '$1 k');                // 95k → 95 k
  t = t.replace(/(\d)(kgs?|kilos?)\b/g, '$1 $2');   // 25kg → 25 kg
  t = t.replace(/\bkwachas?\b/g, 'kwacha');
  return t;
};

const toNumber = (s) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// Bag size: "25 kg bags", "50 kilo sacks" — a size, not a quantity
const findBagSize = (t) => {
  const m = t.match(/\b(\d+)\s*(?:kgs?|kilos?|kilograms?)\s+(?:bags?|sacks?)\b/);
  return m ? toNumber(m[1]) : null;
};

const stripBagSize = (t) =>
  t.replace(/\b\d+\s*(?:kgs?|kilos?|kilograms?)\s+(bags?|sacks?)\b/g, '$1');

const findPrice = (t) => {
  const patterns = [
    /\bk\s(\d+(?:\.\d+)?)\b/,                                         // K 95
    /\b(\d+(?:\.\d+)?)\s(?:kwacha|k)\b/,                              // 95 kwacha
    /\bkwacha\s(\d+(?:\.\d+)?)\b/,                                    // kwacha 95
    /\b(\d+(?:\.\d+)?)\s(?:each|apiece|per\s(?:bag|sack|tin|bucket|kg|kilo))\b/, // 95 each
    new RegExp(`\\b(?:for|at|price is|price|costs?|selling at)\\s(\\d+(?:\\.\\d+)?)\\b(?!\\s${UNIT_WORD}\\b)`),
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const n = toNumber(m[1]);
      if (n !== null && n > 0 && n <= MAX_PRICE) return n;
    }
  }
  return null;
};

const findQuantity = (t) => {
  const patterns = [
    /\b(\d+)\s(?:bags?|sacks?|tins?|buckets?)\b/,
    /\b(\d+)\s(?:kgs?|kilos?|kilograms?)\b(?!\s(?:each|per))/,
    /\b(?:i have|we have|quantity|qty|available)\s(\d+)\b/,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const n = toNumber(m[1]);
      if (n !== null && Number.isInteger(n) && n > 0 && n <= MAX_QTY) return n;
    }
  }
  return null;
};

// Unit must be one of 'bag' | 'tin' | 'kg' (Listing.unit enum)
const findUnit = (t) => {
  if (/\b(?:per|a|each)\s(?:kg|kilo|kilogram)\b/.test(t)) return 'kg';
  if (/\b\d+\s(?:kgs?|kilos?|kilograms?)\b/.test(t)) return 'kg';
  if (/\b(?:tins?|buckets?)\b/.test(t)) return 'tin';
  if (/\b(?:bags?|sacks?)\b/.test(t)) return 'bag';
  return null;
};

export const findNeighbourhood = (t) => {
  for (const { value, aliases } of NEIGHBOURHOODS) {
    for (const alias of aliases) {
      if (new RegExp(`\\b${alias}\\b`).test(t)) return value;
    }
  }
  return null;
};

const findCharcoalType = (t) => {
  for (const { label, pattern } of CHARCOAL_TYPES) {
    if (pattern.test(t)) return label;
  }
  return null;
};

const buildTitle = ({ charcoalType, bagSize, unit }) => {
  const base = charcoalType ? `${charcoalType} charcoal` : 'Charcoal';
  if (bagSize) return `${base} — ${bagSize}kg bags`;
  if (unit === 'tin') return `${base} by the tin`;
  if (unit === 'kg') return `${base} by the kg`;
  return base;
};

// Main entry point
export const parseListing = (transcript) => {
  const text = normalise(transcript);
  const bagSize = findBagSize(text);
  const body = stripBagSize(text);

  const price = findPrice(body);
  const quantity = findQuantity(body);
  const unit = findUnit(body);
  const neighbourhood = findNeighbourhood(text);
  const charcoalType = findCharcoalType(text);
  const mentionsCharcoal = /\bchar ?coal\b|\bmalasha\b|\bmaalasha\b/.test(text);

  return {
    text,
    title: mentionsCharcoal || charcoalType || bagSize ? buildTitle({ charcoalType, bagSize, unit }) : null,
    price,
    quantity,
    unit,
    neighbourhood,
  };
};

// How many fields a result filled — used to pick the best of
// several recognition alternatives
export const scoreParse = (p) =>
  ['price', 'quantity', 'neighbourhood', 'title', 'unit'].filter((k) => p[k] !== null).length;

export const parseBestAlternative = (alternatives) => {
  let best = null;
  for (const alt of alternatives) {
    if (!alt || !alt.trim()) continue;
    const parsed = { transcript: alt.trim(), ...parseListing(alt) };
    if (!best || scoreParse(parsed) > scoreParse(best)) best = parsed;
  }
  return best;
};

export const NEIGHBOURHOOD_VALUES = NEIGHBOURHOODS.map((n) => n.value);
