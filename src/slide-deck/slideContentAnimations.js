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

function easeOutCubic(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

function initSlide3Typewriter(reduceMotion) {
  const slide3 = document.getElementById('slide_3');
  const container = document.querySelector('#slide_3 .slide_3-text-container');
  if (!slide3 || !container) return { enter() {}, leave() {} };

  const blocks = [...container.children].map((el) => ({
    el,
    text: flattenNodeText(el),
  }));
  const interBlockPause = 3;
  const totalUnits =
    blocks.reduce((sum, b) => sum + b.text.length + interBlockPause, 0) - interBlockPause;

  const TYPE_DURATION_MS = 4500;
  let typeStartTime = null;
  let typeRaf = 0;

  function applyTypewriter(pType) {
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

  function stop() {
    if (typeRaf) cancelAnimationFrame(typeRaf);
    typeRaf = 0;
    typeStartTime = null;
  }

  function loop(now) {
    if (!slide3.classList.contains('slide-3-deck-active')) {
      typeRaf = 0;
      return;
    }
    if (typeStartTime === null) typeStartTime = now;
    const tLin = Math.min(1, (now - typeStartTime) / TYPE_DURATION_MS);
    applyTypewriter(tLin >= 1 ? 1 : easeOutCubic(tLin));
    if (tLin < 1) {
      typeRaf = requestAnimationFrame(loop);
    } else {
      typeRaf = 0;
    }
  }

  function enter() {
    slide3.classList.add('slide-3-deck-active');
    if (reduceMotion) {
      blocks.forEach((b) => renderPartialText(b.el, b.text, b.text.length));
      return;
    }
    stop();
    blocks.forEach((b) => {
      b.el.textContent = '';
    });
    typeStartTime = null;
    requestAnimationFrame(() => {
      typeRaf = requestAnimationFrame(loop);
    });
  }

  function leave() {
    slide3.classList.remove('slide-3-deck-active');
    stop();
    if (reduceMotion) return;
    blocks.forEach((b) => {
      b.el.textContent = '';
    });
  }

  if (reduceMotion) {
    blocks.forEach((b) => renderPartialText(b.el, b.text, b.text.length));
  } else {
    blocks.forEach((b) => {
      b.el.textContent = '';
    });
  }

  return { enter, leave };
}

function initSlide9Deck(reduceMotion) {
  const slide9 = document.getElementById('slide_9');
  const left = slide9?.querySelector('.slide_9-left');
  const h2 = left?.querySelector('h2');
  const p = left?.querySelector('p');
  if (!slide9 || !h2 || !p) return { enter() {}, leave() {} };

  const h2Text = flattenNodeText(h2);
  const pText = flattenNodeText(p);

  function showFullText() {
    renderPartialText(h2, h2Text, h2Text.length);
    renderPartialText(p, pText, pText.length);
  }

  let sigTimer = 0;

  function enter() {
    if (sigTimer) clearTimeout(sigTimer);
    sigTimer = 0;
    slide9.classList.remove('slide-9-signature-revealed', 'slide-9-text-in');
    showFullText();
    slide9.classList.add('slide-9-revealed');
    if (reduceMotion) {
      slide9.classList.add('slide-9-text-in', 'slide-9-signature-revealed');
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => slide9.classList.add('slide-9-text-in'));
    });
    sigTimer = window.setTimeout(() => {
      sigTimer = 0;
      if (slide9.classList.contains('slide-9-revealed')) {
        slide9.classList.add('slide-9-signature-revealed');
      }
    }, 420);
  }

  function leave() {
    if (sigTimer) clearTimeout(sigTimer);
    sigTimer = 0;
    slide9.classList.remove('slide-9-revealed', 'slide-9-signature-revealed', 'slide-9-text-in');
    h2.textContent = '';
    p.textContent = '';
  }

  if (reduceMotion) {
    showFullText();
    slide9.classList.add('slide-9-revealed', 'slide-9-text-in', 'slide-9-signature-revealed');
    return { enter() {}, leave() {} };
  }

  h2.textContent = '';
  p.textContent = '';
  slide9.classList.remove('slide-9-revealed', 'slide-9-signature-revealed', 'slide-9-text-in');

  return { enter, leave };
}

