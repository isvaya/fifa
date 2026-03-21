import './style.css';
import Lenis from 'lenis';
import Snap from 'lenis/snap';
import 'lenis/dist/lenis.css';

const SLIDE_SELECTOR = 'section[id^="slide_"]';

/** Суммарный offsetTop по цепочке offsetParent (нормальный поток, без «липкого» смещения). */
function flowOffsetTop(el) {
  let y = 0;
  let n = el;
  while (n) {
    y += n.offsetTop;
    n = n.offsetParent;
  }
  return y;
}

/** Зона «главного кадра» sticky-слайда (совпадает с порогами анимаций 5–7). */
function slideRevealInZone(r, vh) {
  return r.top < vh * 0.22 && r.bottom > vh * 0.68 && r.top > -vh * 0.4;
}

/**
 * Класс вешается при входе в зону и снимается при выходе — анимации снова срабатывают после скролла наверх и вниз.
 */
function bindSlideRevealOnZone(sectionId, className, reduceMotion, lenis) {
  const el = document.getElementById(sectionId);
  if (!el) return;

  if (reduceMotion) {
    el.classList.add(className);
    return;
  }

  let wasInZone = false;
  let ticking = false;

  function update() {
    const vh = window.innerHeight || 1;
    const r = el.getBoundingClientRect();
    const inZone = slideRevealInZone(r, vh);

    if (inZone && !wasInZone) {
      el.classList.add(className);
    } else if (!inZone && wasInZone) {
      el.classList.remove(className);
    }
    wasInZone = inZone;
    ticking = false;
  }

  function onScrollOrResize() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  if (lenis) {
    lenis.on('scroll', onScrollOrResize);
  }
  update();
}

/**
 * На слабых GPU и тач-устройствах Lenis + mandatory snap дают заметные подвисания.
 * Нативный скролл + CSS scroll-snap (как при prefers-reduced-motion) обычно плавнее.
 */
