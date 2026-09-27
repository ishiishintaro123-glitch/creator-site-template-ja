// Deletes image files in the build output that no page or file refers to. Astro writes every image in
// src/content/media/ as it is (src/lib/media.ts imports them all so any can be looked up), next to the resized
// copies the pages actually use. The originals are never shown, yet each counts toward the Cloudflare Workers file
// limit (see scripts/check-site-size.mjs), and unused uploads would be published for nothing.
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const TEXT = /\.(html|css|js|mjs|json|xml|txt|webmanifest)$/i;

function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

export default function pruneImages() {
	return {
		name: 'prune-images',
		hooks: {
			'astro:build:done': ({ dir, logger }) => {
				const root = fileURLToPath(dir);
				const files = walk(root);
				const text = files.filter((path) => TEXT.test(path) || path.endsWith('_headers')).map((path) => readFileSync(path, 'utf8')).join('\n');
				// Only Astro's own output folder: files from public/ are there on purpose.
				const unused = files.filter((path) => path.startsWith(join(root, '_astro')) && IMAGE.test(path) && !text.includes(path.slice(path.lastIndexOf('/') + 1)));
				for (const path of unused) rmSync(path);
				logger.info(`removed ${unused.length} unreferenced image(s)`);
			},
		},
	};
}
