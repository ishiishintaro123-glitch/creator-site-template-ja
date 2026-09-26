import { getIllustrations, type Illustration } from './illustrations';
import { getManga, type Manga } from './manga';
import { getWorks, type Work } from './novels';

export type Genre = 'novels' | 'manga' | 'illustrations';

/** Genres that have at least one published work, in menu order. The genre tabs only appear when there are two or more. */
export async function getGenres(): Promise<Genre[]> {
	const [novels, manga, illustrations] = await Promise.all([getWorks(), getManga(), getIllustrations()]);
	const genres: Genre[] = [];
	if (novels.length > 0) genres.push('novels');
	if (manga.length > 0) genres.push('manga');
	if (illustrations.length > 0) genres.push('illustrations');
	return genres;
}

export type ListItem =
	| { kind: 'novel'; date: Date; tags: string[]; work: Work }
	| { kind: 'manga'; date: Date; tags: string[]; work: Manga }
	| { kind: 'illustration'; date: Date; tags: string[]; illustration: Illustration };

/** Every published work of every genre, most recently updated first (the all-works list and tag pages). */
export async function getAllItems(): Promise<ListItem[]> {
	const [novels, manga, illustrations] = await Promise.all([getWorks(), getManga(), getIllustrations()]);
	const items: ListItem[] = [
		...novels.map((work) => ({ kind: 'novel' as const, date: work.latestPublishedAt, tags: work.tags, work })),
		...manga.map((work) => ({ kind: 'manga' as const, date: work.latestPublishedAt, tags: work.tags, work })),
		...illustrations.map((illustration) => ({
			kind: 'illustration' as const,
			date: illustration.publishedAt,
			tags: illustration.tags,
			illustration,
		})),
	];
	return items.sort((a, b) => b.date.valueOf() - a.date.valueOf());
}