function shouldUseNativeScroll(reduceMotion) {
  if (reduceMotion) return true;
  try {
    if (window.matchMedia('(max-width: 900px)').matches) return true;
    if (window.matchMedia('(pointer: coarse)').matches) return true;
    if (navigator.connection?.saveData === true) return true;
    if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Плавный скролл + snap к слайдам.
 * Визуальная «стопка» (предыдущий слайд под следующим) даётся в CSS: .snap-section { position: sticky }
 * и возрастающий z-index по порядку в initSlidesStackAndReveal.
 */
function initLenisSnap(slides, skipLenis) {
  if (skipLenis) return null;

  const lenis = new Lenis({
    autoRaf: true,
    /* выше lerp = быстрее догоняет цель, меньше «тяжёлого» сглаживания при скролле */
    lerp: 0.1,
    /*
     * Windows (Chrome/Edge): wheel надёжнее ловить на document, не только на window.
     * Слишком малый wheelMultiplier + mandatory snap давал ощущение «колесо не крутит страницу».
     */
    eventsTarget: document,
    wheelMultiplier: 0.72,
    touchMultiplier: 0.82,
    smoothWheel: true,
    syncTouch: true,
    syncTouchLerp: 0.055,
    /* false: иначе Lenis вешает click на window и перехватывает все <a href="#..."> — ломает .slide-rail */
    anchors: false,
  });

  /*
   * mandatory: после паузы в жесте дотягиваем до ближайшей snap-точки — без «выпирания» следующего слайда.
   * Для каждой секции выше одного экрана добавляем точки top+vh, top+2vh… (как для 200vh у #slide_3),
   * иначе mandatory всё время тянет к верху длинного слайда и ломает скролл по всему лендингу.
   */
  const snap = new Snap(lenis, {
    type: 'mandatory',
    duration: 0.68,
    easing: (t) => 1 - Math.pow(1 - t, 3),
    /* реже пересчитывать snap во время инерции колеса — меньше микролагов */
    debounce: 80,
  });

  snap.addElements([...slides], { align: 'start', ignoreSticky: true });

  let interiorSnapRemovers = [];

  function syncSnapPositions() {
    snap.resize();
    interiorSnapRemovers.forEach((unsub) => unsub());
    interiorSnapRemovers = [];
    const vh = Math.max(1, window.visualViewport?.height ?? window.innerHeight);

    for (const el of slides) {
      if (!(el instanceof HTMLElement)) continue;
      const h = el.offsetHeight;
      /* только заметно выше экрана — иначе лишние точки дают «прыжки» между соседними слайдами */
      if (h <= vh * 1.12) continue;
      const top = flowOffsetTop(el);
      const pageCount = Math.max(1, Math.ceil(h / vh));
      for (let k = 1; k < pageCount; k += 1) {
        interiorSnapRemovers.push(snap.add(Math.ceil(top + k * vh)));
      }
    }
  }

  requestAnimationFrame(() => syncSnapPositions());
  window.addEventListener(
    'load',
    () => {
      lenis.resize();
      syncSnapPositions();
    },
    { once: true }
  );
  window.addEventListener(
    'resize',
    () => {
      lenis.resize();
      syncSnapPositions();
    },
    { passive: true }
  );

  /*
   * До загрузки картинок высота секций (в т.ч. #slide_10) может быть ~1 экран — interior snap не создаётся.
   * После загрузки контент растёт; без пересчёта mandatory snap тянет сразу к следующему слайду.
   */
  let snapResizeDebounce = 0;
  function scheduleSnapSyncFromResize() {
    if (snapResizeDebounce) clearTimeout(snapResizeDebounce);
    snapResizeDebounce = window.setTimeout(() => {
      snapResizeDebounce = 0;
      requestAnimationFrame(() => syncSnapPositions());
    }, 200);
  }
  const slideResizeObserver = new ResizeObserver(() => scheduleSnapSyncFromResize());
  for (const el of slides) {
    if (el instanceof HTMLElement) slideResizeObserver.observe(el);
  }

  /* для навигации по точкам: отключать mandatory snap на время программного scrollTo */
  lenis.__fifaSnap = snap;

  return lenis;
}

/**
 * Hero → слайд 2: --slide2-intro (линейно, шторка + затемнение 1-го + хедер),
 * --slide2-watches (медленнее, часы справа), --slide2-copy (ещё плавнее, текст/подпись).
 */
function initSlide2Intro(reduceMotion, lenis) {
  const slide2 = document.getElementById('slide_2');
  const header = document.querySelector('.header');
  if (!slide2) return;

  let ticking = false;
  function update() {
    const vh = window.innerHeight || 1;
    const top = slide2.getBoundingClientRect().top;
    const p = top >= vh ? 0 : top <= 0 ? 1 : 1 - top / vh;
    const w = reduceMotion ? p : p ** 1.58;
    const c = reduceMotion ? p : p ** 2.25;

    const root = document.documentElement;
    root.style.setProperty('--slide2-intro', p.toFixed(4));
    root.style.setProperty('--slide2-watches', w.toFixed(4));
    root.style.setProperty('--slide2-copy', c.toFixed(4));

    if (header) {
      header.style.pointerEvents = p > 0.9 ? 'none' : 'auto';
    }
    ticking = false;
  }

  function onScrollOrResize() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  if (lenis) {
    lenis.on('scroll', onScrollOrResize);
  }
  update();
}

function flattenNodeText(node) {
  let s = '';
  for (const ch of node.childNodes) {
    if (ch.nodeType === Node.TEXT_NODE) s += ch.textContent;
    else if (ch.nodeType === Node.ELEMENT_NODE && ch.tagName === 'BR') s += '\n';
    else if (ch.nodeType === Node.ELEMENT_NODE) s += flattenNodeText(ch);
  }
  return s.replace(/\s+\n/g, '\n').trim();
}

function renderPartialText(el, full, n) {
  el.textContent = '';
  const frag = document.createDocumentFragment();
  let count = 0;
  let buf = '';
  for (const ch of full) {
    if (count >= n) break;
    if (ch === '\n') {
      if (buf) frag.appendChild(document.createTextNode(buf));
      buf = '';
      frag.appendChild(document.createElement('br'));
    } else {
      buf += ch;
    }
    count += 1;
  }
  if (buf) frag.appendChild(document.createTextNode(buf));
  el.appendChild(frag);
}

/** Плавное замедление к концу печати (меньше «дёрганья» по символам). */
function easeOutCubic(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

/** Слайд 2 → 3: выезд слайда 3, уход контента слайда 2, печать текстов справа. */
function initSlide3Transition(reduceMotion) {
  const slide3 = document.getElementById('slide_3');
  const container = document.querySelector('#slide_3 .slide_3-text-container');
  if (!slide3 || !container) return;

  const blocks = [...container.children].map((el) => ({
    el,
    text: flattenNodeText(el),
  }));
  const interBlockPause = 3;
  const totalUnits =
    blocks.reduce((sum, b) => sum + b.text.length + interBlockPause, 0) - interBlockPause;

  blocks.forEach((b) => {
    b.el.textContent = '';
  });

  /** Печать только когда слайд 3 уже «на экране», не во время въезда снизу */
  const TYPE_P_START = 0.93;
  const TYPE_DURATION_MS = 4500;

  let ticking = false;
  let typeStartTime = null;

  function applyTypewriter(pType, scrollP) {
    if (reduceMotion) {
      if (scrollP < 0.06) {
        blocks.forEach((b) => {
          b.el.textContent = '';
        });
      } else {
        blocks.forEach((b) => renderPartialText(b.el, b.text, b.text.length));
      }
      return;
    }
    const u = Math.min(1, Math.max(0, pType)) * totalUnits;
    let rem = u;
    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (rem >= b.text.length) {
        renderPartialText(b.el, b.text, b.text.length);
        rem -= b.text.length;
        if (i < blocks.length - 1) {
          rem -= interBlockPause;
          if (rem < 0) rem = 0;
        }
      } else {
        renderPartialText(b.el, b.text, Math.max(0, Math.floor(rem)));
        for (let k = i + 1; k < blocks.length; k += 1) {
          blocks[k].el.textContent = '';
        }
        return;
      }
    }
  }

  function update() {
    const now = performance.now();
    const vh = window.innerHeight || 1;
    const top = slide3.getBoundingClientRect().top;
    const p = top >= vh ? 0 : top <= 0 ? 1 : 1 - top / vh;
    const v = reduceMotion ? p : p ** 1.38;

    const root = document.documentElement;
    root.style.setProperty('--slide3-intro', p.toFixed(4));
    root.style.setProperty('--slide3-visual', v.toFixed(4));

    let typeProgress = 0;
    if (!reduceMotion) {
      if (p < TYPE_P_START) {
        typeStartTime = null;
        typeProgress = 0;
        applyTypewriter(0, p);
      } else {
        if (typeStartTime === null) {
          typeStartTime = now;
        }
        typeProgress = Math.min(1, (now - typeStartTime) / TYPE_DURATION_MS);
        applyTypewriter(
          typeProgress >= 1 ? 1 : easeOutCubic(typeProgress),
          p
        );
      }
    } else {
      applyTypewriter(0, p);
    }

    ticking = false;

    if (!reduceMotion && p >= TYPE_P_START && typeProgress < 1) {
      requestAnimationFrame(update);
    }
  }

  function onScrollOrResize() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  update();
}

/** Слайд 5: текст справа; класс снимается при уходе с кадра — повтор при втором проходе. */
function initSlide5TextReveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_5', 'slide-5-text-revealed', reduceMotion, lenis);
}

/** Слайд 6: часы слева, колонка справа. */
function initSlide6Reveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_6', 'slide-6-revealed', reduceMotion, lenis);
}

