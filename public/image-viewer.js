(function () {
	'use strict';

	// Shows an image whole and large over the page (src/components/ImageViewer.astro): a work's cover, or each image of
	// an illustration. Opening adds a history entry, so the phone's back button closes the image instead of leaving
	// the page.
	document.addEventListener('DOMContentLoaded', function () {
		var viewer = document.querySelector('[data-image-viewer]');
		var buttons = document.querySelectorAll('[data-viewer-open]');
		if (!viewer || !buttons.length || typeof viewer.showModal !== 'function') return;
		var image = viewer.querySelector('img');
		var inHistory = false;

		// The large image loads only when asked for.
		function open(button) {
			image.removeAttribute('src');
			image.setAttribute('srcset', button.getAttribute('data-srcset'));
			image.setAttribute('src', button.getAttribute('data-src'));
			image.setAttribute('alt', button.getAttribute('data-alt'));
			viewer.showModal();
			document.documentElement.style.overflow = 'hidden';
			history.pushState({ imageViewer: true }, '');
			inHistory = true;
		}

		// Closing goes back through the entry added on opening, so they can't pile up.
		function requestClose() {
			if (inHistory) history.back();
			else viewer.close();
		}

		buttons.forEach(function (button) {
			button.addEventListener('click', function () {
				open(button);
			});
		});
		// Tapping anywhere closes it: the image, the × and the dark area around are all inside the dialog.
		viewer.addEventListener('click', requestClose);
		viewer.addEventListener('cancel', function (event) {
			event.preventDefault();
			requestClose();
		});
		viewer.addEventListener('close', function () {
			document.documentElement.style.overflow = '';
		});
		window.addEventListener('popstate', function () {
			inHistory = false;
			if (viewer.open) viewer.close();
		});
	});
})();
