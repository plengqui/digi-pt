// One-off helper: merges catalog/parts/*.json into catalog/source.json (sorted by id).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = join(root, 'catalog', 'parts');
const all = [];
for (const f of readdirSync(partsDir).filter((f) => f.endsWith('.json')).sort()) {
  const entries = JSON.parse(readFileSync(join(partsDir, f), 'utf8'));
  console.log(`${f}: ${entries.length}`);
  all.push(...entries);
}
all.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(root, 'catalog', 'source.json'), JSON.stringify(all, null, 2) + '\n');
console.log(`source.json: ${all.length} entries`);