/** Слайд 7: как слайд 6. */
function initSlide7Reveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_7', 'slide-7-revealed', reduceMotion, lenis);
}

function initSlide8Reveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_8', 'slide-8-revealed', reduceMotion, lenis);
}

/**
 * Слайд 9: часы (.watch-scene) выезжают снизу; h2 и p — посимвольная печать;
 * подпись — «дорисовка» после текста (класс slide-9-signature-revealed).
 */
function initSlide9(reduceMotion, lenis) {
  const slide9 = document.getElementById('slide_9');
  const left = slide9?.querySelector('.slide_9-left');
  const h2 = left?.querySelector('h2');
  const p = left?.querySelector('p');
  if (!slide9 || !h2 || !p) return;

  if (reduceMotion) {
    slide9.classList.add('slide-9-revealed', 'slide-9-signature-revealed');
    return;
  }

  const h2Text = flattenNodeText(h2);
  const pText = flattenNodeText(p);
  const interBlockPause = 12;
  const blocks = [
    { el: h2, text: h2Text },
    { el: p, text: pText },
  ];
  const totalUnits =
    blocks.reduce((sum, b) => sum + b.text.length + interBlockPause, 0) - interBlockPause;
  const TYPE_DURATION_MS = Math.min(6000, Math.max(2800, totalUnits * 38));

  let wasInZone = false;
  let zoneTicking = false;
  let typeRafId = 0;
  let typeStartTime = null;

  function applyTypewriterProgress(pType) {
    const u = Math.min(1, Math.max(0, pType)) * totalUnits;
    let rem = u;
    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (rem >= b.text.length) {
        renderPartialText(b.el, b.text, b.text.length);
        rem -= b.text.length;
        if (i < blocks.length - 1) {
          rem -= interBlockPause;
          if (rem < 0) rem = 0;
        }
      } else {
        renderPartialText(b.el, b.text, Math.max(0, Math.floor(rem)));
        for (let k = i + 1; k < blocks.length; k += 1) {
          blocks[k].el.textContent = '';
        }
        return;
      }
    }
  }

  function typeLoop(now) {
    if (!slide9.classList.contains('slide-9-revealed')) {
      typeRafId = 0;
      return;
    }
    if (typeStartTime === null) typeStartTime = now;
    const tLin = Math.min(1, (now - typeStartTime) / TYPE_DURATION_MS);
    applyTypewriterProgress(tLin >= 1 ? 1 : easeOutCubic(tLin));
    if (tLin < 1) {
      typeRafId = requestAnimationFrame(typeLoop);
    } else {
      applyTypewriterProgress(1);
      slide9.classList.add('slide-9-signature-revealed');
      typeRafId = 0;
    }
  }

  function enterZone() {
    if (typeRafId) cancelAnimationFrame(typeRafId);
    typeRafId = 0;
    typeStartTime = null;
    slide9.classList.remove('slide-9-signature-revealed');
    blocks.forEach((b) => {
      b.el.textContent = '';
    });
    slide9.classList.add('slide-9-revealed');
    typeRafId = requestAnimationFrame(typeLoop);
  }

  function leaveZone() {
    if (typeRafId) cancelAnimationFrame(typeRafId);
    typeRafId = 0;
    typeStartTime = null;
    slide9.classList.remove('slide-9-revealed', 'slide-9-signature-revealed');
    blocks.forEach((b) => {
      b.el.textContent = '';
    });
  }

  function updateZone() {
    const vh = window.innerHeight || 1;
    const r = slide9.getBoundingClientRect();
    const inZone = slideRevealInZone(r, vh);

    if (inZone && !wasInZone) {
      enterZone();
    } else if (!inZone && wasInZone) {
      leaveZone();
    }
    wasInZone = inZone;
    zoneTicking = false;
  }

  function onScrollOrResize() {
    if (!zoneTicking) {
      zoneTicking = true;
      requestAnimationFrame(updateZone);
    }
  }

  h2.textContent = '';
  p.textContent = '';
  slide9.classList.remove('slide-9-revealed', 'slide-9-signature-revealed');

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  if (lenis) {
    lenis.on('scroll', onScrollOrResize);
  }
  updateZone();
}

