// Writes every tag the works use, and the tags prepared in advance (src/content/tags.yaml), into the tag choices of
// Pages CMS (.pages.yml), so a tag typed in once under "New tags" can be picked on any work after that. Pages CMS's select field only offers a fixed list, hence this.
// Run by .github/workflows/content.yml after each push; the lines it rewrites end in "# auto: scripts/update-tag-choices.mjs".
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const COLLECTIONS = ['novels', 'manga', 'illustrations'];
const TAGS_FILE = 'src/content/tags.yaml';
const CONFIG_FILES = ['.pages.yml', '.pages.en.yml']; // .pages.en.yml is only in this repository, not the template
const CHOICES_LINE = /^(\s*values: ).*( # auto: scripts\/update-tag-choices\.mjs)$/gm;

// Same as tagKey in src/lib/tags.ts: tags differing only in full/half-width, letter case or spaces are one tag.
const tagKey = (tag) => tag.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const list = (value) => (Array.isArray(value) ? value : []);

const load = (file) => yaml.load(readFileSync(file, 'utf8'), { schema: yaml.CORE_SCHEMA }) ?? {};

// Most used first, so the usual tags are at the top of the list; prepared tags no work uses yet come last.
const byKey = new Map();
function add(tags, uses) {
	for (const tag of tags) {
		if (typeof tag !== 'string') continue;
		const key = tagKey(tag);
		if (!key) continue;
		const entry = byKey.get(key) ?? { name: tag.trim(), count: 0 };
		entry.count += uses;
		byKey.set(key, entry);
	}
}
for (const collection of COLLECTIONS) {
	const dir = join('src/content', collection);
	if (!existsSync(dir)) continue;
	for (const name of readdirSync(dir).filter((name) => name.endsWith('.yaml'))) {
		const data = load(join(dir, name));
		add([...list(data.tags), ...list(data.newTags)], 1);
	}
}
if (existsSync(TAGS_FILE)) add(list(load(TAGS_FILE).tags), 0);
const choices = [...byKey.values()]
	.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
	.map((entry) => entry.name);

// JSON is valid YAML, and keeps quotes and other symbols in a tag from breaking the file.
const values = JSON.stringify(choices);
for (const file of CONFIG_FILES) {
	if (!existsSync(file)) continue;
	const before = readFileSync(file, 'utf8');
	const after = before.replace(CHOICES_LINE, (_, start, end) => `${start}${values}${end}`);
	if (after !== before) writeFileSync(file, after);
}
