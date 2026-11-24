/* Virtual Shop: accessible scroll reveal and restrained parallax */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealSelector = ".benefits > div, .section-head, .categories, .product-card, .promo > div";
  const observed = new WeakSet();

  function prepareReveal(root = document) {
    root.querySelectorAll(revealSelector).forEach((element, index) => {
      if (observed.has(element)) return;
      observed.add(element);
      element.setAttribute("data-vs-reveal", "");
      const siblings = element.parentElement ? [...element.parentElement.querySelectorAll(revealSelector)] : [];
      element.style.setProperty("--vs-reveal-delay", `${Math.min(siblings.indexOf(element), 5) * 75}ms`);
      if (reduceMotion || !("IntersectionObserver" in window)) {
        element.classList.add("vs-visible");
      } else {
        revealObserver.observe(element);
      }
    });
  }

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("vs-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -45px 0px" });

  function initParallax() {
    if (reduceMotion) return;
    const heroArt = document.querySelector(".hero-art");
    const promoSymbol = document.querySelector(".promo-symbol");
    if (!heroArt && !promoSymbol) return;
    let ticking = false;
    const update = () => {
      const y = window.scrollY || 0;
      if (heroArt) {
        const hero = heroArt.closest(".hero");
        const rect = hero ? hero.getBoundingClientRect() : null;
        if (rect && rect.bottom > 0 && rect.top < window.innerHeight) {
          heroArt.style.setProperty("--vs-parallax-y", `${Math.max(-16, Math.min(16, -rect.top * 0.035))}px`);
        }
      }
      if (promoSymbol) {
        const rect = promoSymbol.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          const offset = (rect.top - window.innerHeight * 0.5) * -0.035;
          promoSymbol.style.setProperty("--vs-parallax-y", `${Math.max(-13, Math.min(13, offset))}px`);
        }
      }
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  function init() {
    prepareReveal();
    const grid = document.getElementById("productGrid");
    if (grid && "MutationObserver" in window) {
      new MutationObserver(() => prepareReveal(grid)).observe(grid, { childList: true, subtree: true });
    }
    initParallax();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();