/**
 * Слайд 10: длинная колонка карточек на мобиле.
 * Обычный slideRevealInZone снимает класс при прокрутке внутри слайда (r.top уходит в минус) — не используем.
 * Класс снимаем только когда секция полностью вне вьюпорта, чтобы не мешать скроллу по карточкам.
 */
function initSlide10Reveal(reduceMotion, lenis) {
  const el = document.getElementById('slide_10');
  if (!el) return;

  if (reduceMotion) {
    el.classList.add('slide-10-revealed');
    return;
  }

  let revealed = false;
  let ticking = false;

  function update() {
    const vh = window.innerHeight || 1;
    const r = el.getBoundingClientRect();
    const inFocusZone = slideRevealInZone(r, vh);
    const intersectsViewport = r.bottom > 0 && r.top < vh;
    /* мягче узкой зоны: слайд заполняет кадр после snap, чтобы не остаться без reveal */
    const looseInView =
      intersectsViewport && r.top <= vh * 0.32 && r.bottom >= vh * 0.42;

    if (!revealed && (inFocusZone || looseInView)) {
      el.classList.add('slide-10-revealed');
      revealed = true;
    } else if (revealed && !intersectsViewport) {
      el.classList.remove('slide-10-revealed');
      revealed = false;
    }
    ticking = false;
  }

  function onScrollOrResize() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  if (lenis) {
    lenis.on('scroll', onScrollOrResize);
  }
  update();
}

