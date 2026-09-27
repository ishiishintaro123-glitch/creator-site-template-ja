// Names each later part of a novel (src/content/novel-parts/) "<novel title> 第N部", so parts can be told apart in
// Pages CMS without typing a name. Run by the content workflow after every save, like the manuscript import;
// renaming a novel renames its parts too. Parts whose novel isn't found are left for the build to report.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { t } from '../src/site-config.mjs';

const WORKS_DIR = 'src/content/novels';
const PARTS_DIR = 'src/content/novel-parts';

// Same reading and writing as scripts/import-manuscripts.mjs, so Pages CMS's dates are written back unchanged.
const read = (path) => yaml.load(readFileSync(path, 'utf8'), { schema: yaml.CORE_SCHEMA }) ?? {};

for (const fileName of existsSync(PARTS_DIR) ? readdirSync(PARTS_DIR).filter((name) => name.endsWith('.yaml')) : []) {
	const path = join(PARTS_DIR, fileName);
	const part = read(path);
	// Pages CMS saves the novel's path; the bare ID is accepted too (see src/lib/novels.ts).
	const workId = String(part.work ?? '').replace(/^.*\//, '').replace(/\.yaml$/, '');
	const workPath = join(WORKS_DIR, `${workId}.yaml`);
	if (!workId || !existsSync(workPath) || !Number.isInteger(Number(part.part))) continue;
	const title = t.partTitle(String(read(workPath).title ?? '').trim(), Number(part.part));
	// Pages CMS's select field only accepts the part number as text ("2"), so one typed as a number is rewritten.
	if (part.title === title && typeof part.part === 'string') continue;
	part.title = title;
	part.part = String(part.part);
	writeFileSync(path, yaml.dump(part, { lineWidth: -1, quotingType: '"' }));
	console.log(`name: ${fileName} -> ${title}`);
}
