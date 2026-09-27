// site.config.yaml を読み込んで検証する。astro.config.mjs と各ページの両方から使う。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { LANGUAGES, getStrings } from './i18n/strings.mjs';
import { isTimeZone } from './lib/dates.mjs';

const CONFIG_FILE = 'site.config.yaml';

// Where ads can go. Spots that hurt reading (above/inside the text, sticky overlays, interstitials) are deliberately not offered.
const AD_SLOTS = ['afterEpisode', 'sidebar', 'sidebarLeft', 'workToc', 'listFeed'];
const adCode = z.string().nullish().transform((value) => (value ?? '').trim());

// Error messages follow the site's language, so the schema is built once the language is known.
function buildSchema(t) {
	const required = (label) => z.string({ error: t.notSet(label) }).trim().min(1, t.notSet(label));

	return z.object({
		language: z.enum(LANGUAGES),
		siteName: required(t.labelSiteName),
		author: required(t.labelAuthor),
		description: required(t.labelDescription),
		url: required(t.labelUrl).pipe(z.url({ protocol: /^https?$/, error: t.urlMustBeHttp })),
		shareImage: z
			.string()
			.trim()
			.nullish()
			.transform((value) => value ?? ''),
		xAccount: z
			.string()
			.trim()
			.transform((value) => value.replace(/^@/, ''))
			.refine((value) => value === '' || /^[A-Za-z0-9_]{1,15}$/.test(value), { error: t.xAccountInvalid })
			.nullish()
			.transform((value) => value ?? ''),
		// The creator's clock, for publish dates and times (scheduled episodes). Defaults to the language's usual zone.
		timeZone: z
			.string()
			.trim()
			.nullish()
			.transform((value) => value || (t.htmlLang === 'ja' ? 'Asia/Tokyo' : 'UTC'))
			.refine(isTimeZone, { error: t.timeZoneInvalid }),
		// Asks AI crawlers to stay away (robots.txt) and drops llms.txt. Search engines are unaffected.
		blockAi: z.boolean({ error: t.blockAiInvalid }).nullish().transform((value) => value ?? false),
		profile: z
			.string({ error: t.profileInvalid })
			.trim()
			.nullish()
			.transform((value) => value ?? ''),
		links: z
			.array(
				z.object({
					// Optional text shown above the link, e.g. where to buy a book.
					note: z.string().trim().nullish().transform((value) => value ?? ''),
					// No longer shown (the row shows the address); kept optional so older files still load.
					label: z.string().trim().nullish().transform((value) => value ?? ''),
					// https only: rejects javascript: and other schemes that could run code when clicked.
					url: required(t.labelLinkUrl).pipe(z.url({ protocol: /^https$/, error: t.linkUrlMustBeHttps })),
				}),
				{ error: t.linksInvalid },
			)
			.nullish()
			.transform((value) => value ?? []),
		ads: z
			// The four ad codes sit in a group of their own (placements), shown as one heading in Pages CMS; files
			// from before that have them directly under ads. Either way they come out flat, as siteConfig.ads.<slot>.
			.preprocess((value) => {
				if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
				const { placements, ...rest } = value;
				return placements && typeof placements === 'object' && !Array.isArray(placements) ? { ...rest, ...placements } : rest;
			}, z
			.object(
				{
					provider: z.string().trim().nullish().transform((value) => value ?? ''),
					providerPrivacyUrl: z
						.string()
						.trim()
						.nullish()
						.transform((value) => value ?? '')
						.refine((value) => value === '' || /^https:\/\/\S+$/.test(value), { error: t.providerPrivacyUrlInvalid }),
					afterEpisode: adCode,
					sidebar: adCode,
					sidebarLeft: adCode,
					workToc: adCode,
					listFeed: adCode,
					adsTxt: z.string().nullish().transform((value) => (value ?? '').trim()),
				},
				{ error: t.adsInvalid },
			)
			.nullish())
			.transform((value) => (value && AD_SLOTS.some((slot) => value[slot]) ? value : null))
			.refine((value) => !value || value.provider !== '', { error: t.adsProviderRequired }),
	});
}

function loadSiteConfig() {
	let raw;
	try {
		// Resolved from the project root: import.meta.url points elsewhere once Astro bundles this module.
		raw = yaml.load(readFileSync(resolve(process.cwd(), CONFIG_FILE), 'utf8')) ?? {};
	} catch (error) {
		// The language is unknown until the file parses, so say it both ways.
		const message = LANGUAGES.map((language) => getStrings(language).configReadError(CONFIG_FILE, error.message)).join('\n');
		throw new Error(message);
	}
	// Sites made before the language setting existed are Japanese.
	const language = raw.language ?? 'ja';
	if (!LANGUAGES.includes(language)) {
		// An unknown language can't pick the message language either, so say it both ways.
		throw new Error(LANGUAGES.map((l) => `${getStrings(l).configInvalid(CONFIG_FILE)}\n- ${getStrings(l).languageInvalid}`).join('\n'));
	}
	const t = getStrings(language);
	const result = buildSchema(t).safeParse({ ...raw, language });
	if (!result.success) {
		const messages = result.error.issues.map((issue) => `- ${issue.message}`).join('\n');
		throw new Error(`${t.configInvalid(CONFIG_FILE)}\n${messages}`);
	}
	return { ...result.data, url: result.data.url.replace(/\/+$/, '') };
}

export const siteConfig = loadSiteConfig();

/** The site's UI text and messages, in the language set in site.config.yaml. */
export const t = getStrings(siteConfig.language);