/** Слайд 11: часы увеличиваются; после — печать h2; затем подпись (slide-11-signature-revealed). */
function initSlide11(reduceMotion, lenis) {
  const slide11 = document.getElementById('slide_11');
  const h2 = slide11?.querySelector('.slide_11-copy h2');
  if (!slide11 || !h2) return;

  const WATCH_ANIM_MS = 960;
  const h2Text = flattenNodeText(h2);
  /* Линейная прогресс по tLin (без ease-out на n): иначе последние символы «висят» секундами */
  const TYPE_DURATION_MS = Math.min(3200, Math.max(720, h2Text.length * 42));

  if (reduceMotion) {
    slide11.classList.add('slide-11-revealed', 'slide-11-signature-revealed');
    return;
  }

  let wasInZone = false;
  let zoneTicking = false;
  let typeRafId = 0;
  let typeStartTime = null;
  let watchDoneTimer = null;

  function typeLoop(now) {
    if (!slide11.classList.contains('slide-11-revealed')) {
      typeRafId = 0;
      return;
    }
    if (typeStartTime === null) typeStartTime = now;
    const tLin = Math.min(1, (now - typeStartTime) / TYPE_DURATION_MS);
    const n = Math.min(h2Text.length, Math.floor(tLin * h2Text.length));
    renderPartialText(h2, h2Text, n);
    if (tLin < 1) {
      typeRafId = requestAnimationFrame(typeLoop);
    } else {
      renderPartialText(h2, h2Text, h2Text.length);
      slide11.classList.add('slide-11-signature-revealed');
      typeRafId = 0;
    }
  }

  function enterZone() {
    if (watchDoneTimer) clearTimeout(watchDoneTimer);
    watchDoneTimer = null;
    if (typeRafId) cancelAnimationFrame(typeRafId);
    typeRafId = 0;
    typeStartTime = null;
    h2.textContent = '';
    slide11.classList.remove('slide-11-signature-revealed');
    slide11.classList.add('slide-11-revealed');
    watchDoneTimer = setTimeout(() => {
      watchDoneTimer = null;
      if (!slide11.classList.contains('slide-11-revealed')) return;
      typeStartTime = null;
      typeRafId = requestAnimationFrame(typeLoop);
    }, WATCH_ANIM_MS);
  }

  function leaveZone() {
    if (watchDoneTimer) clearTimeout(watchDoneTimer);
    watchDoneTimer = null;
    if (typeRafId) cancelAnimationFrame(typeRafId);
    typeRafId = 0;
    slide11.classList.remove('slide-11-revealed', 'slide-11-signature-revealed');
    h2.textContent = '';
  }

  function slide11InZone(r, vh) {
    /* Чуть шире общей slideRevealInZone — меньше ложных leave при инерции скролла / смене кадра */
    return r.top < vh * 0.3 && r.bottom > vh * 0.52 && r.top > -vh * 0.48;
  }

  let outZoneFrames = 0;
  const LEAVE_AFTER_FRAMES = 4;

  function updateZone() {
    const vh = window.innerHeight || 1;
    const r = slide11.getBoundingClientRect();
    const inZone = slide11InZone(r, vh);

    if (inZone) {
      outZoneFrames = 0;
      if (!wasInZone) {
        enterZone();
      }
      wasInZone = true;
    } else if (wasInZone) {
      outZoneFrames += 1;
      if (outZoneFrames >= LEAVE_AFTER_FRAMES) {
        leaveZone();
        wasInZone = false;
        outZoneFrames = 0;
      }
    }
    zoneTicking = false;
  }

  function onScrollOrResize() {
    if (!zoneTicking) {
      zoneTicking = true;
      requestAnimationFrame(updateZone);
    }
  }

  h2.textContent = '';
  slide11.classList.remove('slide-11-revealed', 'slide-11-signature-revealed');

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  if (lenis) {
    lenis.on('scroll', onScrollOrResize);
  }
  updateZone();
}

function initSlide12Reveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_12', 'slide-12-revealed', reduceMotion, lenis);
}

function initSlide13Reveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_13', 'slide-13-revealed', reduceMotion, lenis);
}

