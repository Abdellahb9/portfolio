/* ==========================================================================
   Abdellah Bedda — Portfolio
   Theme toggle, mobile navigation, scroll progress, reveal-on-scroll.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // This script is running, so the head failsafe that un-hides content is not needed.
  clearTimeout(window.__revealFailsafe);

  /* ---- Theme toggle ---- */
  const themeToggle = document.getElementById('theme-toggle');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  const currentTheme = () => root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');

  const syncToggleLabel = () => {
    if (!themeToggle) return;
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', `Switch to ${next} theme`);
  };

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) { /* storage unavailable — the choice just won't persist */ }
      syncToggleLabel();
    });

    // Follow the system while the reader has not made an explicit choice.
    systemDark.addEventListener('change', () => {
      if (!root.hasAttribute('data-theme')) syncToggleLabel();
    });

    syncToggleLabel();
  }

  /* ---- Mobile navigation ---- */
  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('nav');
  const mobileQuery = window.matchMedia('(max-width: 47.9375rem)');

  const setNavOpen = (open) => {
    if (!navToggle || !nav) return;
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.hidden = !open;
  };

  // The panel only collapses on small screens; keep it visible everywhere else.
  const applyNavMode = () => {
    if (!nav) return;
    if (mobileQuery.matches) setNavOpen(false);
    else {
      nav.hidden = false;
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }
  };

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      setNavOpen(navToggle.getAttribute('aria-expanded') !== 'true');
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a') && mobileQuery.matches) setNavOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        setNavOpen(false);
        navToggle.focus();
      }
    });

    mobileQuery.addEventListener('change', applyNavMode);
    applyNavMode();
  }

  /* ---- Header state + scroll progress (one rAF-throttled listener) ---- */
  const header = document.getElementById('header');
  const progress = document.getElementById('progress');
  let queued = false;

  const onScroll = () => {
    const y = window.scrollY;

    if (header) header.dataset.scrolled = String(y > 8);

    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
    }

    queued = false;
  };

  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });

  onScroll();

  /* ---- Reveal on scroll ---- */
  const revealTargets = document.querySelectorAll('.reveal');

  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  /* ---- Active section in the nav ---- */
  const navLinks = new Map();
  document.querySelectorAll('.nav-list a[href^="#"]').forEach((link) => {
    const section = document.querySelector(link.getAttribute('href'));
    if (section) navLinks.set(section, link);
  });

  if (navLinks.size && 'IntersectionObserver' in window) {
    const visible = new Set();

    const setCurrent = () => {
      let active = null;
      navLinks.forEach((_, section) => {
        if (visible.has(section)) active = active || section;
      });
      navLinks.forEach((link, section) => {
        if (section === active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      setCurrent();
    }, { rootMargin: '-30% 0px -60% 0px' });

    navLinks.forEach((_, section) => sectionObserver.observe(section));
  }
})();
