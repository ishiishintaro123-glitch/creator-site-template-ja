import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { siteConfig, t } from './site-config.mjs';
import { parseSiteDate } from './lib/dates.mjs';

const optionalText = z.string().trim().nullish().transform((value) => value ?? '');
const tags = z.array(z.string()).nullish().transform((value) => value ?? []);
const completed = z.boolean().nullish().transform((value) => value ?? false);
// Publish date and time on the creator's clock (see src/lib/dates.mjs). A future one keeps the work or episode hidden
// until then (scheduled publishing; .github/workflows/scheduled-publish.yml rebuilds the site when the time comes).
const dateOn = (message: string) =>
	z.any().transform((value, context) => {
		const date = parseSiteDate(value, siteConfig.timeZone);
		if (!date) {
			context.addIssue({ code: 'custom', message });
			return z.NEVER;
		}
		return date;
	});
const date = dateOn(t.dateInvalid);
// Image paths as saved by Pages CMS (src/content/media/...); they are checked against the actual files in src/lib/media.ts.
const imagePath = z.string().trim().min(1);
// Pages CMS saves one file as a string and several as a list; accept both.
const imageList = (message: string) =>
	z.preprocess((value) => (typeof value === 'string' ? [value] : value), z.array(imagePath, { error: message }).min(1, message));

const novelEpisodes = z
	.array(
		z.object({
			title: optionalText, // Optional episode subtitle
			publishedAt: dateOn(t.episodeDateInvalid),
			body: z.string({ error: t.episodeBodyNotSet }).trim().min(1, t.episodeBodyNotSet),
		}),
	)
	.nullish()
	.transform((value) => value ?? []);

// Novels: one file per work with the work info and every episode: src/content/novels/<作品ID>.yaml
// Episode numbers follow the order of the `episodes` list.
const novels = defineCollection({
	loader: glob({ pattern: '*.yaml', base: './src/content/novels' }),
	schema: z.object({
		title: z.string({ error: t.workTitleNotSet }).trim().min(1, t.workTitleNotSet),
		synopsis: z.string({ error: t.workSynopsisNotSet }).trim().min(1, t.workSynopsisNotSet),
		cover: imagePath.nullish(), // Optional; without one, share cards use the site-wide image
		completed, // Ticked when the work is finished
		tags,
		episodes: novelEpisodes,
	}),
});

// Later parts of a novel too long for one file (Part 2, 3, ...): src/content/novel-parts/<ID>.yaml
// Only the episodes; the work's settings stay in its first part. src/lib/novels.ts joins them to the work.
const novelParts = defineCollection({
	loader: glob({ pattern: '*.yaml', base: './src/content/novel-parts' }),
	schema: z.object({
		title: optionalText, // Only tells the parts apart in Pages CMS; filled in by scripts/name-novel-parts.mjs
		work: z.string({ error: t.partWorkNotSet }).trim().min(1, t.partWorkNotSet), // As Pages CMS saves it: src/content/novels/<作品ID>.yaml
		part: z.coerce.number({ error: t.partNumberInvalid }).int(t.partNumberInvalid).min(2, t.partNumberInvalid),
		episodes: novelEpisodes,
	}),
});

// Manga: same shape as novels, but each episode is a list of page images read top to bottom.
const manga = defineCollection({
	loader: glob({ pattern: '*.yaml', base: './src/content/manga' }),
	schema: z.object({
		title: z.string({ error: t.workTitleNotSet }).trim().min(1, t.workTitleNotSet),
		synopsis: optionalText,
		cover: imagePath.nullish(), // Defaults to the first page of the first episode
		completed,
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

export const collections = { novels, novelParts, manga, illustrations };
