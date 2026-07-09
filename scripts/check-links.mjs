#!/usr/bin/env node
/* בודק קישורים פנימיים בכל קובצי ה-HTML תחת public/:
   href / src / link-prefetch שמצביעים לקבצים מקומיים – ומוודא שהקובץ קיים.
   הרצה:  node scripts/check-links.mjs
   מחזיר קוד יציאה 1 אם נמצא קישור שבור. ללא תלויות חיצוניות. */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PUBLIC_DIR = join(ROOT, 'public');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const htmlFiles = walk(PUBLIC_DIR).filter((f) => f.endsWith('.html'));
const attrRe = /(?:href|src)\s*=\s*["']([^"'#]+?)(?:[#?][^"']*)?["']/gi;

let broken = 0;
let checked = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(attrRe)) {
    const url = m[1].trim();
    // דילוג על קישורים חיצוניים/מיוחדים
    if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(url)) continue;
    if (url === '' || url === '/') continue;

    const target = url.startsWith('/')
      ? join(PUBLIC_DIR, url)
      : resolve(dirname(file), url);

    // ביטחון: לא לצאת מ-public
    if (!target.startsWith(PUBLIC_DIR + sep)) continue;

    checked++;
    if (!existsSync(target)) {
      broken++;
      console.error(`✗ ${file.replace(ROOT + sep, '')} → ${url}`);
    }
  }
}

console.log(`\nנבדקו ${checked} קישורים מקומיים ב-${htmlFiles.length} דפים.`);
if (broken) {
  console.error(`נמצאו ${broken} קישורים שבורים.`);
  process.exit(1);
}
console.log('כל הקישורים תקינים ✓');
