import gsap from 'gsap';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const DESKTOP_FINE_HOVER = '(min-width: 768px) and (hover: hover) and (pointer: fine)';

const BTN_GLOW_REST =
  'drop-shadow(0 0 2px rgba(255,255,255,0.98)) drop-shadow(0 0 8px rgba(255,255,255,0.75)) drop-shadow(0 0 18px rgba(255,255,255,0.5)) drop-shadow(0 0 32px rgba(255,255,255,0.28))';
const BTN_GLOW_HI =
  'drop-shadow(0 0 4px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(255,255,255,0.9)) drop-shadow(0 0 28px rgba(255,255,255,0.6)) drop-shadow(0 0 42px rgba(255,255,255,0.38))';

function slideIndexFromId(id) {
  const m = /^slide_(\d+)$/i.exec(id || '');
  return m ? parseInt(m[1], 10) : 0;
}

function setWillChange(els, on) {
  const v = on ? 'transform, opacity' : 'auto';
  els.forEach((el) => {
    if (el instanceof HTMLElement) el.style.willChange = v;
  });
}

/**
 * Premium GSAP layer: panel motion (with controller lock), per-slide content, parallax, hovers.
 * @param {ReturnType<import('./slide-deck/controller.js').createSlideDeck>} deck
 */
export function initGSAPAnimations(deck) {
  if (!deck?.gsapPanelTransition) return () => {};

  let panelTimeline = null;
  let contentTimeline = null;
  let parallaxOn = false;
  let hoverAbort = null;

  const reduceMotionQ = window.matchMedia(REDUCED_MOTION);
  const desktopHoverQ = window.matchMedia(DESKTOP_FINE_HOVER);

  function killTimelines() {
    panelTimeline?.kill();
    panelTimeline = null;
    contentTimeline?.kill();
    contentTimeline = null;
  }

  function runPanelTransition(detail) {
    if (!detail.gsapPanels) return;
    const prevEl = document.getElementById(detail.prevId);
    const nextEl = document.getElementById(detail.id);
    if (!prevEl || !nextEl) {
      if (prevEl) deck.releaseGsapTransitionLock(prevEl);
      return;
    }

    killTimelines();
    setWillChange([prevEl, nextEl], true);

    const dir = detail.direction;
    const yIn = dir === 'next' ? 80 : -80;
    const yOut = dir === 'next' ? -52 : 52;

    panelTimeline = gsap.timeline({
      defaults: { force3D: true },
      onComplete: () => {
        gsap.set(nextEl, { clearProps: 'transform,opacity,scale' });
        gsap.set(prevEl, { clearProps: 'transform,opacity,scale' });
        setWillChange([prevEl, nextEl], false);
        deck.releaseGsapTransitionLock(prevEl);
      },
    });

    /*
     * Входящая панель остаётся opacity:1 на всём переходе: иначе полупрозрачный «верх»
     * смешивается с уходящим кадром и сквозь участки с opacity:0 у детей (CSS :not(.slide-N-revealed))
     * проступает чужая картинка — заметно между 6→7 (часы слева в одном месте).
     */
    panelTimeline.fromTo(
      nextEl,
      { y: yIn, opacity: 1, scale: 0.985 },
      { y: 0, opacity: 1, scale: 1, duration: 0.92, ease: 'power3.out' },
      0
    );
    panelTimeline.fromTo(
      prevEl,
      { y: 0, opacity: 1, scale: 1 },
      { y: yOut, opacity: 0, scale: 0.93, duration: 0.82, ease: 'power2.inOut' },
      0
    );
  }

  function runSlide1Intro(section) {
    const watch = section.querySelector('.watch-img');
    const btn = section.querySelector('.btn_order');
    const text = section.querySelector('.slide_1--content .text');
    const logo = section.querySelector('.swiss-logo');
    const targets = [watch, btn, text, logo].filter(Boolean);
    setWillChange(targets, true);

    const tl = gsap.timeline({
      defaults: { force3D: true },
      onComplete: () => setWillChange(targets, false),
    });

    if (watch) {
      tl.fromTo(watch, { y: 200, opacity: 0 }, { y: 0, opacity: 1, duration: 1.05, ease: 'power3.out' }, 0);
    }
    if (btn) {
      tl.fromTo(
        btn,
        { scale: 0.88, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.85, ease: 'back.out(1.35)' },
        0.28
      );
    }
    if (text) {
      tl.fromTo(text, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, ease: 'power2.out' }, 0.42);
    }
    if (logo) {
      tl.fromTo(logo, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, ease: 'power2.out' }, 0.55);
    }
    return tl;
  }

  function runSlide2Intro(section) {
    const items = gsap.utils.toArray(section.querySelectorAll('.watch-item'));
    const h2 = section.querySelector('.slide_2-text h2');
    const sig = section.querySelector('.slide_2-signature');
    const targets = [...items, h2, sig].filter(Boolean);
    setWillChange(targets, true);

    const tl = gsap.timeline({
      onComplete: () => setWillChange(targets, false),
    });
    /* Только opacity: любой y/scale на .watch-item затирает translateY(-50%) из CSS — «прыжок» снизу в центр */
    tl.fromTo(
      items,
      { opacity: 0 },
      { opacity: 1, duration: 0.72, stagger: 0.12, ease: 'power3.out' },
      0.1
    );
    if (h2) {
      tl.fromTo(h2, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, 0);
    }
    if (sig) {
      tl.fromTo(sig, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, 0.45);
    }
    return tl;
  }

  function runSlide3Intro(section) {
    const hero = section.querySelector('.slide_3-hero');
    if (!hero) return null;
    setWillChange([hero], true);

    const tl = gsap.timeline({
      onComplete: () => setWillChange([hero], false),
    });
    tl.fromTo(
      hero,
      { scale: 0.85, transformOrigin: '50% 55%' },
      { scale: 1, duration: 1.15, ease: 'power2.out', overwrite: 'auto' },
      0.12
    );
    return tl;
  }

  function runSlide4Intro(section) {
    const watch = section.querySelector('.slide_4-watch');
    const sig = section.querySelector('.signature');
    const stack = section.querySelector('.slide_4-stack');
    const targets = [watch, sig, stack].filter(Boolean);
    setWillChange(targets, true);
    const tl = gsap.timeline({ onComplete: () => setWillChange(targets, false) });
    if (stack) {
      tl.fromTo(stack, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.88, ease: 'power3.out' }, 0);
    }
    if (watch) {
      tl.fromTo(watch, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, ease: 'power2.out' }, 0.08);
    }
    if (sig) {
      tl.fromTo(sig, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 0.35);
    }
    return tl;
  }

  /** Slides 5+: alternate horizontal reveal + staggered copy; depth via scale. */
  function runGenericSlideIntro(section, slideNum) {
    const headings = gsap.utils.toArray(section.querySelectorAll('h2, h3'));
    const paragraphs = gsap.utils.toArray(section.querySelectorAll('p'));
    const rawImages = gsap.utils.toArray(
      section.querySelectorAll('img.watch, img[class*="watch"], .watch-scene, .watch-wrapper')
    );
    /* Пары часов на 16/17 — absolute + translate(-50%); общий x на img ломает вёрстку */
    const images = rawImages.filter((el) => !el.closest?.('.slide_16-watch-stack, .slide_17-watch-stack'));
    const watchPairLeft =
      slideNum === 16
        ? section.querySelector('.slide_16-left')
        : slideNum === 17
          ? section.querySelector('.slide_17-left')
          : null;
    const altRight = slideNum % 2 === 1;
    const xText = altRight ? -48 : 48;
    const xImg = altRight ? 40 : -40;
    const targets = [...headings, ...paragraphs, ...images, watchPairLeft].filter(Boolean);
    setWillChange(targets, true);

    const tl = gsap.timeline({ onComplete: () => setWillChange(targets, false) });
    if (watchPairLeft && (slideNum === 16 || slideNum === 17)) {
      tl.fromTo(
        watchPairLeft,
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 0.88, ease: 'power3.out' },
        0.06
      );
    } else if (images.length) {
      tl.fromTo(
        images,
        { x: xImg, opacity: 0, scale: 0.94 },
        { x: 0, opacity: 1, scale: 1, duration: 0.82, stagger: 0.06, ease: 'power3.out' },
        0.06
      );
    }
    if (headings.length) {
      tl.fromTo(
        headings,
        { x: xText, opacity: 0, scale: 0.97 },
        { x: 0, opacity: 1, scale: 1, duration: 0.72, stagger: 0.08, ease: 'power2.out' },
        0.12
      );
    }
    if (paragraphs.length) {
      tl.fromTo(
        paragraphs,
        { x: xText * 0.75, opacity: 0, scale: 0.98 },
        { x: 0, opacity: 1, scale: 1, duration: 0.65, stagger: 0.07, ease: 'power2.out' },
        0.22
      );
    }
    return tl;
  }

  function runContentForSlideId(slideId) {
    const section = document.getElementById(slideId);
    if (!section) return null;
    const n = slideIndexFromId(slideId);
    if (n === 1) return runSlide1Intro(section);
    if (n === 2) return runSlide2Intro(section);
    if (n === 3) return runSlide3Intro(section);
    if (n === 4) return runSlide4Intro(section);
    if (n >= 5) return runGenericSlideIntro(section, n);
    return null;
  }

  function onDeckEvent(detail) {
    if (reduceMotionQ.matches) return;

    if (detail.type === 'init' || detail.type === 'change') {
      pickParallaxTargets();
    }

    if (detail.type === 'init') {
      contentTimeline?.kill();
      contentTimeline = gsap.timeline();
      const intro = runContentForSlideId(detail.id);
      if (intro) contentTimeline.add(intro, 0);
      return;
    }

    if (detail.type === 'change') {
      runPanelTransition(detail);
      contentTimeline?.kill();
      contentTimeline = gsap.timeline();
      const intro = runContentForSlideId(detail.id);
      if (intro) contentTimeline.add(intro, 0);
    }
  }

  const unsub = deck.on(onDeckEvent);

  /* ——— Parallax (desktop) ——— */
  let parallaxMain = null;
  let parallaxShell = null;

  function pickParallaxTargets() {
    const id = deck.getSlideId();
    const section = id ? document.getElementById(id) : null;
    if (!section) {
      parallaxMain = null;
      parallaxShell = null;
      return;
    }
    const firstWatch = section.querySelector('img.watch');
    const watchInPair = firstWatch?.closest?.('.slide_16-watch-stack, .slide_17-watch-stack');
    parallaxMain =
      section.querySelector('.watch-img') ||
      section.querySelector('.slide_3-hero') ||
      (firstWatch && !watchInPair ? firstWatch : null) ||
      section.querySelector('.slide_4-watch');
    parallaxShell =
      section.querySelector('.slide_1--visual') ||
      section.querySelector('.visual-scene') ||
      section.querySelector('.slide_4-stack') ||
      null;
  }

  function stopParallax() {
    parallaxOn = false;
    window.removeEventListener('pointermove', onParallaxMove);
    gsap.killTweensOf([parallaxMain, parallaxShell].filter(Boolean));
    if (parallaxMain) gsap.set(parallaxMain, { clearProps: 'x,y' });
    if (parallaxShell) gsap.set(parallaxShell, { clearProps: 'x,y' });
  }

  function onParallaxMove(e) {
    if (!parallaxOn || !parallaxMain) return;
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.5;
    const nx = (e.clientX - cx) / Math.max(cx, 1);
    const ny = (e.clientY - cy) / Math.max(cy, 1);
    gsap.to(parallaxMain, {
      x: nx * 10,
      y: ny * 10,
      duration: 0.85,
      ease: 'power2.out',
      overwrite: 'auto',
      force3D: true,
    });
    if (parallaxShell) {
      gsap.to(parallaxShell, {
        x: nx * 5,
        y: ny * 5,
        duration: 1,
        ease: 'power2.out',
        overwrite: 'auto',
        force3D: true,
      });
    }
  }

  function startParallaxIfEligible() {
    stopParallax();
    if (!desktopHoverQ.matches || reduceMotionQ.matches) return;
    pickParallaxTargets();
    if (!parallaxMain) return;
    parallaxOn = true;
    window.addEventListener('pointermove', onParallaxMove, { passive: true });
  }

  startParallaxIfEligible();
  desktopHoverQ.addEventListener('change', startParallaxIfEligible);
  function onReduceMotionChange() {
    if (reduceMotionQ.matches) {
      stopParallax();
      killTimelines();
      hoverAbort?.abort();
    } else {
      startParallaxIfEligible();
      setupHovers();
    }
  }

  reduceMotionQ.addEventListener('change', onReduceMotionChange);

  /* ——— Hover: buttons + images ——— */
  function setupHovers() {
    hoverAbort?.abort();
    if (!desktopHoverQ.matches || reduceMotionQ.matches) return;

    hoverAbort = new AbortController();
    const { signal } = hoverAbort;

    const buttons = gsap.utils.toArray('.btn_order, .order-form__submit, .slide-rail__dot');
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const toScale = gsap.quickTo(btn, 'scale', { duration: 0.38, ease: 'power2.out' });
      const svg = btn.querySelector('svg');

      btn.addEventListener(
        'pointerenter',
        () => {
          toScale(1.05);
          if (svg instanceof SVGElement) {
            gsap.to(svg, { filter: BTN_GLOW_HI, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
          }
        },
        { signal }
      );
      btn.addEventListener(
        'pointerleave',
        () => {
          toScale(1);
          if (svg instanceof SVGElement) {
            gsap.to(svg, { filter: BTN_GLOW_REST, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
          }
        },
        { signal }
      );
    });

    const imgs = gsap.utils.toArray('img.watch, .watch-img, .slide_3-hero, img.slide_4-watch');
    imgs.forEach((img) => {
      if (!(img instanceof HTMLElement)) return;
      /* Пары 16/17: hover задаётся в CSS (transform); quickTo(scale) затирает translate(-50%,-50%). */
      if (img.closest('.slide_16-watch-stack, .slide_17-watch-stack')) return;
      const toScale = gsap.quickTo(img, 'scale', {
        duration: 0.45,
        ease: 'power2.out',
      });
      img.addEventListener('pointerenter', () => toScale(1.045), { signal });
      img.addEventListener('pointerleave', () => toScale(1), { signal });
    });
  }

  setupHovers();
  desktopHoverQ.addEventListener('change', startParallaxIfEligible);
  desktopHoverQ.addEventListener('change', setupHovers);

  return () => {
    unsub();
    killTimelines();
    stopParallax();
    hoverAbort?.abort();
    desktopHoverQ.removeEventListener('change', startParallaxIfEligible);
    desktopHoverQ.removeEventListener('change', setupHovers);
    reduceMotionQ.removeEventListener('change', onReduceMotionChange);
  };
}
