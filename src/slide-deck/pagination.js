/**
 * Right-side dot navigation wired to slide deck.
 */
export function initSlidePagination(deck) {
  const slides = deck.getSlides();
  if (!slides.length) return;

  const header = document.querySelector('.header');
  const nav = document.createElement('nav');
  nav.className = 'slide-rail';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Slides');

  const ul = document.createElement('ul');
  const buttons = [];

  slides.forEach((section, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slide-rail__dot';
    btn.setAttribute('aria-label', `Slide ${i + 1}`);
    btn.setAttribute('aria-controls', section.id);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (deck.getIndex() === i) return;
      const dir = i > deck.getIndex() ? 'next' : 'prev';
      deck.goTo(i, dir);
    });
    buttons.push(btn);
    li.appendChild(btn);
    ul.appendChild(li);
  });

  nav.appendChild(ul);
  if (header?.parentNode) {
    header.after(nav);
  } else {
    document.body.appendChild(nav);
  }

  function sync() {
    const idx = deck.getIndex();
    buttons.forEach((b, j) => b.classList.toggle('is-active', j === idx));
  }

  deck.on(() => sync());
  sync();

  return { nav, sync };
}
