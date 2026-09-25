(function () {
	'use strict';

	var STORAGE_KEY = 'creator-site:reading-prefs';
	// illustrationView: how the illustration list is shown (feed = large images top to bottom, grid = tiles).
	var defaults = { font: 'serif', size: 'm', theme: 'dark', illustrationView: 'feed' };
	var allowed = {
		font: ['sans', 'serif'],
		size: ['m', 'l', 'xl'],
		theme: ['light', 'dark'],
		illustrationView: ['feed', 'grid'],
	};

	function load() {
		try {
			var raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return Object.assign({}, defaults);
			var parsed = JSON.parse(raw);
			var prefs = Object.assign({}, defaults);
			for (var key in allowed) {
				if (allowed[key].indexOf(parsed[key]) !== -1) {
					prefs[key] = parsed[key];
				}
			}
			return prefs;
		} catch (e) {
			return Object.assign({}, defaults);
		}
	}

	function apply(prefs) {
		var root = document.documentElement;
		root.setAttribute('data-font', prefs.font);
		root.setAttribute('data-size', prefs.size);
		root.setAttribute('data-illustration-view', prefs.illustrationView);
		if (prefs.theme === 'light') {
			root.setAttribute('data-theme', 'light');
		} else {
			root.removeAttribute('data-theme');
		}
	}

	function save(prefs) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
		} catch (e) {
			/* localStorage unavailable (private mode etc.) — preference just won't persist */
		}
	}

	var prefs = load();
	apply(prefs);

	// Labels come from the button (data-label-*) so they follow the site's language.
	function themeToggleLabel(button) {
		return button.getAttribute(prefs.theme === 'dark' ? 'data-label-to-light' : 'data-label-to-dark');
	}

	document.addEventListener('DOMContentLoaded', function () {
		for (var key in allowed) {
			(function (key) {
				var inputs = document.querySelectorAll('input[name="' + key + '"]');
				inputs.forEach(function (input) {
					input.checked = input.value === prefs[key];
					input.addEventListener('change', function () {
						if (allowed[key].indexOf(input.value) === -1) return;
						prefs[key] = input.value;
						apply(prefs);
						save(prefs);
					});
				});
			})(key);
		}

		document.querySelectorAll('.settings__done').forEach(function (button) {
			button.addEventListener('click', function () {
				var details = button.closest('details');
				if (details) details.removeAttribute('open');
			});
		});

		document.querySelectorAll('[data-illustration-view-option]').forEach(function (button) {
			var value = button.getAttribute('data-illustration-view-option');
			button.setAttribute('aria-pressed', String(prefs.illustrationView === value));
			button.addEventListener('click', function () {
				if (allowed.illustrationView.indexOf(value) === -1) return;
				prefs.illustrationView = value;
				apply(prefs);
				save(prefs);
				document.querySelectorAll('[data-illustration-view-option]').forEach(function (other) {
					other.setAttribute('aria-pressed', String(other === button));
				});
			});
		});

		document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
			button.textContent = themeToggleLabel(button);
			button.addEventListener('click', function () {
				prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
				apply(prefs);
				save(prefs);
				button.textContent = themeToggleLabel(button);
			});
		});
	});
})();
