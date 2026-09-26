import { siteConfig, t } from '../site-config.mjs';

/** A publish date as the site shows it (「2026年9月27日」), on the creator's clock rather than the build server's. */
export const formatDate = new Intl.DateTimeFormat(t.dateLocale, {
	timeZone: siteConfig.timeZone,
	year: 'numeric',
	month: 'long',
	day: 'numeric',
}).format;