function initSlide11Deck(reduceMotion) {
  const slide11 = document.getElementById('slide_11');
  const h2 = slide11?.querySelector('.slide_11-copy h2');
  if (!slide11 || !h2) return { enter() {}, leave() {} };

  const WATCH_ANIM_MS = 960;
  const h2Text = flattenNodeText(h2);
  const TYPE_DURATION_MS = Math.min(3200, Math.max(720, h2Text.length * 42));

  if (reduceMotion) {
    slide11.classList.add('slide-11-revealed', 'slide-11-signature-revealed');
    return { enter() {}, leave() {} };
  }

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

  function enter() {
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

  function leave() {
    if (watchDoneTimer) clearTimeout(watchDoneTimer);
    watchDoneTimer = null;
    if (typeRafId) cancelAnimationFrame(typeRafId);
    typeRafId = 0;
    slide11.classList.remove('slide-11-revealed', 'slide-11-signature-revealed');
    h2.textContent = '';
  }

  h2.textContent = '';
  slide11.classList.remove('slide-11-revealed', 'slide-11-signature-revealed');

  return { enter, leave };
}

function initSlide14Deck(reduceMotion) {
  const slide14 = document.getElementById('slide_14');
  const h2 = slide14?.querySelector('.slide_14-right h2');
  if (!slide14 || !h2) return { enter() {}, leave() {} };

  const h2FullHTML = h2.innerHTML;

  function enter() {
    slide14.classList.remove('slide-14-text-in');
    h2.innerHTML = h2FullHTML;
    slide14.classList.add('slide-14-revealed');
    if (reduceMotion) {
      slide14.classList.add('slide-14-text-in');
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => slide14.classList.add('slide-14-text-in'));
    });
  }

  function leave() {
    slide14.classList.remove('slide-14-revealed', 'slide-14-text-in');
    h2.innerHTML = h2FullHTML;
  }

  if (reduceMotion) {
    h2.innerHTML = h2FullHTML;
    slide14.classList.add('slide-14-revealed', 'slide-14-text-in');
    return { enter() {}, leave() {} };
  }

  h2.textContent = '';
  slide14.classList.remove('slide-14-revealed', 'slide-14-text-in');

  return { enter, leave };
}

/**
 * @param {ReturnType<import('./controller.js').createSlideDeck>} deck
 */
export function initSlideContentAnimations(deck, reduceMotion) {
  const s3 = initSlide3Typewriter(reduceMotion);
  const s9 = initSlide9Deck(reduceMotion);
  const s11 = initSlide11Deck(reduceMotion);
  const s14 = initSlide14Deck(reduceMotion);

  const classSlides = [
    { id: 'slide_5', className: 'slide-5-text-revealed' },
    { id: 'slide_6', className: 'slide-6-revealed' },
    { id: 'slide_7', className: 'slide-7-revealed' },
    { id: 'slide_8', className: 'slide-8-revealed' },
    { id: 'slide_10', className: 'slide-10-revealed' },
    { id: 'slide_12', className: 'slide-12-revealed' },
    { id: 'slide_13', className: 'slide-13-revealed' },
    { id: 'slide_15', className: 'slide-15-revealed' },
    { id: 'slide_16', className: 'slide-16-revealed' },
    { id: 'slide_17', className: 'slide-17-revealed' },
  ];

  function applyForSlide(slideId, isEnter) {
    if (slideId === 'slide_3') {
      if (isEnter) s3.enter();
      else s3.leave();
    }
    if (slideId === 'slide_9') {
      if (isEnter) s9.enter();
      else s9.leave();
    }
    if (slideId === 'slide_11') {
      if (isEnter) s11.enter();
      else s11.leave();
    }
    if (slideId === 'slide_14') {
      if (isEnter) s14.enter();
      else s14.leave();
    }

    for (const { id, className } of classSlides) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (id !== slideId) continue;

      if (!isEnter) {
        el.classList.remove(className);
        continue;
      }

      /* После visibility/panel transition анимации с fill-mode both иначе не стартуют */
      const restartReveal =
        !reduceMotion && (id === 'slide_13' || id === 'slide_16' || id === 'slide_17');
      if (restartReveal) {
        el.classList.remove(className);
        void el.offsetWidth;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => el.classList.add(className));
        });
      } else {
        el.classList.add(className);
      }
    }
  }

  deck.on((ev) => {
    if (ev.type === 'init') {
      applyForSlide(ev.id, true);
      return;
    }
    if (ev.type === 'change') {
      applyForSlide(ev.prevId, false);
      applyForSlide(ev.id, true);
    }
  });
}

export function initSlide2WatchPointerHover(reduceMotion) {
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
