// Sends "back to the list" links to the list the reader actually came from.
// List pages remember themselves for this tab; a link marked data-back-to-list switches to the all-works list
// (label from data-label-all) when that is where the reader started. Without a remembered list, links are unchanged.
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

	document.addEventListener('DOMContentLoaded', update);
	// Pages restored by the browser's back/forward buttons keep their old state and skip DOMContentLoaded,
	// so a list reached with the back button would not remember itself (and a work page would keep a stale link).
	window.addEventListener('pageshow', function (event) {
		if (event.persisted) update();
	});
})();
