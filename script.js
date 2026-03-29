"use strict";

/* ==========================================================================
   ATELIER — Portfolio JavaScript
   Handles: theme toggle, navigation, scroll reveals, form submission,
   hero effects, active link tracking, mobile menu
   ========================================================================== */

(async function () {
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
     DATA-DRIVEN CONTENT RENDER
     -------------------------------------------------------------------------- */

  let portfolioData = null;

  async function loadPortfolioData() {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.data || typeof payload.data !== "object") {
        throw new Error("Invalid API payload");
      }
      return payload.data;
    } catch {
      return window.PORTFOLIO_DATA || null;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderActionButton(action) {
    const kindClass = action.kind === "ghost" ? "btn--ghost" : "btn--primary";
    const isDownload = action.download ? " download" : "";
    const target = action.targetBlank ? ' target="_blank" rel="noopener"' : "";
    const icon = action.download
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>`;

    return `<a href="${escapeHtml(action.href)}" class="btn ${kindClass}"${target}${isDownload}><span>${escapeHtml(action.label)}</span>${icon}</a>`;
  }

  function setSectionHeader(sectionId, sectionData) {
    if (!sectionData) return;
    const section = document.getElementById(sectionId);
    if (!section) return;
    const number = $(".section__number", section);
    const title = $(".section__title", section);
    if (number && sectionData.number) number.textContent = sectionData.number;
    if (title && sectionData.title) title.textContent = sectionData.title;
  }

  function initDynamicContent() {
    if (!portfolioData) return;

    // SEO metadata
    if (portfolioData.seo) {
      const seo = portfolioData.seo;
      if (seo.title) document.title = seo.title;
      const metaMap = {
        description: seo.description,
        keywords: seo.keywords,
        author: seo.author,
      };

      Object.entries(metaMap).forEach(([name, content]) => {
        if (!content) return;
        const tag = document.querySelector(`meta[name="${name}"]`);
        if (tag) tag.setAttribute("content", content);
      });

      const ogMap = {
        "og:title": seo.ogTitle,
        "og:description": seo.ogDescription,
        "og:type": seo.ogType,
        "og:url": seo.ogUrl,
      };

      Object.entries(ogMap).forEach(([property, content]) => {
        if (!content) return;
        const tag = document.querySelector(`meta[property="${property}"]`);
        if (tag) tag.setAttribute("content", content);
      });
    }

    // Navigation and mobile menu
    if (portfolioData.nav?.links?.length) {
      const navLinksEl = $("#navLinks");
      const mobileNavEl = $("#mobileMenuNav");
      const linksMarkup = portfolioData.nav.links
        .map(
          (item) =>
            `<a href="${escapeHtml(item.href)}" class="nav__link">${escapeHtml(item.label)}</a>`,
        )
        .join("");
      const mobileLinksMarkup = portfolioData.nav.links
        .map(
          (item) =>
            `<a href="${escapeHtml(item.href)}" class="mobile-menu__link">${escapeHtml(item.label)}</a>`,
        )
        .join("");

      if (navLinksEl) navLinksEl.innerHTML = linksMarkup;
      if (mobileNavEl) mobileNavEl.innerHTML = mobileLinksMarkup;

      const mobileFooter = $("#mobileMenuFooter");
      if (mobileFooter && portfolioData.nav.mobileFooterLinks?.length) {
        mobileFooter.innerHTML = portfolioData.nav.mobileFooterLinks
          .map(
            (item) =>
              `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener">${escapeHtml(item.label)}</a>`,
          )
          .join("");
      }
    }

    if (portfolioData.nav?.logoText) {
      const logoEls = $$(".nav__logo, .mobile-menu__logo");
      logoEls.forEach((el) => {
        el.innerHTML = `<span id="nav__logo_text">${escapeHtml(portfolioData.nav.logoText)}</span><span class="accent-dot">.</span>`;
      });
    }

    // Hero section
    if (portfolioData.hero) {
      const hero = portfolioData.hero;
      const heroEyebrow = $(".hero__eyebrow");
      if (heroEyebrow && hero.eyebrow?.length >= 2) {
        heroEyebrow.innerHTML = `<span>${escapeHtml(hero.eyebrow[0])}</span><span class="hero__eyebrow-sep">&amp;</span><span>${escapeHtml(hero.eyebrow[1])}</span>`;
      }

      const heroLines = $$(".hero__title-line");
      if (heroLines[0] && hero.firstName)
        heroLines[0].textContent = hero.firstName;
      if (heroLines[1] && hero.lastName)
        heroLines[1].textContent = hero.lastName;

      const heroTagline = $(".hero__tagline");
      if (heroTagline && hero.taglineLines?.length) {
        heroTagline.innerHTML = hero.taglineLines
          .map((line) => escapeHtml(line))
          .join("<br>");
      }

      const heroActions = $(".hero__actions");
      if (heroActions && hero.actions?.length) {
        heroActions.innerHTML = hero.actions.map(renderActionButton).join("");
      }

      const heroStats = $("#heroStats");
      if (heroStats && hero.stats?.length) {
        heroStats.innerHTML = hero.stats
          .map(
            (item, index) =>
              `<div class="hero__stat"><span class="hero__stat-num">${escapeHtml(item.value)}</span><span class="hero__stat-label">${escapeHtml(item.label)}</span></div>${index < hero.stats.length - 1 ? '<div class="hero__stat-divider" aria-hidden="true"></div>' : ""}`,
          )
          .join("");
      }

      const heroSocial = $(".hero__social");
      if (heroSocial && hero.socialLinks?.length) {
        heroSocial.innerHTML = hero.socialLinks
          .map(
            (item) =>
              `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener" aria-label="${escapeHtml(item.label)}"><span class="hero__social-text">${escapeHtml(item.short)}</span><i class="hero__social-icon ${escapeHtml(item.iconClass)}" aria-hidden="true"></i></a>`,
          )
          .join("");
      }

      const scrollText = $(".hero__scroll span");
      if (scrollText && hero.scrollText)
        scrollText.textContent = hero.scrollText;
    }

    // Shared section headers
    if (portfolioData.sections) {
      setSectionHeader("origin", portfolioData.sections.origin);
      setSectionHeader("about", portfolioData.sections.about);
      setSectionHeader("skills", portfolioData.sections.skills);
      setSectionHeader("work", portfolioData.sections.work);
      setSectionHeader("journey", portfolioData.sections.journey);
      setSectionHeader("contact", portfolioData.sections.contact);
    }

    // Origin section
    if (portfolioData.origin) {
      const originLede = $(".origin__lede");
      if (originLede && portfolioData.origin.lede) {
        originLede.textContent = portfolioData.origin.lede;
      }

      const cardsWrap = $("#originCards");
      if (cardsWrap && portfolioData.origin.cards?.length) {
        const classNames = ["one", "two", "three", "four"];
        cardsWrap.innerHTML = portfolioData.origin.cards
          .map(
            (card, index) =>
              `<article class="origin-card origin-card--${classNames[index] || "one"}"><p class="origin-card__kicker">${escapeHtml(card.kicker)}</p><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.desc)}</p></article>`,
          )
          .join("");
      }
    }

    // About section
    if (portfolioData.about) {
      const about = portfolioData.about;
      const aboutQuote = $(".about__quote");
      if (aboutQuote && about.quote) aboutQuote.textContent = about.quote;

      const aboutIntro = $(".about__intro");
      if (aboutIntro && about.intro) aboutIntro.textContent = about.intro;

      const aboutText = $(".about__text");
      if (aboutText && about.textHTML) aboutText.innerHTML = about.textHTML;

      const aboutColumns = $(".about__columns");
      if (aboutColumns && about.columns?.length) {
        aboutColumns.innerHTML = about.columns
          .map(
            (col) =>
              `<div class="about__col"><h3 class="about__col-title">${escapeHtml(col.title)}</h3><ul class="about__list">${(
                col.items || []
              )
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join("")}</ul></div>`,
          )
          .join("");
      }

      const aboutActions = $(".about__actions");
      if (aboutActions && about.actions?.length) {
        aboutActions.innerHTML = about.actions.map(renderActionButton).join("");
      }
    }

    // Skills section
    if (portfolioData.skills) {
      const marqueeTrack = $("#skillsMarqueeTrack");
      if (marqueeTrack && portfolioData.skills.marquee?.length) {
        const base = portfolioData.skills.marquee;
        const renderSet = (items, hidden = false) =>
          items
            .map(
              (item) =>
                `<span class="marquee__item"${hidden ? ' aria-hidden="true"' : ""}>${escapeHtml(item)}</span><span class="marquee__sep"${hidden ? ' aria-hidden="true"' : ""}>/</span>`,
            )
            .join("");
        marqueeTrack.innerHTML = `${renderSet(base)}${renderSet(base, true)}`;
      }

      const skillsGrid = $("#skillsGrid");
      if (skillsGrid && portfolioData.skills.groups?.length) {
        skillsGrid.innerHTML = portfolioData.skills.groups
          .map(
            (group) =>
              `<div class="skill-group" data-reveal><h3 class="skill-group__title">${escapeHtml(group.title)}</h3><ul class="skill-group__list">${(
                group.items || []
              )
                .map(
                  (item) =>
                    `<li><span>${escapeHtml(item.name)}</span>${item.iconHTML || ""}</li>`,
                )
                .join("")}</ul></div>`,
          )
          .join("");
      }
    }

    // Work section
    if (portfolioData.work) {
      const projects = $("#projectsList");
      if (projects && portfolioData.work.projects?.length) {
        projects.innerHTML = portfolioData.work.projects
          .map(
            (project) =>
              `<article class="project${project.reverse ? " project--reverse" : ""}" data-reveal><a href="${escapeHtml(project.liveDemo)}" class="project__image" target="_blank" rel="noopener" data-demo-url="${escapeHtml(project.liveDemo)}" data-placeholder-src="${escapeHtml(project.placeholderSrc)}" data-placeholder-alt="${escapeHtml(project.placeholderAlt)}"><iframe class="project__preview" title="${escapeHtml(project.title)} live demo preview" loading="lazy" aria-hidden="true"></iframe><img src="${escapeHtml(project.placeholderSrc)}" alt="${escapeHtml(project.placeholderAlt)}" loading="lazy"><span class="project__image-overlay"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg></span></a><div class="project__info"><span class="project__number">${escapeHtml(project.number)}</span><h3 class="project__title">${escapeHtml(project.title)}</h3><p class="project__desc">${escapeHtml(project.desc)}</p><div class="project__tags">${(project.tags || []).map((tag) => `<span class="project__tag">${escapeHtml(tag)}</span>`).join("")}</div><div class="project__links"><a href="${escapeHtml(project.liveDemo)}" target="_blank" rel="noopener" class="project__link">Live Demo<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg></a><a href="${escapeHtml(project.sourceCode)}" target="_blank" rel="noopener" class="project__link">Source Code<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg></a></div></div></article>`,
          )
          .join("");
      }

      const viewAll = $(".view-all");
      if (viewAll && portfolioData.work.cta) {
        viewAll.href = portfolioData.work.cta.href;
        const text = $(".view-all__text", viewAll);
        if (text) text.textContent = portfolioData.work.cta.label;
      }
    }

    // Journey section
    if (portfolioData.journey) {
      const timeline = $("#educationTimeline");
      if (timeline && portfolioData.journey.education?.length) {
        timeline.innerHTML = portfolioData.journey.education
          .map(
            (item) =>
              `<div class="timeline__item"><div class="timeline__dot" aria-hidden="true"></div><div class="timeline__content"><span class="timeline__date">${escapeHtml(item.date)}</span><h4 class="timeline__title">${escapeHtml(item.title)}</h4><p class="timeline__place">${escapeHtml(item.place)}</p><p class="timeline__detail">${escapeHtml(item.detail)}</p></div></div>`,
          )
          .join("");
      }

      const certs = $("#certsList");
      if (certs && portfolioData.journey.certifications?.length) {
        certs.innerHTML = portfolioData.journey.certifications
          .map((cert, index) => {
            const formId = cert.form ? `cert-form-${index + 1}` : "";
            const triggerAttrs = cert.form ? ` data-cert-form="${formId}"` : "";
            const formMarkup = cert.form
              ? `<form id="${formId}" action="${escapeHtml(cert.form.action)}" method="POST" style="display:none;"><input type="hidden" name="certificate_code" value="${escapeHtml(cert.form.certificateCode)}"><input type="hidden" name="code_data" value="${escapeHtml(cert.form.codeData)}"></form>`
              : "";

            return `<div class="cert"><span class="cert__icon" aria-hidden="true">&#9670;</span><a href="${escapeHtml(cert.href)}" class="cert__info"${triggerAttrs}><h4 class="cert__title">${escapeHtml(cert.title)}</h4><div class="cert__meta"><div class="cert__data"><span class="cert__id" aria-hidden="true">Cred.ID: ${escapeHtml(cert.credId)}</span><span class="cert__issuer">${escapeHtml(cert.issuer)}</span></div><span class="cert__date">${escapeHtml(cert.date)}</span></div></a>${formMarkup}</div>`;
          })
          .join("");
      }

      const interests = $("#interestsList");
      if (interests && portfolioData.journey.interests?.length) {
        interests.innerHTML = portfolioData.journey.interests
          .map(
            (item) =>
              `<div class="interest"><span class="interest__emoji">${escapeHtml(item.emoji)}</span><div><h4 class="interest__title">${escapeHtml(item.title)}</h4><p class="interest__desc">${escapeHtml(item.desc)}</p></div></div>`,
          )
          .join("");
      }
    }

    // Contact section
    if (portfolioData.contact) {
      const contact = portfolioData.contact;
      const lead = $(".contact__lead");
      if (lead && contact.lead) lead.textContent = contact.lead;

      const details = $("#contactDetails");
      if (details && contact.details?.length) {
        details.innerHTML = contact.details
          .map((item) => {
            const label = `<span class="contact__label"><i class="${escapeHtml(item.iconClass)}"></i> ${escapeHtml(item.label)}</span>`;
            // if (item.type === "address") {
            //   return `<div class="contact__item">${label}<address class="contact__value">${escapeHtml(item.value)}</address></div>`;
            // }
            return `<div class="contact__item">${label}<a href="${escapeHtml(item.href)}" class="contact__value contact__value--link">${escapeHtml(item.value)}</a></div>`;
          })
          .join("");
      }

      const socials = $("#contactSocials");
      if (socials && contact.socials?.length) {
        socials.innerHTML = contact.socials
          .map(
            (item) =>
              `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener"><i class="${escapeHtml(item.iconClass)}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></a>`,
          )
          .join("");
      }

      const formEl = $("#contactForm");
      if (formEl && contact.form) {
        formEl.action = contact.form.action || formEl.action;
        formEl.method = contact.form.method || formEl.method;
        const fieldsMarkup = (contact.form.fields || [])
          .map((field) => {
            if (field.type === "textarea") {
              return `<div class="form-group"><textarea name="${escapeHtml(field.name)}" id="${escapeHtml(field.id)}" ${field.required ? "required" : ""} placeholder=" " rows="${escapeHtml(field.rows || 4)}"></textarea><label for="${escapeHtml(field.id)}">${escapeHtml(field.label)}</label><div class="form-line"></div></div>`;
            }

            return `<div class="form-group"><input type="${escapeHtml(field.type)}" name="${escapeHtml(field.name)}" id="${escapeHtml(field.id)}" ${field.required ? "required" : ""} placeholder=" " autocomplete="${escapeHtml(field.autocomplete || "off")}"><label for="${escapeHtml(field.id)}">${escapeHtml(field.label)}</label><div class="form-line"></div></div>`;
          })
          .join("");

        formEl.innerHTML = `${fieldsMarkup}<button type="submit" class="btn btn--primary btn--full"><span>${escapeHtml(contact.form.submitLabel || "Send Message")}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></button><div class="form-response" id="formResponse"></div>`;
      }
    }

    // Footer
    if (portfolioData.footer) {
      const footerBrand = $(".footer__brand");
      if (footerBrand && portfolioData.footer.brand) {
        footerBrand.textContent = portfolioData.footer.brand;
      }

      const footerCopy = $(".footer__copy");
      if (footerCopy && portfolioData.footer.copy) {
        footerCopy.textContent = portfolioData.footer.copy;
      }

      const footerTop = $(".footer__top");
      if (footerTop) {
        if (portfolioData.footer.topHref)
          footerTop.href = portfolioData.footer.topHref;
        if (portfolioData.footer.topLabel)
          footerTop.textContent = portfolioData.footer.topLabel;
      }
    }
  }

  portfolioData = await loadPortfolioData();
  initDynamicContent();

  /* --------------------------------------------------------------------------
     PROJECT PREVIEWS — Live Demo with Placeholder Fallback
     -------------------------------------------------------------------------- */

  async function isDemoReachable(url, timeoutMs = 4500) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });

      return response.type === "opaque" || response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function initProjectPreviews() {
    const previewCards = $$(".project__image[data-demo-url]");
    if (!previewCards.length) return;

    await Promise.all(
      previewCards.map(async (card) => {
        const demoUrl = card.dataset.demoUrl;
        const placeholderSrc = card.dataset.placeholderSrc;
        const placeholderAlt =
          card.dataset.placeholderAlt || "Project preview placeholder";

        const iframe = $(".project__preview", card);
        const placeholderImage = $("img", card);

        if (placeholderImage && placeholderSrc) {
          placeholderImage.src = placeholderSrc;
          placeholderImage.alt = placeholderAlt;
        }

        if (!demoUrl || !iframe) return;

        const reachable = await isDemoReachable(demoUrl);

        if (reachable) {
          iframe.src = demoUrl;
          card.classList.add("is-live");
          return;
        }

        iframe.removeAttribute("src");
        card.classList.remove("is-live");
      }),
    );
  }

  initProjectPreviews();

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
    document.getElementById("codsoft-form")?.submit();
  }

  window.handleCertClick = handleCertClick;

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-cert-form]");
    if (!trigger) return;

    event.preventDefault();
    const formId = trigger.getAttribute("data-cert-form");
    if (!formId) return;
    const certForm = document.getElementById(formId);
    certForm?.submit();
  });

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
  const originTrack = $(".origin__track", originSection || document);
  const originScene = $("#originScene");
  const originCharge = $("#originCharge");
  const originCards = $$(".origin-card");
  const originTimelineItems = $$(".origin__timeline-item");
  const heroContainer = $(".hero__container");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const ORIGIN_SCROLL_CONFIG = {
    // Slightly above linear: keeps middle pacing deliberate and avoids early 100%.
    progressCurve: 1.05,
    // Dampening tuned for one-scroll completion without jitter.
    smoothingMs: 760,
    catchupGain: 0.52,
    maxCatchupBlend: 0.58,
    settleEpsilon: 0.001,
  };
  const isWindowsPlatform =
    /windows/i.test(navigator.userAgentData?.platform || "") ||
    /win/i.test(navigator.platform || "") ||
    /windows/i.test(navigator.userAgent || "");

  if (isWindowsPlatform) {
    document.documentElement.classList.add("is-windows");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toSegmentProgress(progress, start, end) {
    if (end <= start) return progress >= end ? 1 : 0;
    return clamp((progress - start) / (end - start), 0, 1);
  }

  function updateOriginChapter(progress) {
    const chapter = clamp(Math.floor(progress * 4), 0, 3);
    originScene?.style.setProperty("--origin-chapter", String(chapter));

    originTimelineItems.forEach((item, index) => {
      item.classList.toggle("is-active", index === chapter);
    });

    return chapter;
  }

  function updateScrollDepth(progress, heroProgress, displayProgress = progress) {
    const chapter = updateOriginChapter(progress);

    // Hero gets a subtle cinematic tilt based on page scroll.
    if (heroContainer) {
      heroContainer.style.transform = `translateZ(${30 - heroProgress * 34}px) rotateX(${8 - heroProgress * 9}deg)`;
      heroContainer.style.opacity = String(1 - heroProgress * 0.12);
    }

    if (!originSection || !originScene || !originCards.length) return;

    originScene.style.setProperty("--origin-p", progress.toFixed(4));

    const intensity = isWindowsPlatform ? 0.82 : 1;
    const mouseShiftX = Math.sin(progress * Math.PI * 2.4) * 20 * intensity;
    const mouseShiftY = Math.cos(progress * Math.PI * 1.7) * 14 * intensity;
    originScene.style.setProperty("--origin-shift-x", `${mouseShiftX}px`);
    originScene.style.setProperty("--origin-shift-y", `${mouseShiftY}px`);

    const cardTransforms = originCards.map((_, index) => {
      const start = 0.08 + index * 0.16;
      const end = start + 0.42;
      const local = toSegmentProgress(progress, start, end);
      const settle = toSegmentProgress(progress, end, Math.min(end + 0.2, 1));
      const side = index % 2 === 0 ? -1 : 1;

      const x = side * (205 - local * 212 + settle * 26);
      const y =
        (index < 2 ? -88 : 88) +
        (1 - local) * 30 * (index < 2 ? 1 : -1) -
        settle * 8;
      const z = -108 + local * 172 - settle * 22;
      const rx = (index < 2 ? 19 : -18) * (1 - local) + settle * 6;
      const ry = side * (20 - local * 30);
      const alpha = clamp(local * 1.12 + 0.08, 0.1, 1);

      return { x, y, z, rx, ry, alpha };
    });

    originCards.forEach((card, index) => {
      const cfg = cardTransforms[index] || cardTransforms[0];
      card.style.opacity = String(cfg.alpha);
      card.style.transform = `translate3d(${cfg.x.toFixed(1)}px, ${cfg.y.toFixed(1)}px, ${cfg.z.toFixed(1)}px) rotateX(${cfg.rx.toFixed(1)}deg) rotateY(${cfg.ry.toFixed(1)}deg)`;
      card.style.borderColor = `rgba(132, 167, 255, ${(0.24 + cfg.alpha * 0.52).toFixed(3)})`;
      card.style.boxShadow = `0 16px 30px rgba(2, 8, 26, ${(0.22 + cfg.alpha * 0.24).toFixed(3)})`;
    });

    if (originCharge) {
      const chargeProgress = clamp(displayProgress, 0, 1);
      const charge = Math.round(chargeProgress * 100);
      const labels = ["BOOT", "ALIGN", "FORGE", "LAUNCH"];
      const nextValue = `${charge}% ${labels[chapter]}`;
      if (originCharge.dataset.charge !== nextValue) {
        originCharge.textContent = nextValue;
        originCharge.dataset.charge = nextValue;
      }
    }
  }

  let depthRaf = null;
  let lastTick = 0;
  let currentOriginProgress = 0;
  let currentHeroProgress = 0;
  let targetOriginProgress = 0;
  let targetHeroProgress = 0;

  function computeTargets() {
    const viewportHeight = window.innerHeight || 1;
    targetHeroProgress = clamp(window.scrollY / viewportHeight, 0, 1);

    if (!originTrack) {
      targetOriginProgress = 0;
      return;
    }

    const rect = originTrack.getBoundingClientRect();
    const stickyHeight = originScene?.getBoundingClientRect().height || viewportHeight;
    const stickyTop = parseFloat(getComputedStyle(originScene).top) || 0;
    const total = rect.height - stickyHeight;
    if (total <= 0) {
      targetOriginProgress = 0;
      return;
    }

    // Progress starts when track top reaches sticky top, and ends at sticky release point.
    const rawProgress = clamp((stickyTop - rect.top) / total, 0, 1);
    if (rect.bottom <= stickyTop + stickyHeight + 1) {
      targetOriginProgress = 1;
      return;
    }

    // Snap near-end values to full progress so section release happens after 100%.
    if (rawProgress >= 0.998) {
      targetOriginProgress = 1;
      return;
    }

    targetOriginProgress = clamp(
      Math.pow(rawProgress, ORIGIN_SCROLL_CONFIG.progressCurve),
      0,
      1,
    );
  }

  function animateDepth(ts) {
    if (!lastTick) lastTick = ts;
    const delta = ts - lastTick;
    lastTick = ts;

    const baseBlend =
      1 - Math.pow(0.001, delta / ORIGIN_SCROLL_CONFIG.smoothingMs);
    const distance = Math.max(
      Math.abs(targetOriginProgress - currentOriginProgress),
      Math.abs(targetHeroProgress - currentHeroProgress),
    );
    const catchupBlend = clamp(
      distance * ORIGIN_SCROLL_CONFIG.catchupGain,
      0,
      ORIGIN_SCROLL_CONFIG.maxCatchupBlend,
    );
    const blend = clamp(baseBlend + catchupBlend, 0, 0.9);
    currentOriginProgress += (targetOriginProgress - currentOriginProgress) * blend;
    currentHeroProgress += (targetHeroProgress - currentHeroProgress) * blend;

    updateScrollDepth(
      currentOriginProgress,
      currentHeroProgress,
      targetOriginProgress,
    );

    const stillMoving =
      Math.abs(targetOriginProgress - currentOriginProgress) >
        ORIGIN_SCROLL_CONFIG.settleEpsilon ||
      Math.abs(targetHeroProgress - currentHeroProgress) >
        ORIGIN_SCROLL_CONFIG.settleEpsilon;

    if (stillMoving) {
      depthRaf = requestAnimationFrame(animateDepth);
      return;
    }

    currentOriginProgress = targetOriginProgress;
    currentHeroProgress = targetHeroProgress;
    updateScrollDepth(
      currentOriginProgress,
      currentHeroProgress,
      currentOriginProgress,
    );
    depthRaf = null;
  }

  function requestDepthUpdate() {
    computeTargets();
    if (prefersReducedMotion) {
      currentOriginProgress = targetOriginProgress;
      currentHeroProgress = targetHeroProgress;
      updateScrollDepth(currentOriginProgress, currentHeroProgress);
      return;
    }

    if (!depthRaf) {
      depthRaf = requestAnimationFrame(animateDepth);
    }
  }

  window.addEventListener("scroll", requestDepthUpdate, { passive: true });
  window.addEventListener("resize", requestDepthUpdate);
  requestDepthUpdate();
})();