/** Слайд 14: часы въезжают справа; h2 — печать с восстановлением <strong> в конце. */
function initSlide14(reduceMotion, lenis) {
  const slide14 = document.getElementById('slide_14');
  const h2 = slide14?.querySelector('.slide_14-right h2');
  if (!slide14 || !h2) return;

  const h2FullHTML = h2.innerHTML;
  const h2Text = flattenNodeText(h2);
  const TYPE_START_MS = 340;
  const TYPE_DURATION_MS = Math.min(5200, Math.max(1600, h2Text.length * 38));

  if (reduceMotion) {
    slide14.classList.add('slide-14-revealed');
    return;
  }

  let wasInZone = false;
  let zoneTicking = false;
  let typeRafId = 0;
  let typeStartTime = null;
  let typeDelayTimer = null;

  function typeLoop(now) {
    if (!slide14.classList.contains('slide-14-revealed')) {
      typeRafId = 0;
      return;
    }
    if (typeStartTime === null) typeStartTime = now;
    const tLin = Math.min(1, (now - typeStartTime) / TYPE_DURATION_MS);
    const tEff = tLin >= 1 ? 1 : easeOutCubic(tLin);
    const n = Math.min(h2Text.length, Math.floor(tEff * h2Text.length));
    renderPartialText(h2, h2Text, n);
    if (tLin < 1) {
      typeRafId = requestAnimationFrame(typeLoop);
    } else {
      h2.innerHTML = h2FullHTML;
      typeRafId = 0;
    }
  }

  function enterZone() {
    if (typeDelayTimer) clearTimeout(typeDelayTimer);
    typeDelayTimer = null;
    if (typeRafId) cancelAnimationFrame(typeRafId);
    typeRafId = 0;
    typeStartTime = null;
    h2.textContent = '';
    slide14.classList.add('slide-14-revealed');
    typeDelayTimer = setTimeout(() => {
      typeDelayTimer = null;
      if (!slide14.classList.contains('slide-14-revealed')) return;
      typeStartTime = null;
      typeRafId = requestAnimationFrame(typeLoop);
    }, TYPE_START_MS);
  }

  function leaveZone() {
    if (typeDelayTimer) clearTimeout(typeDelayTimer);
    typeDelayTimer = null;
    if (typeRafId) cancelAnimationFrame(typeRafId);
    typeRafId = 0;
    slide14.classList.remove('slide-14-revealed');
    h2.innerHTML = h2FullHTML;
  }

  function updateZone() {
    const vh = window.innerHeight || 1;
    const r = slide14.getBoundingClientRect();
    const inZone = slideRevealInZone(r, vh);

    if (inZone && !wasInZone) {
      enterZone();
    } else if (!inZone && wasInZone) {
      leaveZone();
    }
    wasInZone = inZone;
    zoneTicking = false;
  }

  function onScrollOrResize() {
    if (!zoneTicking) {
      zoneTicking = true;
      requestAnimationFrame(updateZone);
    }
  }

  h2.textContent = '';
  slide14.classList.remove('slide-14-revealed');

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  if (lenis) {
    lenis.on('scroll', onScrollOrResize);
  }
  updateZone();
}

function initSlide15Reveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_15', 'slide-15-revealed', reduceMotion, lenis);
}

function initSlide16Reveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_16', 'slide-16-revealed', reduceMotion, lenis);
}

function initSlide17Reveal(reduceMotion, lenis) {
  bindSlideRevealOnZone('slide_17', 'slide-17-revealed', reduceMotion, lenis);
}

function scrollPaddingTopPx() {
  const raw = getComputedStyle(document.documentElement).scrollPaddingTop;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 96;
}

/** Документная Y начала слайда по индексу (сумма высот предыдущих секций в потоке — стабильно для sticky-стопки). */
function scrollDocumentYForSlideIndex(slides, slideIndex) {
  let y = 0;
  for (let j = 0; j < slideIndex; j += 1) {
    const el = slides[j];
    if (el instanceof HTMLElement) y += el.offsetHeight;
  }
  return y;
}

