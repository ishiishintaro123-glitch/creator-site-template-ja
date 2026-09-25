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
		if (!slug || !episode) return;

		var history = loadHistory();
		var existing = history[slug];
		var read = readEpisodes(existing);
		if (read.indexOf(episode) === -1) read.push(episode);
		history[slug] = {
			lastEpisode: existing && existing.lastEpisode > episode ? existing.lastEpisode : episode,
			read: read,
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

	function markReadEpisodes() {
		var rows = document.querySelectorAll('[data-toc-episode]');
		if (!rows.length) return;
		var history = loadHistory();
		rows.forEach(function (row) {
			var entry = history[row.getAttribute('data-work-slug')];
			var episode = parseInt(row.getAttribute('data-toc-episode'), 10);
			if (readEpisodes(entry).indexOf(episode) !== -1) row.classList.add('is-read');
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
