#!/usr/bin/env node
/**
 * 把 Tutorials4intern/docs/dayN.md 转成 public/robotics/dayN.html。
 *
 * 讲义 markdown 不是任意 markdown，而是一套固定的写法约定，
 * 每条约定都对应 assets/style.css 里已有的一个类：
 *
 *   > [!NOTE]            → <p class="callout">
 *   > [!WARNING]         → <p class="callout danger">
 *   > **阶段成果**        → <p class="milestone">（标题由 ::before 画，正文不重复写）
 *   **预期输出** + 代码块 → <div class="expected"><pre><code>
 *   - [ ] 条目           → <ul class="goals">（可勾选，进度存 localStorage）
 *   ## 课后回顾           → <ol class="quiz">（选项可点选）
 *
 * 用法：node scripts/robotics-md2html.mjs day3 day4 day5
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC_DIR = 'C:/Users/xingj/Documents/Tutorials4intern/docs';
const OUT_DIR = resolve(process.cwd(), 'public/robotics');

/** 侧栏与 index.html 逐字一致，改这里时记得同步 index.html。 */
const SIDEBAR = `<nav class="sidebar">
  <strong>ROS2 入门 · 第 1 周</strong>
  <a href="index.html">总览</a>
  <a href="day0.html">Day 0 · 课前预习</a>
  <a href="day1.html">Day 1 · 建包与话题</a>
  <a href="day2.html">Day 2 · 包结构与 launch</a>
  <a href="day3.html">Day 3 · 话题深入与实机</a>
  <a href="day4.html">Day 4 · Gazebo 与 URDF</a>
  <a href="day5.html">Day 5 · 综合考核</a>
</nav>`;

/** 章节 id：给锚点用。认得出的用语义名，认不出的退回 sec-N。 */
const SECTION_IDS = {
  今日目标: 'goals',
  今日全景与主线任务: 'overview',
  常见报错对照表: 'errors',
  课后回顾: 'review',
  延伸阅读: 'further',
  自检: 'selfcheck',
  今天要交什么: 'deliverable',
  '与 Day 4 的差别': 'diff',
  动手顺序: 'steps',
  惯量自查: 'inertia',
  常见丢分点: 'pitfalls',
  做完之后: 'next',
  'Python 补给站': 'python',
};

/**
 * 只存在于 HTML 里的手绘图。
 *
 * day0/1/2 的 markdown 是从当初手写的 HTML 反向转出来的，那次转换丢掉了内嵌
 * SVG，只在原地留下一段占位引用（`> **图：<名字>**` + 一段压平的 text 兜底）。
 * 直接按 markdown 重新生成会把图永久丢掉，所以这里按图名把原图接回去。
 * 图用 currentColor 上色，必须内联——走 <img> 就跟不了明暗主题了。
 *
 * 将来作者要是在 markdown 里重做了可视化，把占位段删掉即可，转换器自然不再插图。
 */
const HTML_ONLY_FIGURES = {
  'ament_python 包目录结构说明图': 'scripts/robotics-assets/day1-package-layout.svg',
};
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/**
 * 本日材料。文件由 scripts/robotics-materials.mjs 放进 public/robotics/files/。
 * exam 为 null 表示这天不计分、只有自检脚本。
 */
const MATERIALS = {
  day0: { exam: null, script: 'selfcheck_day0.py', scriptNote: '环境自检，四项全绿再进 Day 1' },
  day1: { exam: 'day1_exam.md', script: 'grade_day1.py', scriptNote: '限时计分，自己先跑一遍' },
  day2: { exam: 'day2_exam.md', script: 'grade_day2.py', scriptNote: '累加式计分，60 分及格' },
  day3: { exam: 'day3_exam.md', script: 'grade_day3.py', scriptNote: '累加式计分，60 分及格' },
  day4: { exam: null, script: 'selfcheck_day4.py', scriptNote: '不计分，但 Day 5 用同一套检查项' },
  day5: { exam: 'day5_exam.md', script: 'grade_day5.py', scriptNote: '计分大考，L1 60 分 + L2 40 分' },
};

/**
 * 下载区。单独给一个 zip 是必须的，不是图省事：
 * grade_dayN.py 开头就 `from graderlib import ...`，只下那个 .py
 * 跑起来必然 ModuleNotFoundError。zip 里带齐了 graderlib/。
 */