function initSlideRail(slides, reduceMotion, lenis) {
  const header = document.querySelector('.header');
  const nav = document.createElement('nav');
  nav.className = 'slide-rail';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Слайды');
  /* Не отдавать жесты Lenis (virtual scroll) — иначе тап по точке может уйти в скролл страницы */
  nav.setAttribute('data-lenis-prevent', '');
  const ul = document.createElement('ul');
  const links = [];

  slides.forEach((section, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slide-rail__dot';
    btn.setAttribute('aria-label', `Слайд ${i + 1}`);
    btn.setAttribute('aria-controls', section.id);

    function navigateToSlide() {
      const pad = scrollPaddingTopPx();
      const snapInst = lenis && lenis.__fifaSnap;
      if (lenis) {
        const docY = scrollDocumentYForSlideIndex(slides, i);
        const nextY = Math.max(0, Math.round(docY - pad));
        if (snapInst && typeof snapInst.stop === 'function') snapInst.stop();
        lenis.scrollTo(nextY, {
          duration: 1.05,
          lock: true,
          force: true,
          onComplete: () => {
            if (snapInst && typeof snapInst.start === 'function') snapInst.start();
          },
        });
      } else {
        section.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    }

    btn.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateToSlide();
      },
      true
    );
    links.push(btn);
    li.appendChild(btn);
    ul.appendChild(li);
  });

  nav.appendChild(ul);
  if (header?.parentNode) {
    header.after(nav);
  } else {
    document.body.appendChild(nav);
  }

  let ticking = false;
  function updateActive() {
    const vh = window.innerHeight;
    let idx = 0;
    for (let i = slides.length - 1; i >= 0; i--) {
      const top = slides[i].getBoundingClientRect().top;
      if (top < vh * 0.5) {
        idx = i;
        break;
      }
    }
    links.forEach((link, j) => {
      link.classList.toggle('is-active', j === idx);
    });
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateActive);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  if (lenis) {
    lenis.on('scroll', onScroll);
  }
  updateActive();
}

/** Слайд 2: при перекрывающихся часах выбираем «свои» по ближайшему центру картинки (см. .is-watch-hover в CSS). */
function initSlide2WatchPointerHover(reduceMotion) {
  if (reduceMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const container = document.querySelector('#slide_2 .watches-container');
  if (!container) return;

  const items = [...container.querySelectorAll('.watch-item')];

  function pickWatch(clientX, clientY) {
    const hits = [];
    for (const item of items) {
      const img = item.querySelector('.watch');
      if (!img) continue;
      const r = img.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      hits.push({ item, d2: dx * dx + dy * dy });
    }
    if (hits.length === 0) return null;
    hits.sort((a, b) => a.d2 - b.d2);
    return hits[0].item;
  }

  function clear() {
    items.forEach((el) => el.classList.remove('is-watch-hover'));
  }

  function onMove(e) {
    const winner = pickWatch(e.clientX, e.clientY);
    if (!winner) {
      clear();
      return;
    }
    items.forEach((el) => el.classList.toggle('is-watch-hover', el === winner));
  }

  container.addEventListener('pointermove', onMove, { passive: true });
  container.addEventListener('pointerleave', clear, { passive: true });
  container.addEventListener('pointercancel', clear, { passive: true });
}

function initSlidesStackAndReveal() {
  const slides = document.querySelectorAll(SLIDE_SELECTOR);
  if (!slides.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nativeScroll = shouldUseNativeScroll(reduceMotion);

  if (nativeScroll) {
    document.documentElement.classList.add('use-native-scroll-snap');
    if (!reduceMotion) {
      document.documentElement.classList.add('perf-lite');
    }
  }

  const lenis = initLenisSnap(slides, nativeScroll);

  const STACK_BASE_Z = 20;
  slides.forEach((section, index) => {
    section.classList.add('snap-section');
    /* Каждый следующий слайд выше по z-index — наезжает на предыдущий при скролле */
    const z = STACK_BASE_Z + index;
    section.style.zIndex = String(z);

    if (reduceMotion) {
      section.classList.add('is-inview');
      return;
    }

    if (index === 0) {
      section.classList.add('is-inview');
    }

    /* 2–17: свои анимации; без reveal-child на всю секцию */
    if (
      section.id !== 'slide_2' &&
      section.id !== 'slide_3' &&
      section.id !== 'slide_4' &&
      section.id !== 'slide_5' &&
      section.id !== 'slide_6' &&
      section.id !== 'slide_7' &&
      section.id !== 'slide_8' &&
      section.id !== 'slide_9' &&
      section.id !== 'slide_10' &&
      section.id !== 'slide_11' &&
      section.id !== 'slide_12' &&
      section.id !== 'slide_13' &&
      section.id !== 'slide_14' &&
      section.id !== 'slide_15' &&
      section.id !== 'slide_16' &&
      section.id !== 'slide_17'
    ) {
      [...section.children].forEach((child, i) => {
        child.classList.add('reveal-child');
        child.style.setProperty('--reveal-order', String(i));
      });
    }
  });

  initSlide2Intro(reduceMotion, lenis);
  initSlide3Transition(reduceMotion);
  initSlide5TextReveal(reduceMotion, lenis);
  initSlide6Reveal(reduceMotion, lenis);
  initSlide7Reveal(reduceMotion, lenis);
  initSlide8Reveal(reduceMotion, lenis);
  initSlide9(reduceMotion, lenis);
  initSlide10Reveal(reduceMotion, lenis);
  initSlide11(reduceMotion, lenis);
  initSlide12Reveal(reduceMotion, lenis);
  initSlide13Reveal(reduceMotion, lenis);
  initSlide14(reduceMotion, lenis);
  initSlide15Reveal(reduceMotion, lenis);
  initSlide16Reveal(reduceMotion, lenis);
  initSlide17Reveal(reduceMotion, lenis);
  initSlide2WatchPointerHover(reduceMotion);
  initSlideRail(slides, reduceMotion, lenis);

  if (reduceMotion) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        io.unobserve(entry.target);
      });
    },
    {
      root: null,
      threshold: 0.12,
      rootMargin: '-10% 0px -8% 0px',
    }
  );

  slides.forEach((section, index) => {
    if (index !== 0) io.observe(section);
  });
}

