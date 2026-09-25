import type { ImageMetadata } from 'astro';
import { statSync } from 'node:fs';
import { getCollection } from 'astro:content';
import { markdownToHtml } from 'satteri';
import { lineBreaks } from '../markdown/line-breaks.mjs';
import { safeContent } from '../markdown/safe-content.mjs';
import { urlLinks } from '../markdown/url-links.mjs';
import { t } from '../site-config.mjs';
import { resolveImage } from './media';

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
	cover?: ImageMetadata;
	episodes: Episode[];
	latestPublishedAt: Date;
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

// Works (src/content/novels/<slug>.yaml) with their episodes, newest-updated work first.
// Mistakes a creator can make fail the build with a message saying what to fix.
async function load(): Promise<Work[]> {
	const entries = await getCollection('novels');

	const works = await Promise.all(
		entries.map(async (entry) => {
			const file = `src/content/novels/${entry.id}.yaml`;
			if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) {
				throw new Error(t.workIdInvalid(file));
			}
			if (entry.filePath && statSync(entry.filePath).size > MAX_WORK_FILE_BYTES) {
				throw new Error(t.workTooLarge(entry.data.title, file));
			}
			const episodes = await Promise.all(
				entry.data.episodes.map(async (episode, index) => ({
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
				cover: entry.data.cover ? resolveImage(entry.data.cover, file) : undefined,
				episodes,
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