function renderMaterials(day) {
  const m = MATERIALS[day];
  if (!m) return '';
  const rows = [];
  if (m.exam) {
    rows.push(`      <tr><td>考卷</td><td>考核题面、评分标准与提交要求</td>` +
      `<td><a href="files/${m.exam}" download>${m.exam}</a></td></tr>`);
  }
  rows.push(`      <tr><td>评分脚本</td><td>${m.scriptNote}</td>` +
    `<td><a href="files/${m.script}" download>${m.script}</a></td></tr>`);
  rows.push(`      <tr><td>打包下载</td><td>上面各项 + <code>graderlib/</code> + 考试规则，解压即可运行</td>` +
    `<td><a href="files/${day}-materials.zip" download>${day}-materials.zip</a></td></tr>`);

  return [
    `  <section class="block" id="materials">`,
    '    <h2>本日材料下载</h2>',
    '    <div class="table-wrap">',
    '    <table>',
    '      <tr><th>材料</th><th>说明</th><th>下载</th></tr>',
    ...rows,
    '    </table>',
    '    </div>',
    '    <p class="callout danger">评分脚本依赖同目录下的 <code>graderlib/</code>。' +
      `单独下载 <code>${m.script}</code> 直接运行会报 ` +
      '<code>ModuleNotFoundError: No module named \'graderlib\'</code>——' +
      '要真的跑脚本，请下载 zip。</p>',
    '<pre><code>cd ~/Downloads',
    `unzip ${day}-materials.zip -d ~/${day}_materials`,
    '',
    '# 终端 1：先把你自己的节点跑起来',
    '# 终端 2：再评分',
    `cd ~/${day}_materials`,
    `python3 ${m.script}</code></pre>`,
    '    <p>也可以直接用仓库里的原件：<code>~/Tutorials4intern/grading/' +
      `${m.script}</code>，两者内容一致。</p>`,
    '  </section>',
  ].join('\n');
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 行内标记。顺序是有讲究的：先把 `code` 抠出来占位，再转义 HTML，
 * 最后才处理粗体与链接。反过来的话，`<package format="3">` 这种
 * 代码里的尖括号会被当成标签，代码里的 ** 会被当成粗体。
 */
function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_m, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_m, label, href) => {
    const day = /^(day\d)\.md$/.exec(href);
    if (day) return `<a href="${day[1]}.html">${label}</a>`;
    if (/^(https?:|#|mailto:)/.test(href)) return `<a href="${href}">${label}</a>`;
    // 指向仓库里其它文件（../exams/... 之类）。讲义站只部署 docs/，
    // 链过去必然 404，所以只保留文字。
    return label;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => `<code>${escapeHtml(codes[+i])}</code>`);
  return s;
}

const isFence = (l) => l.startsWith('```');
const isBlank = (l) => l.trim() === '';

/** 一个代码块 → HTML。mermaid 走 <pre class="mermaid">，由 site.js 渲染。 */
function renderFence(lang, body) {
  const text = escapeHtml(body.join('\n'));
  if (lang === 'mermaid') return `<pre class="mermaid">\n${text}\n</pre>`;
  return `<pre><code>${text}</code></pre>`;
}

/** 表格：第二行是 |---|---| 分隔线，第一行当表头。 */
function renderTable(rows) {
  const cells = (line) =>
    line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const out = ['    <div class="table-wrap">', '    <table>'];
  out.push(`      <tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr>`);
  for (const r of body) {
    out.push(`      <tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
  }
  out.push('    </table>', '    </div>');
  return out.join('\n');
}

/**
 * 引用块。类型只看第一行：[!NOTE] / [!WARNING] / **阶段成果**。
 * 阶段成果的正文里不重复写"阶段成果"四个字——.milestone::before 会画标题。
 */
function renderQuote(lines) {
  let cls = 'callout';
  let body = lines.slice();
  const first = body[0] ?? '';
  if (/^\[!WARNING\]\s*$/.test(first)) {
    cls = 'callout danger';
    body = body.slice(1);
  } else if (/^\[!NOTE\]\s*$/.test(first)) {
    body = body.slice(1);
  } else if (/^\*\*阶段成果\*\*\s*$/.test(first)) {
    cls = 'milestone';
    body = body.slice(1);
  }

  // 空行分段：引用块里可以有多个自然段
  const paras = [];
  let cur = [];
  for (const l of body) {
    if (isBlank(l)) {
      if (cur.length) paras.push(cur.join(' '));
      cur = [];
    } else cur.push(l.trim());
  }
  if (cur.length) paras.push(cur.join(' '));
  if (!paras.length) return '';

  if (paras.length === 1) return `    <p class="${cls}">${inline(paras[0])}</p>`;
  return [
    `    <div class="${cls}">`,
    ...paras.map((p) => `      <p>${inline(p)}</p>`),
    '    </div>',
  ].join('\n');
}

/**
 * 课后回顾整节。markdown 里是「6 道题 + 一个装着 6 条解析的 <details>」，
 * 这里拆成每题各带一个 <details>——site.js 的选项点选绑在
 * `ol.quiz > li > ol > li` 上，题目和选项必须是这个嵌套形状。
 */
function renderQuiz(lines) {
  const questions = [];
  const answers = [];
  let mode = 'q';
  let cur = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^<details>/.test(line)) {
      mode = 'a';
      cur = null;
      continue;
    }
    if (/^<\/details>/.test(line) || /^<summary>/.test(line)) continue;

    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (numbered) {
      cur = mode === 'q'
        ? { text: [numbered[2]], options: [] }
        : { text: [numbered[2]] };
      (mode === 'q' ? questions : answers).push(cur);
      continue;
    }
    if (!cur) continue;

    const opt = /^\s+([A-D])\.\s+(.*)$/.exec(line);
    if (mode === 'q' && opt) {
      cur.options.push(opt[2]);
      continue;
    }
    if (isBlank(line)) continue;
    if (/^(>|\||```|#)/.test(line)) continue; // 别把别的块吸进题干
    cur.text.push(line.trim());
  }

  const out = ['    <ol class="quiz">'];
  questions.forEach((q, i) => {
    // day0/1/2 的 markdown 是从 HTML 反转出来的，解析被塞进了题干那一行
    // （`… 答案与解析 **B。**…`）。day3+ 是正常写的，解析在末尾的 <details> 里。
    let stem = q.text.join(' ');
    let answer = answers[i] ? answers[i].text.join(' ') : '';
    const split = stem.indexOf('答案与解析');
    if (split !== -1) {
      answer = stem.slice(split + '答案与解析'.length).trim();
      stem = stem.slice(0, split).trim();
    }

    out.push('      <li>');
    out.push(`        <p>${inline(stem)}</p>`);
    out.push('        <ol type="A">');
    for (const o of q.options) out.push(`        <li>${inline(o)}</li>`);
    out.push('        </ol>');
    if (answer) {
      out.push('        <details class="aside">');
      out.push('          <summary>答案与解析</summary>');
      out.push(`          <p>${inline(answer)}</p>`);
      out.push('        </details>');
    }
    out.push('      </li>');
  });
  out.push('    </ol>');
  return out.join('\n');
}

/** 通用块解析。返回 HTML 片段数组。 */
function renderBlocks(lines, { inQuizSection = false } = {}) {
  if (inQuizSection) {
    // 小节开头那句引导语在题号之前，单独当段落渲染
    const firstQ = lines.findIndex((l) => /^\d+\.\s/.test(l));
    const head = firstQ === -1 ? lines : lines.slice(0, firstQ);
    const rest = firstQ === -1 ? [] : lines.slice(firstQ);
    // 测验之后的内容（配套 notebook 提示等）不属于测验，照常渲染。
    // 收尾标志有两种，因为两种 markdown 写法不一样：
    //   day3+：解析装在末尾的 </details> 里，到它为止
    //   day0/1/2：解析被内联进题干，整节没有 <details>——这时必须退回到
    //             "第一个引用块/表格/代码块" 作为边界，否则题目会把后面的
    //             `> [!NOTE] 配套 notebook…` 一起吞进最后一题的解析里
    let endIdx = rest.findIndex((l) => /^<\/details>/.test(l));
    if (endIdx !== -1) endIdx += 1;
    else {
      const stop = rest.findIndex((l) => /^(>|\||```|#)/.test(l));
      endIdx = stop === -1 ? rest.length : stop;
    }
    const quizPart = rest.slice(0, endIdx);
    const tailPart = rest.slice(endIdx);
    return [
      ...renderBlocks(head),
      quizPart.length ? renderQuiz(quizPart) : '',
      ...renderBlocks(tailPart),
    ].filter(Boolean);
  }

  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) { i += 1; continue; }

    if (isFence(line)) {
      const lang = line.slice(3).trim();
      const body = [];
      i += 1;
      while (i < lines.length && !isFence(lines[i])) body.push(lines[i++]);
      i += 1; // 吃掉收尾的 ```
      out.push(renderFence(lang, body));
      continue;
    }

    // **预期输出** 单独成段，后面紧跟一个代码块 → .expected 包起来。
    // 标题文字由 .expected::before 画，所以这一段本身不输出。
    const expected = /^\*\*预期输出\*\*(（[^）]*）)?\s*$/.exec(line);
    if (expected) {
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j += 1;
      if (j < lines.length && isFence(lines[j])) {
        const lang = lines[j].slice(3).trim();
        const body = [];
        j += 1;
        while (j < lines.length && !isFence(lines[j])) body.push(lines[j++]);
        j += 1;
        const note = expected[1] ? `      <p><em>${escapeHtml(expected[1])}</em></p>\n` : '';
        out.push(`    <div class="expected">\n${note}${renderFence(lang, body)}\n    </div>`);
        i = j;
        continue;
      }
    }

    if (line.startsWith('### ')) {
      out.push(`    <h3>${inline(line.slice(4).trim())}</h3>`);
      i += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const q = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        q.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }

      // 手绘图的占位段：把原 SVG 接回来，并吃掉后面那段压平的 text 兜底
      const fig = /^\*\*图：(.+?)\*\*\s*$/.exec(q[0] ?? '');
      const figPath = fig && HTML_ONLY_FIGURES[fig[1]];
      if (figPath) {
        out.push(readFileSync(resolve(process.cwd(), figPath), 'utf8').trimEnd());
        let j = i;
        while (j < lines.length && isBlank(lines[j])) j += 1;
        if (j < lines.length && isFence(lines[j])) {
          j += 1;
          while (j < lines.length && !isFence(lines[j])) j += 1;
          i = j + 1;
        }
        continue;
      }

      const html = renderQuote(q);
      if (html) out.push(html);
      continue;
    }

    if (/^<details>/.test(line)) {
      const inner = [];
      let summary = '补充';
      i += 1;
      while (i < lines.length && !/^<\/details>/.test(lines[i])) {
        const s = /^<summary>(.*)<\/summary>\s*$/.exec(lines[i]);
        if (s) summary = s[1];
        else inner.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push([
        '    <details class="aside">',
        `      <summary>${inline(summary)}</summary>`,
        ...renderBlocks(inner),
        '    </details>',
      ].join('\n'));
      continue;
    }

    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      out.push(renderTable(rows));
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^[-*]\s+/.test(lines[i]) || (items.length && /^\s+\S/.test(lines[i])))) {
        if (/^[-*]\s+/.test(lines[i])) items.push(lines[i].replace(/^[-*]\s+/, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i += 1;
      }
      const isGoals = items.length > 0 && items.every((t) => /^\[[ xX]\]\s/.test(t));
      const cls = isGoals ? ' class="goals"' : '';
      out.push([
        `    <ul${cls}>`,
        ...items.map((t) => `      <li>${inline(t.replace(/^\[[ xX]\]\s+/, ''))}</li>`),
        '    </ul>',
      ].join('\n'));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^\d+\.\s+/.test(lines[i]) || (items.length && /^\s+\S/.test(lines[i])))) {
        if (/^\d+\.\s+/.test(lines[i])) items.push(lines[i].replace(/^\d+\.\s+/, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i += 1;
      }
      out.push([
        '    <ol>',
        ...items.map((t) => `      <li>${inline(t)}</li>`),
        '    </ol>',
      ].join('\n'));
      continue;
    }

    // 普通段落：连续非空行合成一段
    const para = [];
    while (
      i < lines.length && !isBlank(lines[i]) && !isFence(lines[i]) &&
      !lines[i].startsWith('>') && !lines[i].startsWith('#') &&
      !lines[i].startsWith('|') && !/^<details>/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length) out.push(`    <p>${inline(para.join(' '))}</p>`);
    else i += 1; // 没吃掉任何行，防死循环
  }
  return out;
}

function convert(day) {
  const md = readFileSync(resolve(SRC_DIR, `${day}.md`), 'utf8').replace(/\r\n/g, '\n');
  const all = md.split('\n');

  // 先切掉页脚：最后一条独立的 --- 之后是"下一天"的引导语
  let hrIdx = -1;
  let inFence = false;
  all.forEach((l, idx) => {
    if (isFence(l)) inFence = !inFence;
    else if (!inFence && /^-{3,}\s*$/.test(l)) hrIdx = idx;
  });
  const bodyLines = hrIdx === -1 ? all : all.slice(0, hrIdx);
  const footLines = hrIdx === -1 ? [] : all.slice(hrIdx + 1).filter((l) => !isBlank(l));

  // 标题
  const h1Line = bodyLines.find((l) => l.startsWith('# '));
  const h1 = h1Line.slice(2).trim();

  // 按 ## 切章节（代码块里的 # 不算）
  const sections = [];
  let intro = [];
  let cur = null;
  inFence = false;
  for (const line of bodyLines) {
    if (isFence(line)) inFence = !inFence;
    if (!inFence && line.startsWith('# ')) continue;
    if (!inFence && line.startsWith('## ')) {
      if (cur) sections.push(cur);
      cur = { title: line.slice(3).trim(), lines: [] };
      continue;
    }
    (cur ? cur.lines : intro).push(line);
  }
  if (cur) sections.push(cur);

  const parts = [];
  parts.push('<!doctype html>');
  parts.push('<meta charset="utf-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push(`<title>${escapeHtml(h1)} · ROS2 入门</title>`);
  parts.push('<link rel="stylesheet" href="assets/style.css">');
  parts.push('');
  parts.push('<div class="layout">');
  parts.push(SIDEBAR);
  parts.push('');
  parts.push('<main class="page">');
  parts.push(`  <h1>${inline(h1)}</h1>`);
  // 标题下的引言（通常是 > [!NOTE] 预计几小时）不放进 section
  const introHtml = renderBlocks(intro);
  for (const b of introHtml) parts.push(b);

  sections.forEach((s, idx) => {
    const cn = /^([一二三四五六七八九十])、/.exec(s.title);
    const id = SECTION_IDS[s.title] ?? (cn ? `sec-${CN_NUM[cn[1]]}` : `sec-${idx + 1}`);
    parts.push('');
    parts.push(`  <section class="block" id="${id}">`);
    parts.push(`    <h2>${inline(s.title)}</h2>`);
    for (const b of renderBlocks(s.lines, { inQuizSection: s.title === '课后回顾' })) {
      parts.push(b);
    }
    parts.push('  </section>');

    // 材料下载紧跟在"今日目标"后面：先拿到考卷再开始学，才知道今天要练到什么程度
    if (id === 'goals') {
      const mat = renderMaterials(day);
      if (mat) {
        parts.push('');
        parts.push(mat);
      }
    }
  });

  if (footLines.length) {
    parts.push('');
    parts.push(`  <footer class="page-foot">${inline(footLines.join(' '))}</footer>`);
  }
  parts.push('</main>');
  parts.push('</div>');
  parts.push('');
  if (md.includes('```mermaid')) parts.push('<script src="assets/vendor/mermaid.min.js"></script>');
  parts.push('<script src="assets/site.js"></script>');

  const html = `${parts.join('\n')}\n`;
  const outPath = resolve(OUT_DIR, `${day}.html`);
  writeFileSync(outPath, html, 'utf8');
  console.log(`${day}.md → ${outPath}  (${html.length} bytes, ${sections.length} sections)`);
}

/**
 * 给已有的手写页（day0/1/2）补一个"本日材料下载"小节。
 * 它们不是从 markdown 生成的，所以只能就地插；重复运行不会插两次。
 */
function inject(day) {
  const path = resolve(OUT_DIR, `${day}.html`);
  let html = readFileSync(path, 'utf8');
  if (html.includes('id="materials"')) {
    console.log(`${day}.html 已有材料下载小节，跳过`);
    return;
  }
  const goalsIdx = html.indexOf('id="goals"');
  if (goalsIdx === -1) throw new Error(`${day}.html 找不到 id="goals" 小节，无法定位插入点`);
  const close = html.indexOf('</section>', goalsIdx);
  if (close === -1) throw new Error(`${day}.html 的 goals 小节没有闭合`);
  const at = close + '</section>'.length;
  html = `${html.slice(0, at)}\n\n${renderMaterials(day)}\n${html.slice(at)}`;
  writeFileSync(path, html, 'utf8');
  console.log(`${day}.html ← 已插入材料下载小节`);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('用法: node scripts/robotics-md2html.mjs day3 day4 day5');
  console.error('      node scripts/robotics-md2html.mjs --inject day0 day1 day2');
  process.exit(1);
}
if (args[0] === '--inject') for (const d of args.slice(1)) inject(d);
else for (const d of args) convert(d);
