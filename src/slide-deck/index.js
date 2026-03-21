import { createSlideDeck } from './controller.js';
import { initSlidePagination } from './pagination.js';
import {
  initSlideContentAnimations,
  initSlide2WatchPointerHover,
} from './slideContentAnimations.js';

/** Все полноэкранные слайды — только <section id="slide_N"> в порядке номера. */
const SLIDE_SELECTOR = 'section[id^="slide_"]';

function collectSlideSections() {
  const raw = [...document.querySelectorAll(SLIDE_SELECTOR)];
  const filtered = raw.filter((el) => /^slide_\d+$/i.test(el.id));
  if (filtered.length !== raw.length) {
    console.warn(
      '[slide-deck] Ignored non-standard slide ids:',
      raw.filter((el) => !filtered.includes(el)).map((el) => el.id)
    );
  }
  filtered.sort((a, b) => {
    const na = parseInt(a.id.replace(/^slide_/i, ''), 10);
    const nb = parseInt(b.id.replace(/^slide_/i, ''), 10);
    return na - nb;
  });
  return filtered;
}

export function initFullPageSlides() {
  const slides = collectSlideSections();
  if (!slides.length) {
    console.warn('[slide-deck] No sections matching', SLIDE_SELECTOR);
    return null;
  }

  console.log('[slide-deck] init: total slides =', slides.length, 'ids =', slides.map((s) => s.id));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduceMotion) {
    document.documentElement.classList.add('perf-lite');
  }

  const deck = createSlideDeck(slides, { reduceMotion });
  deck.bind();
  initSlidePagination(deck);
  initSlideContentAnimations(deck, reduceMotion);
  initSlide2WatchPointerHover(reduceMotion);

  return deck;
}
