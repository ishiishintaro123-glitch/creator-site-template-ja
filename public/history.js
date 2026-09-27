(function () {
	'use strict';

	var STORAGE_KEY = 'creator-site:reading-history';

	function loadHistory() {
		try {
			var raw = localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : {};
		} catch (e) {
			return {};
		}
	}

	function saveHistory(history) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
		} catch (e) {
			/* localStorage unavailable — history just won't persist */
		}
	}

	function recordVisit() {
		var marker = document.querySelector('[data-episode-marker]');
		if (!marker) return;
		var slug = marker.getAttribute('data-work-slug');
		var episode = parseInt(marker.getAttribute('data-episode'), 10);
		var episodeCount = parseInt(marker.getAttribute('data-episode-count'), 10) || 0;
		if (!slug || !episode) return;

		var history = loadHistory();
		var existing = history[slug];
		var read = readEpisodes(existing);
		if (read.indexOf(episode) === -1) read.push(episode);
		history[slug] = {
			lastEpisode: existing && existing.lastEpisode > episode ? existing.lastEpisode : episode,
			read: read,
			// How many episodes the work had when the reader first read it. Later ones are marked new until the
			// reader opens each of them (see isNew), so rereading an old episode doesn't clear the marks.
			knownEpisodes: (existing && existing.knownEpisodes) || episodeCount,
			updatedAt: Date.now(),
		};
		saveHistory(history);
	}

	// Entries saved before per-episode tracking only have lastEpisode; treat 1..lastEpisode as read.
	function readEpisodes(entry) {
		if (!entry) return [];
		if (Array.isArray(entry.read)) return entry.read.slice();
		var list = [];
		for (var i = 1; i <= entry.lastEpisode; i++) list.push(i);
		return list;
	}

	// An episode added after the reader started the work that they haven't opened yet. Entries saved before this
	// was tracked have no knownEpisodes: nothing is marked new until the next read.
	function isNew(entry, episode) {
		return !!(entry && entry.knownEpisodes && episode > entry.knownEpisodes && readEpisodes(entry).indexOf(episode) === -1);
	}

	function markReadEpisodes() {
		var rows = document.querySelectorAll('[data-toc-episode]');
		if (!rows.length) return;
		var history = loadHistory();
		rows.forEach(function (row) {
			var entry = history[row.getAttribute('data-work-slug')];
			var episode = parseInt(row.getAttribute('data-toc-episode'), 10);
			if (readEpisodes(entry).indexOf(episode) !== -1) row.classList.add('is-read');
			var mark = row.querySelector('[data-new-mark]');
			if (mark && isNew(entry, episode)) mark.hidden = false;
		});
	}

	function applyToListing() {
		var cards = document.querySelectorAll('[data-work-slug]');
		if (!cards.length) return;
		var history = loadHistory();

		cards.forEach(function (card) {
			var slug = card.getAttribute('data-work-slug');
			var entry = history[slug];
			if (!entry) return;

			var episodeCount = parseInt(card.getAttribute('data-episode-count'), 10);
			var baseHref = card.getAttribute('data-base-href');
			var lastEpisode = Math.min(entry.lastEpisode, episodeCount);
			var caughtUp = lastEpisode >= episodeCount;
			var targetEpisode = caughtUp ? lastEpisode : lastEpisode + 1;

			var badge = card.querySelector('[data-new-badge]');
			var newCount = 0;
			for (var n = 1; n <= episodeCount; n++) if (isNew(entry, n)) newCount++;
			if (badge && newCount > 0) {
				badge.textContent = badge.getAttribute('data-label').replace('{n}', newCount);
				badge.hidden = false;
			}

			var link = card.querySelector('[data-continue-link]');
			if (link) {
				link.setAttribute('href', baseHref + '/' + targetEpisode);
				// Labels come from the page (data-label-*) so they follow the site's language.
				var template = link.getAttribute(caughtUp ? 'data-label-read-again' : 'data-label-continue');
				if (template) link.textContent = template.replace('{n}', targetEpisode);
			}
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		recordVisit();
		applyToListing();
		markReadEpisodes();
	});
})();
