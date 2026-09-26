import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';
import { t } from '../site-config.mjs';
import { resolveImage } from './media';
import { releasedEpisodes } from './dates.mjs';

export interface MangaEpisode {
	id: string;
	number: number;
	title: string;
	publishedAt: Date;
	pages: ImageMetadata[];
}

export interface Manga {
	slug: string;
	title: string;
	synopsis: string;
	tags: string[];
	/** Marked finished, with every episode out (a scheduled last episode keeps it unfinished until then). */
	completed: boolean;
	cover: ImageMetadata;
	episodes: MangaEpisode[];
	latestPublishedAt: Date;
}

// Manga (src/content/manga/<slug>.yaml) with their episodes, newest-updated first. Works with no episodes stay hidden.
async function load(): Promise<Manga[]> {
	const entries = await getCollection('manga');
	return entries
		.map((entry) => {
			const file = `src/content/manga/${entry.id}.yaml`;
			if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) throw new Error(t.workIdInvalid(file));
			const episodes = releasedEpisodes(entry.data.episodes).map((episode, index) => ({
				id: `${entry.id}/${index + 1}`,
				number: index + 1,
				title: episode.title,
				publishedAt: episode.publishedAt,
				pages: episode.pages.map((page) => resolveImage(page, file)),
			}));
			if (episodes.length === 0) return null;
			return {
				slug: entry.id,
				title: entry.data.title,
				synopsis: entry.data.synopsis,
				tags: entry.data.tags,
				completed: entry.data.completed && episodes.length === entry.data.episodes.length,
				cover: entry.data.cover ? resolveImage(entry.data.cover, file) : episodes[0].pages[0],
				episodes,
				latestPublishedAt: new Date(Math.max(...episodes.map((episode) => episode.publishedAt.valueOf()))),
			};
		})
		.filter((work): work is Manga => work !== null)
		.sort((a, b) => b.latestPublishedAt.valueOf() - a.latestPublishedAt.valueOf());
}

let cache: Promise<Manga[]> | undefined;

// Every page needs this data (the header shows which genres have works), so load and render it once per build.
export function getManga(): Promise<Manga[]> {
	cache ??= load();
	return cache;
}
