import './style.css';
import { initFullPageSlides } from './slide-deck/index.js';
import { initMobileHeaderHide } from './mobile-header-hide.js';

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
  initOrderModal();
  let deck = null;
  try {
    deck = initFullPageSlides();
  } catch (err) {
    console.error('[FIFA] initFullPageSlides failed', err);
  }
  initMobileHeaderHide(deck);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
