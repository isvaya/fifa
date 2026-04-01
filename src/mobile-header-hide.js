/**
 * Mobile (<768px): hide fixed .header after first scroll / swipe / slide change.
 * Adds body.header-hidden — CSS animates header out and frees vertical space.
 */

const MQ = '(max-width: 767px)';

/** Слайды, на которых шапка должна быть видна (в т.ч. после возврата снизу). */
function isHeaderVisibleSlideActive() {
  const id = document.documentElement.dataset.activeSlide;
  return id === 'slide_1' || id === 'slide_16';
}

function isModalOpen() {
  return document.body.classList.contains('order-modal-active');
}

function touchTargetInOrderModal(target) {
  if (!(target instanceof Node)) return false;
  return Boolean(document.getElementById('order-modal')?.contains(target));
}

export function initMobileHeaderHide(deck) {
  const mq = window.matchMedia(MQ);

  function hideHeader() {
    if (!mq.matches) return;
    document.body.classList.add('header-hidden');
  }

  function resetState() {
    document.body.classList.remove('header-hidden');
  }

  function onViewportChange() {
    resetState();
  }

  function onWheel(e) {
    if (!mq.matches || isModalOpen() || isHeaderVisibleSlideActive()) return;
    if (Math.abs(e.deltaY) > 8) hideHeader();
  }

  let touchY0 = null;

  function onTouchStart(e) {
    if (!mq.matches || isModalOpen() || e.touches.length !== 1) {
      touchY0 = null;
      return;
    }
    if (touchTargetInOrderModal(e.target)) {
      touchY0 = null;
      return;
    }
    touchY0 = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (!mq.matches || touchY0 == null || e.touches.length !== 1 || isHeaderVisibleSlideActive()) return;
    if (Math.abs(e.touches[0].clientY - touchY0) > 28) hideHeader();
  }

  function onTouchEnd() {
    touchY0 = null;
  }

  function onKeyDown(e) {
    if (!mq.matches || isModalOpen() || isHeaderVisibleSlideActive()) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
      return;
    }
    if (
      e.key === 'ArrowDown' ||
      e.key === 'ArrowUp' ||
      e.key === 'PageDown' ||
      e.key === 'PageUp' ||
      e.key === ' ' ||
      e.key === 'Spacebar'
    ) {
      hideHeader();
    }
  }

  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKeyDown);

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onViewportChange);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(onViewportChange);
  }

  if (deck && typeof deck.on === 'function') {
    deck.on((detail) => {
      if (detail?.type !== 'change') return;
      if (isHeaderVisibleSlideActive()) {
        document.body.classList.remove('header-hidden');
      } else {
        hideHeader();
      }
    });
  }
}
