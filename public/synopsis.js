(function () {
	'use strict';

	document.addEventListener('DOMContentLoaded', function () {
		document.querySelectorAll('[data-synopsis]').forEach(function (synopsis) {
			var container = synopsis.closest('.novel-card__body') || synopsis.parentElement;
			var toggle = container && container.querySelector('[data-synopsis-toggle]');
			if (!toggle) return;

			// Measuring scrollHeight/clientHeight directly on a -webkit-line-clamp
			// box is unreliable across browsers, so measure the text's natural
			// (unclamped) height with an invisible clone instead.
			var clone = synopsis.cloneNode(true);
			clone.style.webkitLineClamp = 'unset';
			clone.style.display = 'block';
			clone.style.overflow = 'visible';
			clone.style.position = 'absolute';
			clone.style.visibility = 'hidden';
			clone.style.height = 'auto';
			clone.style.width = synopsis.clientWidth + 'px';
			synopsis.parentNode.insertBefore(clone, synopsis);
			var naturalHeight = clone.scrollHeight;
			clone.remove();

			// The number of lines shown comes from the CSS (more beside a cover).
			var style = window.getComputedStyle(synopsis);
			var lineHeight = parseFloat(style.lineHeight);
			var lines = parseInt(style.webkitLineClamp, 10) || 3;
			if (isNaN(lineHeight)) return;
			if (naturalHeight <= lineHeight * lines + 1) return;

			toggle.hidden = false;
			synopsis.setAttribute('data-truncatable', '');
			synopsis.setAttribute('tabindex', '0');
			synopsis.setAttribute('role', 'button');

			function toggleExpanded() {
				var expanded = synopsis.classList.toggle('novel-card__synopsis--expanded');
				toggle.textContent = toggle.getAttribute(expanded ? 'data-label-collapse' : 'data-label-expand');
			}

			toggle.addEventListener('click', toggleExpanded);
			synopsis.addEventListener('click', toggleExpanded);
			synopsis.addEventListener('keydown', function (event) {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					toggleExpanded();
				}
			});
		});
	});
})();
