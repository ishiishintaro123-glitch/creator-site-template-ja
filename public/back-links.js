// Sends "back to the list" links to the list the reader actually came from.
// List pages remember themselves for this tab; a link marked data-back-to-list switches to the all-works list
// (label from data-label-all) when that is where the reader started. Without a remembered list, links are unchanged.
// A back link to the page the reader just came from goes back in history, keeping that page's scroll position.
(function () {
	'use strict';

	var STORAGE_KEY = 'creator-site:list-origin';
	var ALL_WORKS = '/';

	function read() {
		try {
			return sessionStorage.getItem(STORAGE_KEY);
		} catch (e) {
			return null;
		}
	}

	function write(path) {
		try {
			sessionStorage.setItem(STORAGE_KEY, path);
		} catch (e) {
			/* sessionStorage unavailable — links keep pointing at the genre's list */
		}
	}

	function update() {
		var marker = document.querySelector('[data-list-page]');
		if (marker) {
			write(marker.getAttribute('data-list-page'));
			return;
		}
		var toAllWorks = read() === ALL_WORKS;
		document.querySelectorAll('a[data-back-to-list]').forEach(function (link) {
			// Keep the genre's list so the link can switch back when the page is shown again.
			if (!link.hasAttribute('data-href-genre')) {
				link.setAttribute('data-href-genre', link.getAttribute('href'));
				link.setAttribute('data-label-genre', link.textContent);
			}
			var label = toAllWorks ? link.getAttribute('data-label-all') : link.getAttribute('data-label-genre');
			link.setAttribute('href', toAllWorks ? ALL_WORKS : link.getAttribute('data-href-genre'));
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
