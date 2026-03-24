/**
 * Fullscreen slide deck: wheel / touch / keyboard, one step per gesture (with lock).
 */

const WHEEL_THRESHOLD = 48;
const TOUCH_MIN = 56;
const UNLOCK_FALLBACK_MS = 900;
/** When GSAP drives panel motion, unlock via deck.releaseGsapTransitionLock(prevSection). */
const GSAP_UNLOCK_FALLBACK_MS = 2000;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isModalOpen() {
  return document.body.classList.contains('order-modal-active');
}

function isInsideOrderModal(target) {
  if (!(target instanceof Node)) return false;
  return Boolean(document.getElementById('order-modal')?.contains(target));
}

function getScrollableAncestor(el, root) {
  let n = el;
  while (n && n !== root && n !== document.body) {
    if (!(n instanceof HTMLElement)) {
      n = n.parentElement;
      continue;
    }
    const st = getComputedStyle(n);
    const oy = st.overflowY;
    const scrollable = (oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 2;
    if (scrollable) return n;
    n = n.parentElement;
  }
  return null;
}

function canConsumeInnerScroll(scroller, deltaY) {
  const top = scroller.scrollTop;
  const max = scroller.scrollHeight - scroller.clientHeight;
  if (deltaY > 0 && top < max - 1) return true;
  if (deltaY < 0 && top > 1) return true;
  return false;
}

export function createSlideDeck(slideEls, options = {}) {
  const slides = [...slideEls];
  const reduceMotion = options.reduceMotion ?? prefersReducedMotion();
  const gsapPanelTransition = Boolean(options.gsapPanelTransition) && !reduceMotion;

  let current = 0;
  let locked = false;
  let unlockTimer = 0;
  /** @type {HTMLElement | null} */
  let pendingGsapPrevEl = null;
  const listeners = new Set();

  function on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function emit(detail) {
    for (const fn of listeners) {
      try {
        fn(detail);
      } catch (e) {
        console.error('[slide-deck]', e);
      }
    }
  }

  function setHtmlState() {
    const el = slides[current];
    if (!el) return;
    document.documentElement.dataset.activeSlide = el.id;
    document.documentElement.dataset.slideIndex = String(current);
  }

  /** Синхронно с .slide-deck-panel--active (для CSS-хуков .slide.active). */
  function updateActivePanelClasses() {
    slides.forEach((s, i) => {
      const on = i === current;
      s.classList.toggle('slide-deck-panel--active', on);
      s.classList.toggle('active', on);
    });
  }

  function logDeckState(reason) {
    const el = slides[current];
    console.log('[slide-deck]', reason, {
      total: slides.length,
      index: current,
      activeId: el?.id ?? null,
    });
  }

  /**
   * Активный слайд — выше остальных слайдов, но ниже шапки (100) и навигации (110), выше фона body.
   * Inactive: низкий слой, без перекрытия соседей.
   */
  function applyIdleStacking() {
    const activeZ = '92';
    slides.forEach((section, i) => {
      section.style.zIndex = i === current ? activeZ : String(5 + i);
    });
  }

  function finishUnlock(prevEl, mode) {
    if (unlockTimer) {
      clearTimeout(unlockTimer);
      unlockTimer = 0;
    }
    if (mode === 'css') {
      prevEl.classList.remove('slide-deck-panel--leave-up', 'slide-deck-panel--leave-down');
    } else {
      prevEl.classList.remove('slide-deck-panel--gsap-preserve');
    }
    pendingGsapPrevEl = null;
    locked = false;
  }

  function armUnlock(prevEl, mode = 'css') {
    locked = true;
    if (unlockTimer) clearTimeout(unlockTimer);

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      prevEl.removeEventListener('transitionend', onTe);
      finishUnlock(prevEl, mode);
    };

    function onTe(e) {
      if (e.target !== prevEl) return;
      if (e.propertyName !== 'transform' && e.propertyName !== 'opacity') return;
      done();
    }

    if (mode === 'gsap') {
      pendingGsapPrevEl = prevEl;
      unlockTimer = window.setTimeout(() => {
        if (!finished) {
          finished = true;
          finishUnlock(prevEl, 'gsap');
        }
      }, GSAP_UNLOCK_FALLBACK_MS);
      return;
    }

    pendingGsapPrevEl = null;
    prevEl.addEventListener('transitionend', onTe);
    unlockTimer = window.setTimeout(done, UNLOCK_FALLBACK_MS);
  }

  function releaseGsapTransitionLock(prevEl) {
    if (!gsapPanelTransition) return;
    if (pendingGsapPrevEl !== prevEl) return;
    if (unlockTimer) {
      clearTimeout(unlockTimer);
      unlockTimer = 0;
    }
    finishUnlock(prevEl, 'gsap');
  }

  /**
   * @param {number} nextIndex
   * @param {'next' | 'prev'} [direction]
   */
  function goTo(nextIndex, direction) {
    if (nextIndex < 0 || nextIndex >= slides.length || nextIndex === current) return;
    if (locked) return;

    const prev = current;
    const prevEl = slides[prev];
    const nextEl = slides[nextIndex];
    const dir = direction ?? (nextIndex > prev ? 'next' : 'prev');

    if (reduceMotion) {
      slides.forEach((s) => {
        s.classList.remove(
          'slide-deck-panel--prep-from-bottom',
          'slide-deck-panel--prep-from-top',
          'slide-deck-panel--leave-up',
          'slide-deck-panel--leave-down',
          'slide-deck-panel--gsap-preserve'
        );
      });
      current = nextIndex;
      updateActivePanelClasses();
      slides.forEach((s, i) => s.toggleAttribute('aria-hidden', i !== current));
      setHtmlState();
      applyIdleStacking();
      logDeckState('change (reduced motion)');
      emit({
        type: 'change',
        index: current,
        id: slides[current].id,
        prevIndex: prev,
        prevId: prevEl.id,
        direction: dir,
      });
      return;
    }

    if (gsapPanelTransition) {
      armUnlock(prevEl, 'gsap');

      if (dir === 'next') {
        nextEl.classList.add('slide-deck-panel--prep-from-bottom');
      } else {
        nextEl.classList.add('slide-deck-panel--prep-from-top');
      }
      void nextEl.offsetWidth;

      prevEl.classList.remove('slide-deck-panel--active', 'active');
      prevEl.classList.add('slide-deck-panel--gsap-preserve');

      nextEl.classList.remove('slide-deck-panel--prep-from-bottom', 'slide-deck-panel--prep-from-top');

      current = nextIndex;
      updateActivePanelClasses();

      slides.forEach((s, i) => s.toggleAttribute('aria-hidden', i !== current));
      setHtmlState();
      applyIdleStacking();
      logDeckState('change (gsap panels)');
      emit({
        type: 'change',
        index: current,
        id: slides[current].id,
        prevIndex: prev,
        prevId: prevEl.id,
        direction: dir,
        gsapPanels: true,
      });
      return;
    }

    armUnlock(prevEl, 'css');

    if (dir === 'next') {
      nextEl.classList.add('slide-deck-panel--prep-from-bottom');
    } else {
      nextEl.classList.add('slide-deck-panel--prep-from-top');
    }
    void nextEl.offsetWidth;

    prevEl.classList.remove('slide-deck-panel--active', 'active');
    prevEl.classList.add(dir === 'next' ? 'slide-deck-panel--leave-up' : 'slide-deck-panel--leave-down');

    nextEl.classList.remove('slide-deck-panel--prep-from-bottom', 'slide-deck-panel--prep-from-top');

    current = nextIndex;
    updateActivePanelClasses();

    slides.forEach((s, i) => s.toggleAttribute('aria-hidden', i !== current));
    setHtmlState();
    applyIdleStacking();
    logDeckState('change');

    emit({
      type: 'change',
      index: current,
      id: slides[current].id,
      prevIndex: prev,
      prevId: prevEl.id,
      direction: dir,
    });
  }

  function next() {
    goTo(current + 1, 'next');
  }

  function prev() {
    goTo(current - 1, 'prev');
  }

  let wheelAccum = 0;
  let wheelResetTimer = 0;

  function onWheel(e) {
    if (isModalOpen()) return;
    if (isInsideOrderModal(e.target)) return;
    const active = slides[current];
    if (!active) return;

    const target = e.target instanceof Node ? e.target : null;
    if (target && active.contains(target)) {
      const scroller = getScrollableAncestor(target, active);
      if (scroller && canConsumeInnerScroll(scroller, e.deltaY)) {
        return;
      }
    }

    e.preventDefault();

    if (locked) return;

    wheelAccum += e.deltaY;
    if (wheelResetTimer) clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => {
      wheelAccum = 0;
      wheelResetTimer = 0;
    }, 140);

    if (wheelAccum > WHEEL_THRESHOLD) {
      wheelAccum = 0;
      next();
    } else if (wheelAccum < -WHEEL_THRESHOLD) {
      wheelAccum = 0;
      prev();
    }
  }

  let touchY0 = null;
  let touchTracking = false;

  function onTouchStart(e) {
    if (isModalOpen()) return;
    if (isInsideOrderModal(e.target)) return;
    if (e.touches.length !== 1) return;
    touchY0 = e.touches[0].clientY;
    touchTracking = true;
  }

  function onTouchMove(e) {
    if (!touchTracking || touchY0 == null || isModalOpen()) return;
    if (isInsideOrderModal(e.target)) return;
    const active = slides[current];
    const target = e.target instanceof Node ? e.target : null;
    if (target && active?.contains(target)) {
      const scroller = getScrollableAncestor(target, active);
      if (scroller && canConsumeInnerScroll(scroller, touchY0 - e.touches[0].clientY)) {
        return;
      }
    }
    e.preventDefault();
  }

  function onTouchEnd(e) {
    if (isInsideOrderModal(e.target)) {
      touchTracking = false;
      touchY0 = null;
      return;
    }
    if (!touchTracking || touchY0 == null || isModalOpen()) {
      touchTracking = false;
      touchY0 = null;
      return;
    }
    const y = e.changedTouches[0]?.clientY ?? touchY0;
    const dy = touchY0 - y;
    touchTracking = false;
    touchY0 = null;
    if (locked) return;
    if (dy > TOUCH_MIN) next();
    else if (dy < -TOUCH_MIN) prev();
  }

  function onKeyDown(e) {
    if (isModalOpen()) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;

    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0, current > 0 ? 'prev' : 'next');
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(slides.length - 1, current < slides.length - 1 ? 'next' : 'prev');
    }
  }

  function bind() {
    document.documentElement.classList.add('js-slide-deck');
    current = 0;
    slides.forEach((section, i) => {
      section.classList.add('slide-deck-panel', 'slide');
      section.classList.remove(
        'slide-deck-panel--prep-from-bottom',
        'slide-deck-panel--prep-from-top',
        'slide-deck-panel--leave-up',
        'slide-deck-panel--leave-down',
        'slide-deck-panel--gsap-preserve'
      );
      section.toggleAttribute('aria-hidden', i !== 0);
    });
    updateActivePanelClasses();
    setHtmlState();
    applyIdleStacking();
    logDeckState('bind');

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    emit({
      type: 'init',
      index: 0,
      id: slides[0]?.id,
    });
  }

  function destroy() {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('keydown', onKeyDown);
    if (unlockTimer) clearTimeout(unlockTimer);
    document.documentElement.classList.remove('js-slide-deck', 'deck-gsap-panels');
    delete document.documentElement.dataset.activeSlide;
    delete document.documentElement.dataset.slideIndex;
    slides.forEach((section) => {
      section.classList.remove(
        'slide',
        'active',
        'slide-deck-panel',
        'slide-deck-panel--active',
        'slide-deck-panel--prep-from-bottom',
        'slide-deck-panel--prep-from-top',
        'slide-deck-panel--leave-up',
        'slide-deck-panel--leave-down',
        'slide-deck-panel--gsap-preserve'
      );
      section.removeAttribute('aria-hidden');
      section.style.zIndex = '';
    });
  }

  return {
    bind,
    destroy,
    on,
    next,
    prev,
    goTo,
    getIndex: () => current,
    getSlideId: () => slides[current]?.id,
    getSlides: () => slides,
    isLocked: () => locked,
    releaseGsapTransitionLock,
    /** @readonly */
    gsapPanelTransition,
  };
}
