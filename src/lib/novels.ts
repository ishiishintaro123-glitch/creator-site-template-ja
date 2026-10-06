import type { ImageMetadata } from 'astro';
import { statSync } from 'node:fs';
import type { CollectionEntry } from 'astro:content';
import { getEntries } from './content';
import { markdownToHtml } from 'satteri';
import { lineBreaks } from '../markdown/line-breaks.mjs';
import { safeContent } from '../markdown/safe-content.mjs';
import { urlLinks } from '../markdown/url-links.mjs';
import { t } from '../site-config.mjs';
import { resolveImage } from './media';
import { releasedEpisodes } from './dates.mjs';

export interface Episode {
	id: string;
	number: number;
	/** Optional episode subtitle; empty string when not set. */
	title: string;
	publishedAt: Date;
	html: string;
}

export interface Work {
	slug: string;
	title: string;
	synopsis: string;
	tags: string[];
	/** Marked finished, with every episode out (a scheduled last episode keeps it unfinished until then). */
	completed: boolean;
	cover?: ImageMetadata;
	episodes: Episode[];
	/** Chapter headings in the table of contents, each from its first episode on; empty when the work has none. */
	chapters: Chapter[];
	latestPublishedAt: Date;
}

export interface Chapter {
	title: string;
	/** Number of the chapter's first episode. */
	start: number;
}

// Pages CMS reads files through GitHub's contents API, which only returns files up to 1 MB.
// Stop a little before that so the creator can still open the work in Pages CMS to split it.
const MAX_WORK_FILE_BYTES = 900 * 1024;

// Same Markdown pipeline as the site's own pages (astro.config.mjs), including smart punctuation, which Astro enables by default.
async function renderEpisode(body: string) {
	const { html } = await markdownToHtml(body, { mdastPlugins: [safeContent, urlLinks, lineBreaks], features: { smartPunctuation: true } });
	// Links to other sites (store pages after a work, etc.) open in a new tab, so the reader keeps their place.
	// No noreferrer: the store can still see visits came from this site (only its address is sent; see Referrer-Policy).
	// HTML typed into the text is escaped (safe-content.mjs), so every <a in the output is a Markdown link.
	return html.replace(/<a href="(https?:\/\/[^"]*)"/g, '<a href="$1" target="_blank" rel="noopener"');
}

// The work ID a part's `work` names. Pages CMS saves the file's path; the bare ID is accepted too.
function workIdOf(value: string) {
	return value.replace(/^.*\//, '').replace(/\.yaml$/, '');
}

function checkFile(entry: CollectionEntry<'novels' | 'novelParts'>, file: string, title: string) {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) throw new Error(t.workIdInvalid(file));
	if (entry.filePath && statSync(entry.filePath).size > MAX_WORK_FILE_BYTES) throw new Error(t.workTooLarge(title, file));
}

// A work too long for one file (see MAX_WORK_FILE_BYTES) goes on in parts (src/content/novel-parts/), each naming
// its work and part number. They are shown as one work under the work's ID and settings, numbered straight through.
async function partsByWork(works: CollectionEntry<'novels'>[]) {
	const titles = new Map(works.map((work) => [work.id, work.data.title]));
	const byWork = new Map<string, CollectionEntry<'novelParts'>[]>();
	for (const entry of await getEntries('novelParts')) {
		const file = `src/content/novel-parts/${entry.id}.yaml`;
		const workId = workIdOf(entry.data.work);
		const title = titles.get(workId);
		if (title === undefined) throw new Error(t.partWorkNotFound(file));
		checkFile(entry, file, t.partTitle(title, entry.data.part));
		const parts = byWork.get(workId) ?? [];
		const same = parts.find((part) => part.data.part === entry.data.part);
		if (same) throw new Error(t.partNumberTaken(title, entry.data.part, `src/content/novel-parts/${same.id}.yaml`, file));
		byWork.set(workId, [...parts, entry]);
	}
	for (const parts of byWork.values()) parts.sort((a, b) => a.data.part - b.data.part);
	return byWork;
}

// A part with a chapter heading starts a chapter at its first episode; one without carries on the previous chapter,
// so a part made only because the file grew too large changes nothing. Chapters with no released episode yet are left out.
function chaptersOf(parts: CollectionEntry<'novels' | 'novelParts'>[], released: number): Chapter[] {
	const chapters: Chapter[] = [];
	let start = 1;
	for (const part of parts) {
		if (part.data.chapter && part.data.episodes.length > 0 && start <= released) chapters.push({ title: part.data.chapter, start });
		start += part.data.episodes.length;
	}
	return chapters;
}

// Works (src/content/novels/<slug>.yaml) with their episodes, newest-updated work first.
// Mistakes a creator can make fail the build with a message saying what to fix.
async function load(): Promise<Work[]> {
	const entries = await getEntries('novels');
	for (const entry of entries) checkFile(entry, `src/content/novels/${entry.id}.yaml`, entry.data.title);
	const laterParts = await partsByWork(entries);

	const works = await Promise.all(
		entries.map(async (entry) => {
			const file = `src/content/novels/${entry.id}.yaml`;
			// Released episodes stop at the first scheduled one across all parts, so numbers never shift.
			const parts = [entry, ...(laterParts.get(entry.id) ?? [])];
			const all = parts.flatMap((part) => part.data.episodes);
			const episodes = await Promise.all(
				releasedEpisodes(all).map(async (episode, index) => ({
					id: `${entry.id}/${index + 1}`,
					number: index + 1,
					title: episode.title,
					publishedAt: episode.publishedAt,
					html: await renderEpisode(episode.body),
				})),
			);
			return {
				slug: entry.id,
				title: entry.data.title,
				synopsis: entry.data.synopsis,
				tags: entry.data.tags,
				completed: entry.data.completed && episodes.length === all.length,
				cover: entry.data.cover ? resolveImage(entry.data.cover, file) : undefined,
				episodes,
				chapters: chaptersOf(parts, episodes.length),
				latestPublishedAt: new Date(Math.max(0, ...episodes.map((episode) => episode.publishedAt.valueOf()))),
			};
		}),
	);

	return works
		.filter((work) => work.episodes.length > 0) // A work with no episodes yet stays hidden until its first one is added.
		.sort((a, b) => b.latestPublishedAt.valueOf() - a.latestPublishedAt.valueOf());
}

let cache: Promise<Work[]> | undefined;

// Every page needs this data (the header shows which genres have works), so load and render it once per build.
export function getWorks(): Promise<Work[]> {
	cache ??= load();
	return cache;
}
