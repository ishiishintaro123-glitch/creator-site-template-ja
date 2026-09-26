import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';
import { t } from '../site-config.mjs';
import { resolveImage } from './media';
import { isReleased } from './dates.mjs';
import { formatDate } from './format-date';

export interface Illustration {
	slug: string;
	/** Empty when the creator gave no title; use `label` wherever some text is needed. */
	title: string;
	/** The title, or a date-based stand-in such as 「イラスト（2026年9月24日）」. */
	label: string;
	description: string;
	tags: string[];
	images: ImageMetadata[];
	publishedAt: Date;
}

// Illustrations (src/content/illustrations/<slug>.yaml), newest first.
async function load(): Promise<Illustration[]> {
	const entries = await getCollection('illustrations');
	return entries
		.filter((entry) => isReleased(entry.data.publishedAt)) // Scheduled for later: hidden until then.
		.map((entry) => {
			const file = `src/content/illustrations/${entry.id}.yaml`;
			if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) throw new Error(t.workIdInvalid(file));
			return {
				slug: entry.id,
				title: entry.data.title,
				label: entry.data.title || t.untitledIllustration(formatDate(entry.data.publishedAt)),
				description: entry.data.description,
				tags: entry.data.tags,
				images: entry.data.images.map((image) => resolveImage(image, file)),
				publishedAt: entry.data.publishedAt,
			};
		})
		.sort((a, b) => b.publishedAt.valueOf() - a.publishedAt.valueOf());
}

let cache: Promise<Illustration[]> | undefined;

// Every page needs this data (the header shows which genres have works), so load and render it once per build.
export function getIllustrations(): Promise<Illustration[]> {
	cache ??= load();
	return cache;
}
