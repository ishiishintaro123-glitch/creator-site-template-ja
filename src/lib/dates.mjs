// Publish dates as creators write them, on the site's clock (siteConfig.timeZone), not the build server's (UTC).
// Pages CMS saves "2026-09-27T18:00"; older files and hand-written ones may have just "2026-09-27" (midnight).
// Shared by the site build and scripts/ (the manuscript import and the scheduled-publish check).

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

// How far the time zone's clock is ahead of UTC at this moment, in milliseconds.
function offsetAt(ms, timeZone) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(new Date(ms));
	const get = (type) => Number(parts.find((part) => part.type === type).value);
	return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ms;
}

/** The moment a date written on the site's clock stands for, or null when it isn't a date. */
export function parseSiteDate(value, timeZone) {
	let fields;
	if (value instanceof Date) {
		// A YAML date without a time zone (2026-09-27) is read as UTC midnight; its UTC fields are what was written.
		if (Number.isNaN(value.valueOf())) return null;
		fields = [value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), value.getUTCHours(), value.getUTCMinutes()];
	} else if (typeof value === 'string') {
		const match = value.trim().match(PATTERN);
		if (!match) return null;
		const [, year, month, day, hour = '0', minute = '0'] = match;
		fields = [Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)];
	} else {
		return null;
	}
	const wall = Date.UTC(...fields);
	// Check the date is real (no 2026-02-30) before converting.
	const check = new Date(wall);
	if (check.getUTCMonth() !== fields[1] || check.getUTCDate() !== fields[2]) return null;
	// Twice, so a date near a daylight-saving change uses the offset in force at that time.
	const first = wall - offsetAt(wall, timeZone);
	return new Date(wall - offsetAt(first, timeZone));
}

/** "2026-09-27T18:00" for a moment, on the site's clock (the format Pages CMS saves). */
export function toSiteDateString(date, timeZone) {
	const shifted = new Date(date.valueOf() + offsetAt(date.valueOf(), timeZone));
	return shifted.toISOString().slice(0, 16);
}

/** True when the time zone name is one this system knows (e.g. Asia/Tokyo). */
export function isTimeZone(timeZone) {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
}

// Everything in one build is judged against the same moment.
const BUILD_TIME = new Date();

/** False for a date still to come (a scheduled post). */
export function isReleased(date) {
	return date.valueOf() <= BUILD_TIME.valueOf();
}

/**
 * A work's episodes up to the first one scheduled for later. Later episodes wait for it even if their own time has
 * come, so episode numbers and addresses never shift once published.
 */
export function releasedEpisodes(episodes) {
	const firstScheduled = episodes.findIndex((episode) => !isReleased(episode.publishedAt));
	return firstScheduled === -1 ? episodes : episodes.slice(0, firstScheduled);
}
