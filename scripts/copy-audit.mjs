#!/usr/bin/env node
/**
 * copy-audit.mjs — checks published copy against Personal Information/BlogHumanizerPrompt.md
 *
 *   node scripts/copy-audit.mjs index.html llms.txt
 *
 * Scans visible prose only: head, scripts, inline SVG and HTML comments are
 * stripped first, so code comments and structured data never trip the check.
 * Exits non-zero if anything fails, which makes it usable as a pre-commit hook.
 */

import fs from 'node:fs';

/* -- the zero-tolerance lists, transcribed from BlogHumanizerPrompt.md ----- */
const SINGLE = `peril fraught thwart dire vibrant bustling essential vital soul crucible tapestry
landscape pesky promptly reverberate enhance emphasise enable delve revolutionize folks foster
labyrinthine moist remnant nestled symphony labyrinth gossamer enigma whispering metamorphosis
indelible embark navigate mastering elevate unleash harness meticulous meticulously navigating
complexities realm dive shall tailored towards underpins daunting amongst robust diving rapidly
expanding excels keen fancy metropolis crucial`.split(/\s+/);

const TRANSITION = `firstly moreover furthermore however therefore additionally specifically
generally consequently importantly similarly nonetheless indeed thus alternatively notably
despite essentially while unless although subsequently arguably`.split(/\s+/);

const PHRASE = [
  'ever-evolving', 'cutting-edge', 'even though', 'in contrast', 'in order to', 'due to',
  'even if', 'given that', 'as a result', 'as well as', 'that being said', 'you may want to',
  'it is important to note', 'this is not an exhaustive list', 'you could consider', 'in summary',
  'on the other hand', 'as previously mentioned', 'it is worth noting that', 'in conclusion',
  'to summarize', 'ultimately', 'to put it simply', 'dive into', 'in today', 'the world of',
  'out of the box', 'unlock the secrets', 'a testament to', 'designed to enhance',
  'it is advisable', 'when it comes to', 'in the realm of', 'journey', 'game changer',
  'not only', 'remember that', 'ensure', 'as a professional',
];

/* Decoding every named entity matters: miss one and each `&amp;` reads as a
   phantom semicolon, burying the real hits in false positives. */
const ENTITY = {
  mdash: '—', ndash: '–', middot: '·', rsquo: '’', lsquo: '‘',
  ldquo: '"', rdquo: '"', amp: '&', nbsp: ' ', copy: '©', hellip: '…',
  deg: '°', times: '×', lt: '<', gt: '>', quot: '"',
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function visibleText(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!file.endsWith('.html')) return raw;
  return (raw.split('<body>')[1] ?? raw)
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&([a-z]+);/gi, (m, n) => ENTITY[n] ?? m)
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
    .replace(/\s+/g, ' ')
    .trim();
}

function scan(list, text) {
  const hits = [];
  for (const term of list) {
    const m = text.match(new RegExp('\\b' + esc(term) + '\\b', 'gi'));
    if (m) hits.push(`${term} (${m.length})`);
  }
  return hits;
}

let failed = false;

for (const file of process.argv.slice(2)) {
  const text = visibleText(file);
  const words = text.split(/\s+/).length;
  const em = (text.match(/—/g) || []).length;
  const semi = (text.match(/;/g) || []).length;
  const banned = [
    ['single words', scan(SINGLE, text)],
    ['transitions', scan(TRANSITION, text)],
    ['phrases', scan(PHRASE, text)],
  ];

  // Burstiness: the prompt targets 30% short / 50% medium / 20% long.
  const lens = text.split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().split(/\s+/).length)
    .filter((n) => n > 1);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
  const pct = (f) => Math.round((lens.filter(f).length / lens.length) * 100);

  console.log(`\n${file}  (${words} visible words)`);
  console.log(`  em dashes   ${em}${em ? '  FAIL' : '  ok'}`);
  console.log(`  semicolons  ${semi}${semi ? '  FAIL' : '  ok'}`);
  for (const [label, hits] of banned) {
    console.log(`  ${label.padEnd(14)}${hits.length ? hits.join(', ') + '  FAIL' : '0  ok'}`);
    if (hits.length) failed = true;
  }
  console.log(`  burstiness  mean ${mean.toFixed(1)}w, sd ${sd.toFixed(1)}w, ` +
              `${pct((n) => n <= 8)}% short / ${pct((n) => n > 8 && n <= 20)}% med / ${pct((n) => n > 20)}% long`);
  if (sd < 5) { console.log('              sd under 5w  FAIL (rhythm too uniform)'); failed = true; }
  if (em || semi) failed = true;
}

console.log(failed ? '\nFAILED\n' : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
