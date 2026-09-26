import { genreOfItem, getAllItems, getGenres, type Genre, type ListItem } from './catalog';

export interface Tag {
	/** URL segment: /tags/<slug> */
	slug: string;
	/** As first written on the newest work that uses it. */
	name: string;
	items: ListItem[];
	/** Genres with works that have this tag, in menu order. */
	genres: Genre[];
}

/** Which works a tag link lists: every genre (the all-works list), or one genre (that genre's list and its works). */
export type TagScope = Genre | 'all';

// Tags count as the same when they differ only in full/half-width, letter case or spaces
// (「ﾌｧﾝﾀｼﾞｰ」and「ファンタジー」, "Fantasy" and "fantasy ").
function tagKey(tag: string) {
	return tag.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Letters and numbers of any language stay readable in the URL; everything else (symbols with a meaning in URLs or
// file names, spaces, control characters) becomes a hyphen.
// Cut short so the file name stays well under the 255-byte limit (Japanese is 3 bytes a character).
function baseSlug(key: string) {
	const slug = key
		.replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
		.replace(/-+$/, '');
	return slug || 'tag';
}

/** A work's tags without empty or repeated ones, in the order written. */
export function cleanTags(tags: string[]): string[] {
	const seen = new Set<string>();
	return tags.filter((tag) => {
		const key = tagKey(tag);
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

async function load() {
	const byKey = new Map<string, Tag>();
	for (const item of await getAllItems()) {
		for (const name of cleanTags(item.tags)) {
			const key = tagKey(name);
			const tag = byKey.get(key) ?? { slug: '', name: name.trim(), items: [], genres: [] };
			tag.items.push(item);
			byKey.set(key, tag);
		}
	}
	const genreOrder = await getGenres();
	for (const tag of byKey.values()) {
		const present = new Set(tag.items.map(genreOfItem));
		tag.genres = genreOrder.filter((genre) => present.has(genre));
	}
	// Slugs are handed out in a fixed order so a tag keeps its URL when works are added in between.
	const used = new Set<string>();
	for (const key of [...byKey.keys()].sort()) {
		const base = baseSlug(key);
		let slug = base;
		for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
		used.add(slug);
		byKey.get(key)!.slug = slug;
	}
	return byKey;
}

let cache: ReturnType<typeof load> | undefined;

function getTagMap() {
	cache ??= load();
	return cache;
}

export async function getTags(): Promise<Tag[]> {
	return [...(await getTagMap()).values()];
}

/** The all-genre list only exists on sites with two or more genres; with one, it would be the genre's list again. */
export async function hasAllGenreTagPages() {
	return (await getGenres()).length >= 2;
}

export function tagPath(tag: Tag, scope: TagScope) {
	return scope === 'all' ? `/tags/${tag.slug}` : `/tags/${tag.slug}/${scope}`;
}

/** Link for a tag, or undefined for one no published work uses (a work without episodes yet). */
export async function tagHref(name: string, scope: TagScope): Promise<string | undefined> {
	const tag = (await getTagMap()).get(tagKey(name));
	if (!tag) return undefined;
	if (scope === 'all' && !(await hasAllGenreTagPages())) return tagPath(tag, tag.genres[0]);
	return tagPath(tag, scope);
}

/** Every tag list a work of this genre appears in (for the back link; see public/back-links.js). */
export async function tagListPaths(names: string[], genre: Genre): Promise<string[]> {
	const hrefs = await Promise.all(cleanTags(names).flatMap((name) => [tagHref(name, 'all'), tagHref(name, genre)]));
	return [...new Set(hrefs.filter((href): href is string => !!href))];
}
