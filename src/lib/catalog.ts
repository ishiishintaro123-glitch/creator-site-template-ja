import { getIllustrations } from './illustrations';
import { getManga } from './manga';
import { getWorks } from './novels';

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
