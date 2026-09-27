import { existsSync } from 'node:fs';
import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

// getCollection without entries whose file is gone. When the last file of a folder is deleted, Astro keeps the
// entries from its cache (node_modules/.astro, which Cloudflare keeps between builds if build caching is on).
export async function getEntries<C extends CollectionKey>(collection: C): Promise<CollectionEntry<C>[]> {
	const entries = await getCollection(collection);
	return entries.filter((entry) => !entry.filePath || existsSync(entry.filePath));
}
