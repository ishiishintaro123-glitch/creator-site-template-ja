import type { ImageMetadata } from 'astro';
import { t } from '../site-config.mjs';

// Every usable image, keyed by its path in the repository ("/src/content/media/..."). Astro optimizes these at build time.
// Looking paths up here (instead of reading whatever path a content file names) also means only files in this folder can be used.
const images = import.meta.glob<ImageMetadata>('/src/content/media/**/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
	eager: true,
	import: 'default',
});

/** Finds an image saved by Pages CMS (e.g. "src/content/media/xxx.png"); `file` names the content file for error messages. */
export function resolveImage(path: string, file: string): ImageMetadata {
	const key = `/${path.trim().replace(/^\/+/, '')}`;
	if (!/\.(png|jpe?g|webp)$/i.test(key)) throw new Error(t.imageTypeNotSupported(path, file));
	const image = images[key];
	if (!image) throw new Error(t.imageNotFound(path, file));
	return image;
}

const pathsByImage = new Map(Object.entries(images).map(([key, image]) => [image, key.slice(1)]));

/** The repository path ("src/content/media/...") of an image returned by `resolveImage`. */
export function imagePath(image: ImageMetadata): string {
	const path = pathsByImage.get(image);
	if (!path) throw new Error(`Not an image from src/content/media: ${image.src}`);
	return path;
}
