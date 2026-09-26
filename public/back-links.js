// Sends "back to the list" links to the list the reader actually came from.
// List pages remember themselves for this tab; a link marked data-back-to-list switches to the all-works list
// (label from data-label-all) or a tag's list (label from that list's data-list-back-label) when that is where
// the reader started — a tag's list only when the work has that tag (data-tag-lists). Without a remembered list, links are unchanged.
// A back link to the page the reader just came from goes back in history, keeping that page's scroll position.
(function () {
	'use strict';

	var STORAGE_KEY = 'creator-site:list-origin';
	var LABEL_KEY = 'creator-site:list-origin-label';
	var ALL_WORKS = '/';
	var TAG_LIST = /^\/tags\//;

	function read(key) {
		try {
			return sessionStorage.getItem(key);
		} catch (e) {
			return null;
		}
	}

	function write(path, label) {
		try {
			sessionStorage.setItem(STORAGE_KEY, path);
			if (label) sessionStorage.setItem(LABEL_KEY, label);
			else sessionStorage.removeItem(LABEL_KEY);
		} catch (e) {
			/* sessionStorage unavailable — links keep pointing at the genre's list */
		}
	}

	function update() {
		var marker = document.querySelector('[data-list-page]');
		if (marker) {
			write(marker.getAttribute('data-list-page'), marker.getAttribute('data-list-back-label'));
			return;
		}
		var origin = read(STORAGE_KEY);
		var tagLabel = origin && TAG_LIST.test(origin) ? read(LABEL_KEY) : null;
		document.querySelectorAll('a[data-back-to-list]').forEach(function (link) {
			// Keep the genre's list so the link can switch back when the page is shown again.
			if (!link.hasAttribute('data-href-genre')) {
				link.setAttribute('data-href-genre', link.getAttribute('href'));
				link.setAttribute('data-label-genre', link.textContent);
			}
			var href = link.getAttribute('data-href-genre');
			var label = link.getAttribute('data-label-genre');
			if (origin === ALL_WORKS) {
				href = ALL_WORKS;
				label = link.getAttribute('data-label-all');
			} else if (tagLabel && (link.getAttribute('data-tag-lists') || '').split(' ').indexOf(origin) !== -1) {
				href = origin;
				label = tagLabel;
			}
			link.setAttribute('href', href);
			if (label) link.textContent = label;
		});
	}

	function samePath(a, b) {
		return a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
	}

	// When the reader came straight from the page a back link points to, go back in history instead of opening it
	// again, so the list comes back where the reader left it rather than at the top.
	document.addEventListener('click', function (event) {
		var link = event.target.closest && event.target.closest('a.header-back');
		if (!link || event.defaultPrevented || event.button !== 0) return;
		if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
		if (!document.referrer || window.history.length < 2) return;
		var from;
		try {
			from = new URL(document.referrer);
		} catch (e) {
			return;
		}
		if (from.origin !== location.origin || !samePath(from.pathname, link.pathname)) return;
		event.preventDefault();
		window.history.back();
	});

	document.addEventListener('DOMContentLoaded', update);
	// Pages restored by the browser's back/forward buttons keep their old state and skip DOMContentLoaded,
	// so a list reached with the back button would not remember itself (and a work page would keep a stale link).
	window.addEventListener('pageshow', function (event) {
		if (event.persisted) update();
	});
})();
