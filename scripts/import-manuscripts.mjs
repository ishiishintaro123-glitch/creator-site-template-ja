// Moves manuscript files uploaded through Pages CMS into their work's episode list.
//
// In Pages CMS a creator selects several .md/.txt files in a work's "取り込み" field. They are uploaded to
// src/content/import/ and their paths are saved in that work's `import` list. This script (run by the deploy
// workflow before building, or locally with `npm run import`) appends one episode per file, in file-name order,
// then clears `import` and deletes the files, so the text can be edited in Pages CMS like any other episode.
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join, normalize } from 'node:path';
import yaml from 'js-yaml';
import { siteConfig } from '../src/site-config.mjs';
import { parseSiteDate, toSiteDateString } from '../src/lib/dates.mjs';

const WORKS_DIR = 'src/content/novels';
const IMPORT_DIR = 'src/content/import';

// "第2話.md" before "第10話.md": compare the numbers in file names as numbers.
const byFileName = new Intl.Collator(siteConfig.language, { numeric: true }).compare;

// Obsidian and most editors save UTF-8; older Windows editors may save Shift_JIS.
function decode(buffer) {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
	} catch {
		return new TextDecoder('shift_jis').decode(buffer);
	}
}

// Dates and times on the creator's clock, in the form Pages CMS saves ("2026-09-27T18:00").
function now() {
	return toSiteDateString(new Date(), siteConfig.timeZone);
}

function toDateString(value) {
	const date = parseSiteDate(value, siteConfig.timeZone);
	return date ? toSiteDateString(date, siteConfig.timeZone) : null;
}

// Turns one manuscript file into an episode. The title comes from front matter or a leading "# 見出し" line,
// the date and time from front matter (publishedAt or date), otherwise now.
function toEpisode(text) {
	let body = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
	let meta = {};

	// Front matter, e.g. Obsidian properties. It is metadata, not part of the story.
	const frontMatter = body.match(/^---\n([\s\S]*?)\n---\n?/);
	if (frontMatter) {
		try {
			meta = yaml.load(frontMatter[1]) ?? {};
		} catch {
			meta = {};
		}
		body = body.slice(frontMatter[0].length);
	}

	let title = typeof meta.title === 'string' ? meta.title.trim() : '';
	const heading = body.match(/^\s*# +(.+)\n*/);
	if (heading) {
		if (!title) title = heading[1].trim();
		body = body.slice(heading[0].length);
	}

	body = body.replace(/\s+$/, '').replace(/^\n+/, '');
	const episode = {};
	if (title) episode.title = title;
	episode.publishedAt = toDateString(meta.publishedAt) ?? toDateString(meta.date) ?? now();
	episode.body = body;
	return episode;
}

// Only files inside src/content/import/ may be read or deleted, whatever path ends up in a work file.
function resolveImportPath(path) {
	const normalized = normalize(String(path).replace(/^\/+/, ''));
	if (!normalized.startsWith(`${IMPORT_DIR}/`) || normalized.includes('..')) return null;
	return normalized;
}

let importedTotal = 0;

for (const fileName of readdirSync(WORKS_DIR).filter((name) => name.endsWith('.yaml'))) {
	const workPath = join(WORKS_DIR, fileName);
	// CORE_SCHEMA keeps dates such as 2026-09-22 as plain strings, so they are written back exactly as Pages CMS
	// saved them (the default schema would turn them into timestamps that Pages CMS's date field can't read).
	const work = yaml.load(readFileSync(workPath, 'utf8'), { schema: yaml.CORE_SCHEMA }) ?? {};
	if (work.import == null) continue;

	const paths = (Array.isArray(work.import) ? work.import : [work.import])
		.map(resolveImportPath)
		.filter((path, index, all) => path && all.indexOf(path) === index)
		.sort((a, b) => byFileName(basename(a), basename(b)));
	if (paths.length === 0) continue; // An empty field saved by Pages CMS: nothing to do, and no need to rewrite the file.

	const episodes = [];
	for (const path of paths) {
		if (!existsSync(path)) {
			console.warn(`skip (file not found): ${path}`);
			continue;
		}
		const episode = toEpisode(decode(readFileSync(path)));
		if (episode.body) {
			episodes.push(episode);
			console.log(`import: ${path} -> ${fileName} (${episode.title || 'no title'}, ${episode.publishedAt})`);
		} else {
			console.warn(`skip (empty): ${path}`);
		}
	}

	work.episodes = [...(Array.isArray(work.episodes) ? work.episodes : []), ...episodes];
	delete work.import;
	writeFileSync(workPath, yaml.dump(work, { lineWidth: -1, quotingType: '"' }));
	for (const path of paths) if (existsSync(path)) unlinkSync(path);
	importedTotal += episodes.length;
}

// Files uploaded but never attached to a work (e.g. the work was not saved) are left alone.
const leftovers = existsSync(IMPORT_DIR) ? readdirSync(IMPORT_DIR).filter((name) => !name.startsWith('.')) : [];
if (leftovers.length > 0) console.log(`not attached to any work, left in ${IMPORT_DIR}: ${leftovers.join(', ')}`);
console.log(`imported ${importedTotal} episode(s)`);
