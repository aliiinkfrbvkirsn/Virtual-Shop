/* Virtual Shop — full-page scroll parallax, cursor depth and accessible reveals */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealSelector = ".benefits > div, .section-head, .categories, .product-card, .promo > div";
  const depthSelector = ".ambient, .hero-art, .hero-disc, .orbit-a, .orbit-b, .card-top, .card-bottom, .hero-cross, .benefits > div, .section-head, .categories, .product-card, .promo-symbol";
  const observed = new WeakSet();
  const depthNodes = new Set();

  function prepareReveal(root = document) {
    root.querySelectorAll(revealSelector).forEach(element => {
      if (observed.has(element)) return;
      observed.add(element);
      element.setAttribute("data-vs-reveal", "");
      const siblings = element.parentElement ? [...element.parentElement.querySelectorAll(revealSelector)] : [];
      element.style.setProperty("--vs-reveal-delay", `${Math.min(Math.max(siblings.indexOf(element), 0), 5) * 75}ms`);
      if (reduceMotion || !("IntersectionObserver" in window)) {
        element.classList.add("vs-visible");
      } else {
        revealObserver.observe(element);
      }
    });
  }

  function prepareDepth(root = document) {
    root.querySelectorAll(depthSelector).forEach(element => {
      if (element.hasAttribute("data-vs-depth")) return;
      element.setAttribute("data-vs-depth", "");
      depthNodes.add(element);
    });
  }

  const revealObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("vs-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -45px 0px" }) : null;

  function initScrollDepth() {
    if (reduceMotion) return;
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight || 700;
      const isMobile = window.matchMedia("(max-width: 850px)").matches;
      const mobileFactor = isMobile ? 0.58 : 1;
      const scrollY = window.scrollY || 0;

      depthNodes.forEach(element => {
        if (!element.isConnected) {
          depthNodes.delete(element);
          return;
        }
        const rect = element.getBoundingClientRect();
        if (rect.bottom < -160 || rect.top > vh + 160) return;

        let speed = Number(element.dataset.vsSpeed);
        if (!Number.isFinite(speed)) {
          if (element.matches(".ambient")) speed = element.classList.contains("ambient-one") ? -0.035 : 0.025;
          else if (element.matches(".hero-art,.promo-symbol")) speed = 0.105;
          else if (element.matches(".hero-disc,.orbit-a,.orbit-b,.card-top,.card-bottom,.hero-cross")) speed = 0.07;
          else if (element.matches(".product-card")) speed = 0.022;
          else if (element.matches(".benefits > div")) speed = 0.035;
          else speed = 0.028;
        }

        let offset;
        if (element.matches(".ambient")) {
          offset = Math.max(-38, Math.min(38, scrollY * speed));
        } else {
          const center = rect.top + rect.height * 0.5;
          offset = (vh * 0.5 - center) * speed;
          const limit = element.matches(".hero-art,.promo-symbol") ? 34 : element.matches(".product-card") ? 11 : 18;
          offset = Math.max(-limit, Math.min(limit, offset));
        }
        element.style.setProperty("--vs-parallax-y", `${(offset * mobileFactor).toFixed(2)}px`);
      });
      ticking = false;
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    update();
  }

  function initHeroPointerDepth() {
    if (reduceMotion || !window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    const hero = document.querySelector(".hero");
    const art = document.querySelector(".hero-art");
    if (!hero || !art) return;
    let frame = 0;
    hero.addEventListener("pointermove", event => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 24;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 24;
        art.style.setProperty("--vs-pointer-x", `${x.toFixed(2)}px`);
        art.style.setProperty("--vs-pointer-y", `${y.toFixed(2)}px`);
        frame = 0;
      });
    }, { passive: true });
    hero.addEventListener("pointerleave", () => {
      art.style.setProperty("--vs-pointer-x", "0px");
      art.style.setProperty("--vs-pointer-y", "0px");
    }, { passive: true });
  }

  function init() {
    prepareReveal();
    prepareDepth();
    const grid = document.getElementById("productGrid");
    if (grid && "MutationObserver" in window) {
      new MutationObserver(() => {
        prepareReveal(grid);
        prepareDepth(grid);
      }).observe(grid, { childList: true, subtree: true });
    }
    initScrollDepth();
    initHeroPointerDepth();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
