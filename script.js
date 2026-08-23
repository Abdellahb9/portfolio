/* ============================================
   PORTFOLIO JAVASCRIPT
   Animations, Scroll Effects & Interactivity
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // This script is running, so the head failsafe that un-hides content is not needed.
  clearTimeout(window.__revealFailsafe);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---- Navbar Scroll Effect ----
  const navbar = document.querySelector('.navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  });

  // ---- Mobile Navigation ----
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle) {
    const setNav = (open) => {
      navToggle.classList.toggle('active', open);
      navLinks.classList.toggle('active', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    navToggle.addEventListener('click', () => {
      setNav(!navToggle.classList.contains('active'));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navToggle.classList.contains('active')) {
        setNav(false);
        navToggle.focus();
      }
    });

    // Close menu on link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setNav(false));
    });
  }

  // ---- Scroll Reveal Animation ----
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  if (!('IntersectionObserver' in window)) {
    revealElements.forEach(el => el.classList.add('visible'));
  } else {
    revealElements.forEach(el => revealObserver.observe(el));
  }

  // ---- Smooth Scroll for Navigation Links ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });

  // ---- Animated Counter for Stats ----
  const statNumbers = document.querySelectorAll('.stat-number');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const endValue = target.getAttribute('data-count');
        const suffix = target.getAttribute('data-suffix') || '';
        const prefix = target.getAttribute('data-prefix') || '';
        animateCounter(target, 0, parseInt(endValue), 2000, prefix, suffix);
        counterObserver.unobserve(target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => counterObserver.observe(el));

  function animateCounter(element, start, end, duration, prefix, suffix) {
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * easeOut);

      element.textContent = prefix + current + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  // ---- Terminal Typing Effect ----
  const terminalLines = document.querySelectorAll('.terminal-line.animate');

  const terminalObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Include .terminal-output, which the original selector missed —
        // those lines stayed at opacity 0 permanently.
        const lines = entry.target.querySelectorAll('.animate');
        const step = prefersReducedMotion.matches ? 0 : 140;
        lines.forEach((line, index) => {
          setTimeout(() => line.classList.add('shown'), index * step);
        });
        terminalObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  const terminalBody = document.querySelector('.terminal-body');
  if (terminalBody) {
    terminalObserver.observe(terminalBody);
  }

  // ---- Active Navigation Highlight ----
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
      const sectionHeight = section.offsetHeight;
      const sectionTop = section.offsetTop - 100;
      const sectionId = section.getAttribute('id');

      const navLink = document.querySelector(`.nav-links a[href="#${sectionId}"]`);
      if (navLink) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          navLink.style.color = 'var(--accent-primary)';
          navLink.setAttribute('aria-current', 'true');
        } else {
          navLink.style.color = '';
          navLink.removeAttribute('aria-current');
        }
      }
    });
  });

  // ---- Parallax effect on orbs ----
  const orbs = document.querySelectorAll('.orb');

  if (!prefersReducedMotion.matches) window.addEventListener('mousemove', (e) => {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;

    orbs.forEach((orb, index) => {
      const speed = (index + 1) * 15;
      const xOffset = (x - 0.5) * speed;
      const yOffset = (y - 0.5) * speed;
      orb.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    });
  });

  // ---- Skill tag hover ripple ----
  document.querySelectorAll('.skill-tag').forEach(tag => {
    tag.addEventListener('mouseenter', function () {
      this.style.transform = 'scale(1.05)';
    });
    tag.addEventListener('mouseleave', function () {
      this.style.transform = 'scale(1)';
    });
  });

  // ---- Project card tilt effect ----
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
  });

  // ---- Console greeting ----
  console.log(
    '%c👋 Hey there! Welcome to Abdellah\'s Portfolio',
    'color: #6c63ff; font-size: 16px; font-weight: bold;'
  );
  console.log(
    '%cBuilt with ❤️ and lots of ☕',
    'color: #00d4aa; font-size: 12px;'
  );

});
