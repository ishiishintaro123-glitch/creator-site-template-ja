import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { siteConfig } from '../site-config.mjs';
import { getIllustrations } from './illustrations';
import { getManga } from './manga';
import { imagePath, resolveImage } from './media';
import { getWorks } from './novels';

// X's large card and most other networks show 1.91:1.
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
// Images at least this wide for their height are used as they are; narrower ones (covers, manga pages) would be
// cut to a strip across the middle, so they get a card of their own: the whole image centered on a blurred copy of itself.
const MIN_LANDSCAPE_RATIO = 1.6;
const CARD_PADDING = 24;

/** The site-wide share image from site.config.yaml, if one is set. */
export function getSiteShareImage(): ImageMetadata | undefined {
	return siteConfig.shareImage ? resolveImage(siteConfig.shareImage, 'site.config.yaml') : undefined;
}

function needsCard(image: ImageMetadata) {
	return image.width / image.height < MIN_LANDSCAPE_RATIO;
}

function cardName(path: string) {
	return createHash('sha256').update(path).digest('hex').slice(0, 16);
}

let cache: Promise<Map<string, string>> | undefined;

/** Every image a page may use for its share card that needs a card made: card name → repository path. */
export function getCardSources(): Promise<Map<string, string>> {
	cache ??= (async () => {
		const [novels, manga, illustrations] = await Promise.all([getWorks(), getManga(), getIllustrations()]);
		const candidates = [
			getSiteShareImage(),
			...novels.map((work) => work.cover),
			...manga.flatMap((work) => [work.cover, ...work.episodes.map((episode) => episode.pages[0])]),
			...illustrations.map((illustration) => illustration.images[0]),
		];
		const paths = candidates.filter((image) => image && needsCard(image)).map((image) => imagePath(image!));
		return new Map(paths.map((path) => [cardName(path), path]));
	})();
	return cache;
}

/** Absolute URL of the share card image for a page's image. */
export async function getShareImageUrl(image: ImageMetadata): Promise<string> {
	if (!needsCard(image)) {
		// JPEG: every social network reads it.
		const { src } = await getImage({ src: image, width: CARD_WIDTH, format: 'jpeg' });
		return new URL(src, siteConfig.url).toString();
	}
	const name = cardName(imagePath(image));
	// A page passing an image not listed in getCardSources would link to a card that is never made.
	if (!(await getCardSources()).has(name)) throw new Error(`No share card is made for ${imagePath(image)}; add it to getCardSources()`);
	return new URL(`/share/${name}.jpg`, siteConfig.url).toString();
}

/** Makes a 1200×630 card: the whole image, centered on a blurred and darkened copy of itself. */
export async function renderCard(path: string): Promise<Buffer> {
	const source = readFileSync(resolve(process.cwd(), path));
	const background = await sharp(source)
		.rotate()
		.resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover' })
		.flatten({ background: '#1c1b1a' })
		.blur(30)
		.modulate({ brightness: 0.6 })
		.toBuffer();
	const foreground = await sharp(source)
		.rotate()
		.resize(CARD_WIDTH - CARD_PADDING * 2, CARD_HEIGHT - CARD_PADDING * 2, { fit: 'inside' })
		.toBuffer();
	return sharp(background).composite([{ input: foreground, gravity: 'center' }]).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}
