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

(() => {
  const mount = document.getElementById("markdown-content");
  if (!mount) return;

  const allowedDocs = new Map([
    ["obsidian-vault/00-index.md", "Obsidian Vault: A Field Guide"],
    ["obsidian-vault/01-robotics-ros-navigation.md", "The Robot Is Not An Algorithm"],
    ["obsidian-vault/02-ai-coding-and-platforms.md", "AI Is A Workflow, Not A Shortcut"],
    ["obsidian-vault/03-company-career-and-principles.md", "A Company Is A Machine For Preserving Experience"],
    ["obsidian-vault/04-content-life-and-misc.md", "Life Notes Are Raw Material"],
    ["obsidian-vault/05-daily-notes-and-plans.md", "Daily Notes Are A Black Box Recorder"],
    ["obsidian-vault/06-source-inventory.md", "Source Inventory Without Links"],
  ]);

  const params = new URLSearchParams(window.location.search);
  const fallback = mount.dataset.docDefault || "obsidian-vault/00-index.md";
  const requested = params.get("doc") || fallback;
  const doc = allowedDocs.has(requested) ? requested : fallback;
  const title = allowedDocs.get(doc) || "Markdown Reader";
  const titleEl = document.getElementById("reader-title");
  const rawLink = document.getElementById("raw-link");

  if (titleEl) titleEl.textContent = title;
  if (rawLink) rawLink.href = `notes/${doc}`;

  fetch(`notes/${doc}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Unable to load ${doc}`);
      return res.text();
    })
    .then((text) => {
      mount.innerHTML = renderMarkdown(text);
      document.title = `${title} | Thinking Library`;
    })
    .catch(() => {
      mount.innerHTML = "<h1>Document unavailable</h1><p>The requested markdown file could not be loaded.</p>";
    });

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
})();
