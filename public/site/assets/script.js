(() => {
  const DATA = window.THINKING_LIBRARY;
  if (!DATA) return;

  const supported = ["zh", "en"];
  const page = document.body?.dataset.page || "home";

  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const readLang = () => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("lang");
    if (supported.includes(requested)) return requested;
    const stored = window.localStorage?.getItem(DATA.storageKey);
    if (supported.includes(stored)) return stored;
    const legacyStored = window.localStorage?.getItem(DATA.legacyStorageKey);
    if (supported.includes(legacyStored)) return legacyStored;
    return "zh";
  };

  let lang = readLang();

  function persistLang(nextLang) {
    if (!supported.includes(nextLang)) return;
    window.localStorage?.setItem(DATA.storageKey, nextLang);
    if (DATA.legacyStorageKey) {
      window.localStorage?.removeItem(DATA.legacyStorageKey);
    }
  }

  function common() {
    return DATA.common[lang] || DATA.common.zh;
  }

  function localizeShell() {
    const copy = common();
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-copy]").forEach((el) => {
      const key = el.dataset.copy;
      if (copy[key]) el.textContent = copy[key];
    });
    document.querySelectorAll("[data-lang-set]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.langSet === lang);
      button.setAttribute("aria-pressed", button.dataset.langSet === lang ? "true" : "false");
      const label = button.dataset.langLabel;
      if (label && copy[label]) button.textContent = copy[label];
    });
  }

  function setLang(nextLang) {
    if (!supported.includes(nextLang) || nextLang === lang) return;
    lang = nextLang;
    persistLang(lang);
    renderPage();
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== DATA.storageKey || !supported.includes(event.newValue) || event.newValue === lang) return;
    lang = event.newValue;
    renderPage();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang-set]");
    if (!button) return;
    event.preventDefault();
    setLang(button.dataset.langSet);
  });

  function renderArchiveLinks(container, compact = false) {
    if (!container) return;
    container.innerHTML = DATA.archive.docs
      .map((doc) => {
        const title = lang === "zh" ? doc.zhTitle : doc.enTitle;
        if (compact) {
          return `<a class="sidebar-item" href="reader.html?doc=${encodeURIComponent(doc.id)}">${escapeHtml(title)}</a>`;
        }
        const kind = lang === "zh" ? doc.zhKind : doc.enKind;
        const desc = lang === "zh" ? doc.zhDesc : doc.enDesc;
        return `
          <a class="doc-card ${doc.color}" href="reader.html?doc=${encodeURIComponent(doc.id)}">
            <span class="doc-kind">${escapeHtml(kind)}</span>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(desc)}</p>
          </a>
        `;
      })
      .join("");
  }

  function renderHome() {
    const copy = DATA.home[lang];
    const cover = document.getElementById("home-cover");
    const grid = document.getElementById("home-feature-grid");
    const sectionsTitle = document.getElementById("home-sections-title");
    const sections = document.getElementById("home-sections");

    document.title = `${common().library} | Zhaxiaoji Studio`;
    renderArchiveLinks(document.getElementById("archive-sidebar"), true);

    if (cover) {
      cover.innerHTML = `
        <section class="cover-story">
          <div>
            <div class="cover-kicker">${escapeHtml(copy.kicker)}</div>
            <h1 class="cover-title">${escapeHtml(copy.title)}</h1>
            <p class="cover-dek">${escapeHtml(copy.dek)}</p>
            <p class="cover-meta">${escapeHtml(copy.meta)}</p>
            <div class="cover-actions">
              <a class="primary-pill primary" href="essay.html">${escapeHtml(copy.primary)}</a>
              <a class="primary-pill" href="views.html">${escapeHtml(copy.secondary)}</a>
              <a class="primary-pill" href="reader.html">${escapeHtml(copy.archiveCta)}</a>
            </div>
          </div>
          <aside class="issue-label">
            <strong>${escapeHtml(common().issue)}</strong>
            ${escapeHtml(common().library)}
          </aside>
        </section>
      `;
    }

    if (grid) {
      grid.innerHTML = copy.cards
        .map((card) => `
          <article class="feature-card">
            <div class="card-kicker">${escapeHtml(card.label)}</div>
            <h2>${escapeHtml(card.title)}</h2>
            <p>${escapeHtml(card.body)}</p>
          </article>
        `)
        .join("");
    }

    if (sectionsTitle) sectionsTitle.textContent = copy.sectionsTitle;
    if (sections) {
      sections.innerHTML = copy.sections
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
    }
  }

  function renderEssay() {
    const essay = DATA.essay[lang];
    const root = document.getElementById("essay-root");
    const toc = document.getElementById("essay-toc");
    document.title = `${essay.title} | ${common().library}`;

    if (toc) {
      toc.innerHTML = `
        <strong>${escapeHtml(common().issue)}</strong>
        ${essay.sections.map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`).join("")}
      `;
    }

    if (!root) return;
    root.innerHTML = `
      <header class="article-header">
        <div class="essay-kicker">${escapeHtml(common().library)}</div>
        <h1 class="article-title">${escapeHtml(essay.title)}</h1>
        <p class="article-subtitle">${escapeHtml(essay.subtitle)}</p>
        <div class="article-meta">${escapeHtml(essay.byline)} · ${escapeHtml(essay.date)}</div>
      </header>
      <p class="standfirst">${escapeHtml(essay.standfirst)}</p>
      <aside class="pull-quote">${escapeHtml(essay.pullQuote)}</aside>
      ${essay.sections.map((section, index) => renderEssaySection(section, index === 0)).join("")}
    `;
  }

  function renderEssaySection(section, first) {
    return `
      <section class="article-section ${first ? "first" : ""}" id="${escapeHtml(section.id)}">
        <div class="section-label">${escapeHtml(section.label)}</div>
        <h2>${escapeHtml(section.title)}</h2>
        ${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        ${section.quote ? `<blockquote class="section-quote">${escapeHtml(section.quote)}</blockquote>` : ""}
      </section>
    `;
  }

  function renderViews() {
    const views = DATA.views[lang];
    const title = document.getElementById("views-title");
    const subtitle = document.getElementById("views-subtitle");
    const grid = document.getElementById("views-grid");

    document.title = `${views.title} | ${common().library}`;
    if (title) title.textContent = views.title;
    if (subtitle) subtitle.textContent = views.subtitle;
    if (!grid) return;

    grid.innerHTML = views.cards
      .map(([cardTitle, body], index) => `
        <article class="argument-card reveal">
          <div class="number">${String(index + 1).padStart(2, "0")}</div>
          <h2>${escapeHtml(cardTitle)}</h2>
          <p>${escapeHtml(body)}</p>
        </article>
      `)
      .join("");
  }

  function renderReader() {
    const mount = document.getElementById("markdown-content");
    if (!mount) return;

    const nav = document.getElementById("reader-nav");
    const params = new URLSearchParams(window.location.search);
    const fallback = mount.dataset.docDefault || "obsidian-vault/00-index.md";
    const allowed = new Set(DATA.archive.docs.map((doc) => doc.id));
    const requested = params.get("doc") || fallback;
    const docId = allowed.has(requested) ? requested : fallback;
    const docMeta = DATA.archive.docs.find((doc) => doc.id === docId) || DATA.archive.docs[0];
    const title = lang === "zh" ? docMeta.zhTitle : docMeta.enTitle;
    const titleEl = document.getElementById("reader-title");
    const rawLink = document.getElementById("raw-link");

    document.title = `${title} | ${common().library}`;
    if (titleEl) titleEl.textContent = title;
    if (rawLink) rawLink.href = `notes/${docId}`;

    if (nav) {
      nav.innerHTML = `
        <strong>${escapeHtml(common().archive)}</strong>
        ${DATA.archive.docs.map((doc) => {
          const itemTitle = lang === "zh" ? doc.zhTitle : doc.enTitle;
          const active = doc.id === docId ? "active" : "";
          return `<a class="${active}" href="reader.html?doc=${encodeURIComponent(doc.id)}">${escapeHtml(itemTitle)}</a>`;
        }).join("")}
      `;
    }

    mount.innerHTML = `<p>${escapeHtml(common().loading)}</p>`;

    const localizedMarkdown = DATA.archive[`${lang}Markdown`]?.[docId];
    if (localizedMarkdown) {
      mount.innerHTML = renderMarkdown(localizedMarkdown);
      return;
    }

    fetch(`notes/${docId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Unable to load ${docId}`);
        return res.text();
      })
      .then((text) => {
        mount.innerHTML = renderMarkdown(text);
      })
      .catch(() => {
        mount.innerHTML = `<h1>${escapeHtml(common().unavailable)}</h1><p>${escapeHtml(common().unavailableBody)}</p>`;
      });
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function renderMarkdown(source) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let list = null;
    let quote = [];
    let inCode = false;
    let code = [];

    const flushParagraph = () => {
      if (paragraph.length === 0) return;
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    };

    const flushList = () => {
      if (!list) return;
      html.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`);
      list = null;
    };

    const flushQuote = () => {
      if (quote.length === 0) return;
      html.push(`<blockquote>${quote.map((item) => `<p>${inline(item)}</p>`).join("")}</blockquote>`);
      quote = [];
    };

    const flushCode = () => {
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      code = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      if (line.startsWith("```")) {
        flushParagraph();
        flushList();
        flushQuote();
        if (inCode) flushCode();
        inCode = !inCode;
        continue;
      }

      if (inCode) {
        code.push(rawLine);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        flushQuote();
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        flushQuote();
        const level = heading[1].length;
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        continue;
      }

      if (line.startsWith("> ")) {
        flushParagraph();
        flushList();
        quote.push(line.slice(2));
        continue;
      }

      const ordered = line.match(/^\d+\.\s+(.+)$/);
      const unordered = line.match(/^[-*]\s+(.+)$/);
      if (ordered || unordered) {
        flushParagraph();
        flushQuote();
        const type = ordered ? "ol" : "ul";
        if (!list || list.type !== type) {
          flushList();
          list = { type, items: [] };
        }
        list.items.push((ordered || unordered)[1]);
        continue;
      }

      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    flushQuote();
    if (inCode) flushCode();

    return html.join("\n");
  }

  function initReveal() {
    const els = Array.from(document.querySelectorAll(".reveal"));
    if (els.length === 0) return;

    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      },
      { root: null, threshold: 0.08 }
    );

    els.forEach((el) => {
      el.classList.remove("is-visible");
      io.observe(el);
    });
  }

  function renderPage() {
    persistLang(lang);
    localizeShell();
    if (page === "home") renderHome();
    if (page === "essay") renderEssay();
    if (page === "views") renderViews();
    if (page === "reader") renderReader();
    initReveal();
  }

  renderPage();
})();
