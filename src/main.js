import './style.css';
import { initFullPageSlides } from './slide-deck/index.js';
import { initMobileHeaderHide } from './mobile-header-hide.js';

const FORMSPREE_FORM_ID = import.meta.env.VITE_FORMSPREE_FORM_ID || '';
const ORDER_MAILTO = import.meta.env.VITE_ORDER_EMAIL || '';
/** Полный URL бэкенда (папка backend): https://ваш-хост/api/order */
const ORDER_API_URL = (import.meta.env.VITE_ORDER_API_URL || '').trim();

function initScrollTopButton(deck) {
  const btn = document.getElementById('scroll-top-btn');
  if (!(btn instanceof HTMLButtonElement)) return;

  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showButton() {
    btn.hidden = false;
    btn.classList.add('scroll-top-btn--visible');
    btn.setAttribute('aria-hidden', 'false');
  }

  function hideButton() {
    btn.classList.remove('scroll-top-btn--visible');
    btn.setAttribute('aria-hidden', 'true');
    const delayMs = isReducedMotion ? 0 : 240;
    window.setTimeout(() => {
      if (!btn.classList.contains('scroll-top-btn--visible')) btn.hidden = true;
    }, delayMs);
  }

  function updateByNativeScroll() {
    if (window.scrollY > 320) showButton();
    else hideButton();
  }

  if (deck && typeof deck.getIndex === 'function' && typeof deck.on === 'function') {
    const syncDeckState = () => {
      if (deck.getIndex() > 0) showButton();
      else hideButton();
    };
    deck.on(syncDeckState);
    syncDeckState();
  } else {
    updateByNativeScroll();
    window.addEventListener('scroll', updateByNativeScroll, { passive: true });
  }

  btn.addEventListener('click', () => {
    if (deck && typeof deck.goTo === 'function') {
      deck.goTo(0, 'prev');
      return;
    }
    window.scrollTo({ top: 0, behavior: isReducedMotion ? 'auto' : 'smooth' });
  });
}

function initOrderModal() {
  const openBtn = document.querySelector('.btn_order');
  const modal = document.getElementById('order-modal');
  const form = document.getElementById('order-form');
  const statusEl = document.getElementById('order-form-status');
  const successDialog = document.getElementById('order-success-dialog');
  if (!openBtn || !modal || !form) return;

  const closeEls = modal.querySelectorAll('[data-order-close]');
  let lastFocus = null;
  let hideAfterCloseTimer = 0;
  let successHideTimer = 0;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('order-form__status--error', Boolean(isError && msg));
  }

  function openModal() {
    if (hideAfterCloseTimer) {
      clearTimeout(hideAfterCloseTimer);
      hideAfterCloseTimer = 0;
    }
    lastFocus = document.activeElement;
    modal.removeAttribute('hidden');
    void modal.offsetWidth;
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
    const delayMs = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380;
    hideAfterCloseTimer = window.setTimeout(() => {
      modal.setAttribute('hidden', '');
      hideAfterCloseTimer = 0;
    }, delayMs);
  }

  function openSuccessDialog() {
    if (!successDialog) return;
    if (successHideTimer) {
      clearTimeout(successHideTimer);
      successHideTimer = 0;
    }
    successDialog.removeAttribute('hidden');
    void successDialog.offsetWidth;
    successDialog.classList.add('order-success-dialog--open');
    successDialog.setAttribute('aria-hidden', 'false');
    document.body.classList.add('order-success-active');
    const btn = successDialog.querySelector('.order-success-dialog__btn');
    if (btn instanceof HTMLElement) requestAnimationFrame(() => btn.focus());
  }

  function closeSuccessDialog() {
    if (!successDialog) return;
    successDialog.classList.remove('order-success-dialog--open');
    successDialog.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('order-success-active');
    const delayMs = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320;
    successHideTimer = window.setTimeout(() => {
      successDialog.setAttribute('hidden', '');
      successHideTimer = 0;
    }, delayMs);
  }

  if (successDialog) {
    successDialog.querySelectorAll('[data-order-success-close]').forEach((el) => {
      el.addEventListener('click', () => closeSuccessDialog());
    });
  }

  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });

  closeEls.forEach((el) => {
    el.addEventListener('click', () => closeModal());
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (successDialog?.classList.contains('order-success-dialog--open')) {
      e.preventDefault();
      closeSuccessDialog();
      return;
    }
    if (modal.classList.contains('order-modal--open')) {
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

    const apiBody = {
      name,
      full_name: fullName,
      whatsapp,
      email,
      comments: comments || '—',
    };

    try {
      if (FORMSPREE_FORM_ID || ORDER_API_URL) {
        const tasks = [];

        if (FORMSPREE_FORM_ID) {
          tasks.push(
            (async () => {
              const res = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(data.error || data.errors?.[0]?.message || 'E-mail delivery failed');
              }
            })()
          );
        }

        if (ORDER_API_URL) {
          tasks.push(
            (async () => {
              const res = await fetch(ORDER_API_URL, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(apiBody),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                const msg = typeof data.error === 'string' ? data.error : 'Telegram notification failed';
                throw new Error(msg);
              }
            })()
          );
        }

        await Promise.all(tasks);

        setStatus('');
        form.reset();
        closeModal();
        const openThanks = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400;
        window.setTimeout(() => openSuccessDialog(), openThanks);
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
          'Form is not connected yet. Add VITE_FORMSPREE_FORM_ID, VITE_ORDER_API_URL, or VITE_ORDER_EMAIL in .env and rebuild.',
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
  initOrderModal();
  let deck = null;
  try {
    deck = initFullPageSlides();
  } catch (err) {
    console.error('[FIFA] initFullPageSlides failed', err);
  }
  initScrollTopButton(deck);
  initMobileHeaderHide(deck);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
