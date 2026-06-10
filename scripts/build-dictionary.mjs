// Builds public/dictionary.txt — the word list Waxle accepts during play.
//
//   node scripts/build-dictionary.mjs
//
// Inputs (all checked into the repo):
//   data/2of12inf.txt            12dicts "2 of 12 inflected" list by Alan Beale
//                                (https://wordlist.aspell.net/12dicts/): words
//                                that appear in at least 2 of 12 mainstream
//                                dictionaries, with inflections. Chosen over
//                                Scrabble lists (ENABLE/TWL) because those
//                                accept thousands of tournament-only obscurities
//                                ("oes", "zoa", "aal") that read as junk in a
//                                casual game. Entries may carry a trailing '%'
//                                (doubtful-plural marker) which is stripped.
//   data/dictionary-additions.txt  modern words the 12dicts vintage misses
//   data/dictionary-removals.txt   manual junk kills
//   data/offensive-words.json      slurs/obscenities excluded from play
//
// Output: public/dictionary.txt — one lowercase word (3+ letters) per line,
// sorted. The app loads it into a Set (src/lib/wordValidator.ts).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const WORD_RE = /^[a-z]{3,}$/;

function readWordLines(path) {
    return readFileSync(join(root, path), 'utf8')
        .split('\n')
        .map(line => line.replace(/\r$/, '').replace(/%$/, '').trim().toLowerCase())
        .filter(line => line && !line.startsWith('#'));
}

const base = readWordLines('data/2of12inf.txt');
const additions = readWordLines('data/dictionary-additions.txt');
const removals = new Set(readWordLines('data/dictionary-removals.txt'));
const offensive = new Set(
    JSON.parse(readFileSync(join(root, 'data/offensive-words.json'), 'utf8'))
        .map(w => w.toLowerCase())
);

const badAdditions = additions.filter(w => !WORD_RE.test(w));
if (badAdditions.length) {
    throw new Error(`Malformed additions (must match ${WORD_RE}): ${badAdditions.join(', ')}`);
}
const staleAdditions = additions.filter(w => base.includes(w));
if (staleAdditions.length) {
    console.warn(`note: additions already in base list (harmless): ${staleAdditions.join(', ')}`);
}

const words = new Set();
let skippedFormat = 0;
for (const w of [...base, ...additions]) {
    if (!WORD_RE.test(w)) { skippedFormat++; continue; }
    if (removals.has(w) || offensive.has(w)) continue;
    words.add(w);
}

const sorted = [...words].sort();
writeFileSync(join(root, 'public/dictionary.txt'), sorted.join('\n') + '\n');

console.log(`public/dictionary.txt: ${sorted.length} words`);
console.log(`  base entries: ${base.length}, additions: ${additions.length}`);
console.log(`  skipped (not ${WORD_RE}): ${skippedFormat}, removals: ${removals.size}, offensive: ${offensive.size}`);
