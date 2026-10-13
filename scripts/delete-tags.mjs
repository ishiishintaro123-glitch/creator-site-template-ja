// Takes the tags chosen under "削除するタグ" in Pages CMS (src/content/tags.yaml) off every work and off the tags
// prepared in advance there, then empties that list again. Run by .github/workflows/content.yml before the tag
// choices are rewritten, so deleted tags also leave the choices.
// Files are edited line by line, not loaded and written back as a whole, so the rest of each file stays as saved.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const TAGS_FILE = 'src/content/tags.yaml';
const COLLECTIONS = ['novels', 'manga', 'illustrations'];

// Same as tagKey in src/lib/tags.ts: tags differing only in full/half-width, letter case or spaces are one tag.
const tagKey = (tag) => String(tag).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const load = (text) => yaml.load(text, { schema: yaml.CORE_SCHEMA });

if (!existsSync(TAGS_FILE)) process.exit(0);
const settings = load(readFileSync(TAGS_FILE, 'utf8')) ?? {};
const remove = new Set((Array.isArray(settings.deleteTags) ? settings.deleteTags : []).map(tagKey).filter(Boolean));
if (remove.size === 0) process.exit(0);

const kept = (items) => items.filter((item) => typeof item !== 'string' || !remove.has(tagKey(item)));

// Rewrites the top-level lists named in edits (key → items → new items) in a YAML file, leaving other lines as they are.
function editLists(file, edits) {
	const lines = readFileSync(file, 'utf8').split('\n');
	const out = [];
	// The list being read: its key, where its first line went in out, and its items so far.
	let list = null;
	const close = () => {
		if (!list) return;
		const items = edits[list.key](list.items.map((item) => item.value));
		if (items.length === 0) out[list.at] = `${list.key}: []`;
		else for (const item of list.items) if (items.includes(item.value)) out.push(item.line);
		list = null;
	};
	for (const line of lines) {
		if (list) {
			const item = line.match(/^\s+-\s(.*)$/);
			if (item) {
				list.items.push({ line, value: load(item[1]) });
				continue;
			}
			close();
		}
		const key = line.match(/^([A-Za-z]+):(.*)$/);
		if (key && edits[key[1]]) {
			const rest = key[2].trim();
			if (rest === '') {
				list = { key: key[1], at: out.length, items: [] };
				out.push(line);
				continue;
			}
			// A list written on one line (tags: [a, b]) is rewritten on one line.
			const items = load(rest);
			out.push(Array.isArray(items) ? `${key[1]}: ${JSON.stringify(edits[key[1]](items))}` : line);
			continue;
		}
		out.push(line);
	}
	close();
	const after = out.join('\n');
	if (after !== lines.join('\n')) writeFileSync(file, after);
}

for (const collection of COLLECTIONS) {
	const dir = join('src/content', collection);
	if (!existsSync(dir)) continue;
	for (const name of readdirSync(dir).filter((name) => name.endsWith('.yaml'))) {
		editLists(join(dir, name), { tags: kept, newTags: kept });
	}
}
editLists(TAGS_FILE, { tags: kept, deleteTags: () => [] });