const FORMSPREE_FORM_ID = import.meta.env.VITE_FORMSPREE_FORM_ID || '';
const ORDER_MAILTO = import.meta.env.VITE_ORDER_EMAIL || '';

function initOrderModal() {
  const openBtn = document.querySelector('.btn_order');
  const modal = document.getElementById('order-modal');
  const form = document.getElementById('order-form');
  const statusEl = document.getElementById('order-form-status');
  if (!openBtn || !modal || !form) return;

  const closeEls = modal.querySelectorAll('[data-order-close]');
  let lastFocus = null;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('order-form__status--error', Boolean(isError && msg));
  }

  function openModal() {
    lastFocus = document.activeElement;
    modal.classList.add('order-modal--open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('order-modal-active');
    setStatus('');
    const first = form.querySelector('input:not(.order-form__hp), textarea');
    if (first instanceof HTMLElement) {
      requestAnimationFrame(() => first.focus());
    }
  }

  function closeModal() {
    modal.classList.remove('order-modal--open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('order-modal-active');
    setStatus('');
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  }

  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });

  closeEls.forEach((el) => {
    el.addEventListener('click', () => closeModal());
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('order-modal--open')) {
      e.preventDefault();
      closeModal();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const fd = new FormData(form);
    if (fd.get('_gotcha')) return;

    const name = String(fd.get('name') || '').trim();
    const fullName = String(fd.get('full_name') || '').trim();
    const whatsapp = String(fd.get('whatsapp') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const comments = String(fd.get('comments') || '').trim();

    if (!name || !fullName || !whatsapp || !email) {
      setStatus('Please fill in all required fields.', true);
      return;
    }

    const submitBtn = form.querySelector('.order-form__submit');
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;

    const payload = {
      _subject: 'Website order — J.Steffany / FIFA',
      name,
      full_name: fullName,
      whatsapp,
      email,
      comments: comments || '—',
    };

    try {
      if (FORMSPREE_FORM_ID) {
        const res = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || data.errors?.[0]?.message || 'Send failed');
        }
        setStatus('Thank you! We will contact you soon.');
        form.reset();
        setTimeout(() => closeModal(), 2200);
      } else if (ORDER_MAILTO) {
        const body = [
          `Name: ${name}`,
          `Full name: ${fullName}`,
          `WhatsApp: ${whatsapp}`,
          `E-mail: ${email}`,
          '',
          'Comments:',
          comments || '—',
        ].join('\n');
        const mailUrl = `mailto:${encodeURIComponent(ORDER_MAILTO)}?subject=${encodeURIComponent(payload._subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailUrl;
        setStatus('Opening your e-mail app…');
        setTimeout(() => closeModal(), 1500);
      } else {
        setStatus(
          'Form is not connected to mail yet. Add VITE_FORMSPREE_FORM_ID or VITE_ORDER_EMAIL in .env and rebuild.',
          true
        );
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Something went wrong. Try again.', true);
    } finally {
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    }
  });
}

function boot() {
  /* ORDER не должен зависеть от Lenis/анимаций: при любой ошибке выше модалка всё равно откроется. */
  initOrderModal();
  try {
    initSlidesStackAndReveal();
  } catch (err) {
    console.error('[FIFA] initSlidesStackAndReveal failed', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
