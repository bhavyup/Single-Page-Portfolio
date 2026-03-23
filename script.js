"use strict";

/* ==========================================================================
   ATELIER — Portfolio JavaScript
   Handles: theme toggle, navigation, scroll reveals, form submission,
   hero effects, active link tracking, mobile menu
   ========================================================================== */

(function () {
  /* --------------------------------------------------------------------------
     UTILITIES
     -------------------------------------------------------------------------- */

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* --------------------------------------------------------------------------
     THEME TOGGLE
     -------------------------------------------------------------------------- */

  const themeToggle = $("#themeToggle");
  const STORAGE_KEY = "portfolio-theme";

  function setTheme(theme) {
    document.body.classList.toggle("light-theme", theme === "light");
    localStorage.setItem(STORAGE_KEY, theme);

    // Update meta theme-color
    const metaTheme = $('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        "content",
        theme === "light" ? "#F4EDE6" : "#0D0D0C",
      );
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setTheme(saved);
    } else {
      // Respect system preference
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }

  themeToggle?.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("light-theme");
    setTheme(isDark ? "light" : "dark");
  });

  initTheme();

  /* --------------------------------------------------------------------------
     NAVIGATION — Scroll Effect & Active Link
     -------------------------------------------------------------------------- */

  const nav = $("#nav");
  const navLinks = $$(".nav__link");
  const sections = $$(".section, .hero");

  function updateNav() {
    // Scrolled state
    if (nav) {
      nav.classList.toggle("scrolled", window.scrollY > 40);
    }

    // Active link
    const scrollPos = window.scrollY + window.innerHeight * 0.35;

    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      if (section.offsetTop <= scrollPos) {
        const id = section.getAttribute("id");
        navLinks.forEach((link) => {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === `#${id}`,
          );
        });
        break;
      }
    }
  }

  window.addEventListener("scroll", updateNav, { passive: true });
  updateNav();

  /* --------------------------------------------------------------------------
     MOBILE MENU
     -------------------------------------------------------------------------- */

  const burger = $("#navBurger");
  const mobileMenu = $("#mobileMenu");
  const mobileLinks = $$(".mobile-menu__link");

  function toggleMenu(open) {
    const isOpen =
      typeof open === "boolean"
        ? open
        : !mobileMenu?.classList.contains("open");

    burger?.classList.toggle("open", isOpen);
    mobileMenu?.classList.toggle("open", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    burger?.setAttribute("aria-expanded", String(isOpen));
  }

  burger?.addEventListener("click", () => toggleMenu());

  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => toggleMenu(false));
  });

  // Close on escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileMenu?.classList.contains("open")) {
      toggleMenu(false);
    }
  });

  /* --------------------------------------------------------------------------
     SCROLL REVEAL — IntersectionObserver
     -------------------------------------------------------------------------- */

  function initReveal() {
    const revealElements = $$("[data-reveal]");

    if (!revealElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    revealElements.forEach((el) => observer.observe(el));
  }

  // Run after a tiny delay to allow the initial paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initReveal();
    });
  });

  /* --------------------------------------------------------------------------
     HERO — Mouse-Following Glow
     -------------------------------------------------------------------------- */

  const hero = $(".hero");
  const heroGlow = $(".hero__glow");

  if (hero && heroGlow) {
    let rafId = null;
    let targetX = 50;
    let targetY = 50;
    let currentX = 50;
    let currentY = 50;

    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width) * 100;
      targetY = ((e.clientY - rect.top) / rect.height) * 100;

      if (!rafId) {
        rafId = requestAnimationFrame(animateGlow);
      }
    });

    function animateGlow() {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      hero.style.setProperty("--mouse-x", `${currentX}%`);
      hero.style.setProperty("--mouse-y", `${currentY}%`);

      if (
        Math.abs(targetX - currentX) > 0.1 ||
        Math.abs(targetY - currentY) > 0.1
      ) {
        rafId = requestAnimationFrame(animateGlow);
      } else {
        rafId = null;
      }
    }

    // Reset on mouse leave
    hero.addEventListener("mouseleave", () => {
      targetX = 50;
      targetY = 50;
      if (!rafId) {
        rafId = requestAnimationFrame(animateGlow);
      }
    });
  }

  /* --------------------------------------------------------------------------
     SMOOTH SCROLL — Anchor Links
     -------------------------------------------------------------------------- */

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      if (targetId === "#") return;

      const target = $(targetId);
      if (!target) return;

      e.preventDefault();

      const navHeight =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--nav-height",
          ),
        ) || 72;
      const top =
        target.getBoundingClientRect().top + window.scrollY - navHeight;

      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  /* --------------------------------------------------------------------------
     CONTACT FORM — AJAX Submission
     -------------------------------------------------------------------------- */

  const form = $("#contactForm");
  const formResponse = $("#formResponse");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.innerHTML;

    // Loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "<span>Sending...</span>";
    }

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        form.reset();
        if (formResponse) {
          formResponse.textContent = "Message sent successfully!";
          formResponse.className = "form-response success";
        }
      } else {
        const data = await response.json().catch(() => ({}));
        if (formResponse) {
          formResponse.textContent =
            data.error || "Something went wrong. Please try again.";
          formResponse.className = "form-response error";
        }
      }
    } catch {
      if (formResponse) {
        formResponse.textContent = "Network error. Please try again later.";
        formResponse.className = "form-response error";
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }

      // Clear response after 5s
      setTimeout(() => {
        if (formResponse) {
          formResponse.textContent = "";
          formResponse.className = "form-response";
        }
      }, 5000);
    }
  });

  /* --------------------------------------------------------------------------
     MARQUEE — Pause on Hover (already via CSS), duplicate-check
     -------------------------------------------------------------------------- */

  document.addEventListener("visibilitychange", () => {
    const marqueeTrack = $(".marquee__track");
    if (marqueeTrack) {
      marqueeTrack.style.animationPlayState = document.hidden
        ? "paused"
        : "running";
    }
  });

  /* --------------------------------------------------------------------------
     CUSTOM CURSOR
     -------------------------------------------------------------------------- */

  const cursorEl = $("#cursor");
  const cursorDot = cursorEl?.querySelector(".cursor__dot");
  const cursorRing = cursorEl?.querySelector(".cursor__ring");

  // Only run on pointer-fine devices
  if (cursorEl && window.matchMedia("(pointer: fine)").matches) {
    let dotX = 0,
      dotY = 0;
    let ringX = 0,
      ringY = 0;
    let mouseX = 0,
      mouseY = 0;
    let rafCursor = null;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!rafCursor) rafCursor = requestAnimationFrame(moveCursor);
    });

    function moveCursor() {
      // Dot follows instantly
      dotX = mouseX;
      dotY = mouseY;

      // Ring follows with lerp for smooth trailing
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;

      if (cursorDot) cursorDot.style.cssText = `left:${dotX}px;top:${dotY}px;`;
      if (cursorRing)
        cursorRing.style.cssText = `left:${ringX}px;top:${ringY}px;`;

      if (Math.abs(mouseX - ringX) > 0.3 || Math.abs(mouseY - ringY) > 0.3) {
        rafCursor = requestAnimationFrame(moveCursor);
      } else {
        rafCursor = null;
      }
    }

    // Hover state on interactive elements
    const hoverTargets =
      "a, button, .project__image, .skill-group, .view-all, input, textarea, label";

    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(hoverTargets)) {
        cursorEl.classList.add("is-hovering");
      }
    });

    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(hoverTargets)) {
        cursorEl.classList.remove("is-hovering");
      }
    });

    // Click feedback
    document.addEventListener("mousedown", () =>
      cursorEl.classList.add("is-clicking"),
    );
    document.addEventListener("mouseup", () =>
      cursorEl.classList.remove("is-clicking"),
    );

    // Hide when leaving window
    document.addEventListener("mouseleave", () => {
      cursorEl.style.opacity = "0";
    });
    document.addEventListener("mouseenter", () => {
      cursorEl.style.opacity = "1";
    });
  }

  function handleCertClick(event) {
    event.preventDefault();

    document.getElementById("codsoft-form").submit();
  }

  document.getElementById("codsoft-cert")?.addEventListener("click", handleCertClick);

  /* --------------------------------------------------------------------------
     HERO TITLE — Clip Reveal Trigger
     -------------------------------------------------------------------------- */

  // The hero title uses CSS clip animation triggered when element has .revealed
  // The data-reveal observer adds .revealed, the CSS animation handles the rest
  // (Already wired via [data-reveal] IntersectionObserver above)

  /* --------------------------------------------------------------------------
     STATS — Animated Count-Up
     -------------------------------------------------------------------------- */

  function animateCount(el, target, duration = 1600) {
    const suffix = el.textContent.replace(/[\d]/g, "");
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const current = Math.round(eased * parseFloat(target));
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const statNums = $$(".hero__stat-num");
  if (statNums.length) {
    const statsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            statNums.forEach((el) => {
              const raw = el.textContent;
              const num = parseFloat(raw);
              if (!isNaN(num)) animateCount(el, num);
            });
            statsObserver.disconnect();
          }
        });
      },
      { threshold: 0.5 },
    );

    const statsContainer = $(".hero__stats");
    if (statsContainer) statsObserver.observe(statsContainer);
  }

  /* --------------------------------------------------------------------------
     SCROLL 3D — ORIGIN SEQUENCE
     -------------------------------------------------------------------------- */

  const originSection = $("#origin");
  const originScene = $("#originScene");
  const originCharge = $("#originCharge");
  const originCards = $$(".origin-card");
  const heroContainer = $(".hero__container");

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function updateScrollDepth() {
    const viewportHeight = window.innerHeight || 1;

    // Hero gets a subtle cinematic tilt based on page scroll.
    if (heroContainer) {
      const heroProgress = clamp(window.scrollY / viewportHeight, 0, 1);
      heroContainer.style.transform = `translateZ(${40 - heroProgress * 50}px) rotateX(${10 - heroProgress * 12}deg)`;
      heroContainer.style.opacity = String(1 - heroProgress * 0.2);
    }

    if (!originSection || !originScene || !originCards.length) return;

    const rect = originSection.getBoundingClientRect();
    const total = rect.height - viewportHeight;
    if (total <= 0) return;

    const progress = clamp(-rect.top / total, 0, 1);
    originScene.style.setProperty("--origin-p", progress.toFixed(4));

    const mouseShiftX = Math.sin(progress * Math.PI * 1.4) * 28;
    const mouseShiftY = Math.cos(progress * Math.PI * 1.8) * 18;
    originScene.style.setProperty("--origin-shift-x", `${mouseShiftX}px`);
    originScene.style.setProperty("--origin-shift-y", `${mouseShiftY}px`);

    const cardTransforms = [
      {
        x: -320 + progress * 360,
        y: -120 + progress * 80,
        z: -120 + progress * 180,
        rx: 18 - progress * 26,
        ry: -28 + progress * 32,
      },
      {
        x: 320 - progress * 370,
        y: -80 + progress * 70,
        z: -90 + progress * 160,
        rx: 16 - progress * 18,
        ry: 28 - progress * 32,
      },
      {
        x: -260 + progress * 280,
        y: 120 - progress * 150,
        z: -80 + progress * 170,
        rx: -12 + progress * 22,
        ry: -22 + progress * 20,
      },
      {
        x: 280 - progress * 300,
        y: 140 - progress * 170,
        z: -100 + progress * 190,
        rx: -14 + progress * 20,
        ry: 22 - progress * 24,
      },
    ];

    originCards.forEach((card, index) => {
      const cfg = cardTransforms[index] || cardTransforms[0];
      const alpha = clamp((progress - index * 0.08) * 1.7, 0, 1);
      card.style.opacity = String(0.12 + alpha * 0.88);
      card.style.transform = `translate3d(${cfg.x.toFixed(1)}px, ${cfg.y.toFixed(1)}px, ${cfg.z.toFixed(1)}px) rotateX(${cfg.rx.toFixed(1)}deg) rotateY(${cfg.ry.toFixed(1)}deg)`;
      card.style.borderColor = `rgba(255,255,255,${0.16 + alpha * 0.28})`;
    });

    if (originCharge) {
      originCharge.textContent = `${Math.round(progress * 100)}%`;
    }
  }

  let depthRaf = null;

  function requestDepthUpdate() {
    if (depthRaf) return;
    depthRaf = requestAnimationFrame(() => {
      updateScrollDepth();
      depthRaf = null;
    });
  }

  window.addEventListener("scroll", requestDepthUpdate, { passive: true });
  window.addEventListener("resize", requestDepthUpdate);
  requestDepthUpdate();
})();
