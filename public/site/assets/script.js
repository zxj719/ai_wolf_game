(() => {
  const els = Array.from(document.querySelectorAll(".reveal"));
  if (els.length === 0) return;

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    },
    { root: null, threshold: 0.08 }
  );

  els.forEach((el) => io.observe(el));
})();

