import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { t } from './site-config.mjs';

const optionalText = z.string().trim().nullish().transform((value) => value ?? '');
const tags = z.array(z.string()).nullish().transform((value) => value ?? []);
const date = z.coerce.date({ error: t.dateInvalid });
// Image paths as saved by Pages CMS (src/content/media/...); they are checked against the actual files in src/lib/media.ts.
const imagePath = z.string().trim().min(1);
// Pages CMS saves one file as a string and several as a list; accept both.
const imageList = (message: string) =>
	z.preprocess((value) => (typeof value === 'string' ? [value] : value), z.array(imagePath, { error: message }).min(1, message));

// Novels: one file per work with the work info and every episode: src/content/novels/<作品ID>.yaml
// Episode numbers follow the order of the `episodes` list.
const novels = defineCollection({
	loader: glob({ pattern: '*.yaml', base: './src/content/novels' }),
	schema: z.object({
		title: z.string({ error: t.workTitleNotSet }).trim().min(1, t.workTitleNotSet),
		synopsis: z.string({ error: t.workSynopsisNotSet }).trim().min(1, t.workSynopsisNotSet),
		cover: imagePath.nullish(), // Optional; without one, share cards use the site-wide image
		tags,
		episodes: z
			.array(
				z.object({
					title: optionalText, // Optional episode subtitle
					publishedAt: z.coerce.date({ error: t.episodeDateInvalid }),
					body: z.string({ error: t.episodeBodyNotSet }).trim().min(1, t.episodeBodyNotSet),
				}),
			)
			.nullish()
			.transform((value) => value ?? []),
	}),
});

// Manga: same shape as novels, but each episode is a list of page images read top to bottom.
const manga = defineCollection({
	loader: glob({ pattern: '*.yaml', base: './src/content/manga' }),
	schema: z.object({
		title: z.string({ error: t.workTitleNotSet }).trim().min(1, t.workTitleNotSet),
		synopsis: optionalText,
		cover: imagePath.nullish(), // Defaults to the first page of the first episode
		tags,
		episodes: z
			.array(
				z.object({
					title: optionalText,
					publishedAt: date,
					pages: imageList(t.mangaPagesNotSet),
				}),
			)
			.nullish()
			.transform((value) => value ?? []),
	}),
});

// Illustrations: one post per file. Only the image is required.
const illustrations = defineCollection({
	loader: glob({ pattern: '*.yaml', base: './src/content/illustrations' }),
	schema: z.object({
		images: imageList(t.illustrationImagesNotSet),
		title: optionalText,
		description: optionalText,
		tags,
		publishedAt: date,
	}),
});

export const collections = { novels, manga, illustrations };
