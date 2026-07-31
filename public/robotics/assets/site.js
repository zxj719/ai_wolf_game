// 明暗主题：优先用学员上次的选择，否则跟随系统。
// 这段要在 DOMContentLoaded 之前就跑，避免加载瞬间闪一下白屏。
(function () {
  var saved = null;
  try { saved = localStorage.getItem('t4i-theme'); } catch (e) { /* 隐私模式下会抛异常 */ }
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  }
})();

document.addEventListener('DOMContentLoaded', function () {
  // 目录开关。窄屏默认收起，否则 240px 的侧栏会把正文挤成窄条。
  var layout = document.querySelector('.layout');
  if (layout) {
    var navBtn = document.createElement('button');
    navBtn.className = 'nav-toggle';
    navBtn.type = 'button';

    var savedNav = null;
    try { savedNav = localStorage.getItem('t4i-nav'); } catch (e) { /* 隐私模式 */ }
    var collapsed = savedNav !== null
      ? savedNav === 'collapsed'
      : window.matchMedia('(max-width: 1000px)').matches;

    function applyNav() {
      layout.classList.toggle('nav-collapsed', collapsed);
      // 按钮显示"点下去会得到什么"，与主题按钮同一套说法：
      // 目录展开时点它进入 zen（专注阅读），已在 zen 里则点它退出。
      navBtn.textContent = collapsed ? '✕ zen' : '☯ zen';
      navBtn.setAttribute('aria-expanded', String(!collapsed));
      navBtn.setAttribute('aria-label', collapsed ? '退出 zen 模式，显示目录' : '进入 zen 模式，隐藏目录');
    }
    navBtn.addEventListener('click', function () {
      collapsed = !collapsed;
      try { localStorage.setItem('t4i-nav', collapsed ? 'collapsed' : 'open'); } catch (e) { /* 忽略 */ }
      applyNav();
    });
    applyNav();
    document.body.appendChild(navBtn);
  }

  // 明暗切换按钮
  var btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.type = 'button';

  function currentTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) { return attr; }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paint() {
    btn.textContent = currentTheme() === 'dark' ? '☀ 浅色' : '☾ 深色';
  }
  btn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('t4i-theme', next); } catch (e) { /* 忽略 */ }
    paint();
    renderMermaid();   // 图也要跟着换配色
  });
  paint();
  document.body.appendChild(btn);

  // 返回主页。target="_top" 是关键：讲义在站内是嵌在 iframe 里的，
  // 不加的话只会把 iframe 内部导航到首页，外面那层壳还在，变成页面套页面。
  var homeBtn = document.createElement('a');
  homeBtn.className = 'home-btn';
  homeBtn.href = '/';
  homeBtn.target = '_top';
  homeBtn.textContent = '⌂ 主页';
  homeBtn.setAttribute('aria-label', '返回主页');
  homeBtn.title = '返回主页';
  document.body.appendChild(homeBtn);

  // ---- mermaid 图 ----
  // mermaid 会把 <pre class="mermaid"> 的内容替换成 SVG，所以先把原始文本
  // 存进 data-src，切换主题时才能拿回来重画。
  var mermaidSeq = 0;

  function renderMermaid() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll('pre.mermaid'));
    if (!blocks.length || typeof window.mermaid === 'undefined') { return; }
    blocks.forEach(function (el) {
      // 只在第一次抓原始文本。之后 el 里装的是渲染出来的 SVG，再抓就抓错了。
      if (!el.dataset.src) { el.dataset.src = el.textContent; }
    });
    var dark = currentTheme() === 'dark';
    // mermaid 的默认配色（尤其 mindmap 的品红）跟页面完全不搭，
    // 这里把它的主题变量接到页面自己的调色板上。
    var palette = dark ? {
      background: '#14171a',
      primaryColor: '#1e2a38', primaryTextColor: '#e8eaed', primaryBorderColor: '#64b5f6',
      secondaryColor: '#243447', secondaryTextColor: '#e8eaed', secondaryBorderColor: '#4a7fb5',
      tertiaryColor: '#1e2227', tertiaryTextColor: '#e8eaed', tertiaryBorderColor: '#2c3136',
      lineColor: '#9aa0a6', textColor: '#e8eaed',
      mainBkg: '#1e2a38', nodeBorder: '#64b5f6', clusterBkg: '#1a1e24',
      clusterBorder: '#2c3136', titleColor: '#e8eaed',
      edgeLabelBackground: '#14171a',
      actorBkg: '#1e2a38', actorBorder: '#64b5f6', actorTextColor: '#e8eaed',
      signalColor: '#e8eaed', signalTextColor: '#e8eaed',
      labelBoxBkgColor: '#1e2a38', labelBoxBorderColor: '#64b5f6', labelTextColor: '#e8eaed',
      noteBkgColor: '#243447', noteTextColor: '#e8eaed', noteBorderColor: '#4a7fb5'
    } : {
      background: '#ffffff',
      primaryColor: '#e8f0fe', primaryTextColor: '#1a1a1a', primaryBorderColor: '#0b6bcb',
      secondaryColor: '#d7e6fb', secondaryTextColor: '#1a1a1a', secondaryBorderColor: '#0b6bcb',
      tertiaryColor: '#f4f6f8', tertiaryTextColor: '#1a1a1a', tertiaryBorderColor: '#e0e0e0',
      lineColor: '#5a6068', textColor: '#1a1a1a',
      mainBkg: '#e8f0fe', nodeBorder: '#0b6bcb', clusterBkg: '#f4f6f8',
      clusterBorder: '#e0e0e0', titleColor: '#1a1a1a',
      edgeLabelBackground: '#ffffff',
      actorBkg: '#e8f0fe', actorBorder: '#0b6bcb', actorTextColor: '#1a1a1a',
      signalColor: '#1a1a1a', signalTextColor: '#1a1a1a',
      labelBoxBkgColor: '#e8f0fe', labelBoxBorderColor: '#0b6bcb', labelTextColor: '#1a1a1a',
      noteBkgColor: '#d7e6fb', noteTextColor: '#1a1a1a', noteBorderColor: '#0b6bcb'
    };
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',            // base + themeVariables 才能完全接管配色
      themeVariables: palette,
      // useMaxWidth: false —— 不把图缩放到容器宽度。
      // 缩放会让长流程图的文字小到看不清；改为保持原始尺寸，
      // 由 pre.mermaid 的 overflow-x 提供横向滚动。
      flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: false },
      sequence: { useMaxWidth: false },
      fontFamily: 'system-ui, "Noto Sans CJK SC", "Microsoft YaHei", sans-serif'
    });

    // 逐张顺序渲染，不用 mermaid.run() 批量处理。
    // mermaid 10 并行渲染多张图时有共享状态竞态：同一份合法源码，
    // 首次批量渲染只有第一张成功、其余全变成 "Syntax error in text" 错误图，
    // 手动再跑一次却全部正常。顺序渲染可以稳定复现成功。
    var run = Promise.resolve();
    blocks.forEach(function (el, i) {
      run = run.then(function () {
        var id = 't4i-mmd-' + (mermaidSeq++) + '-' + i;
        return window.mermaid.render(id, el.dataset.src).then(function (res) {
          el.innerHTML = res.svg;
          el.setAttribute('data-processed', 'true');
          if (res.bindFunctions) { res.bindFunctions(el); }
        });
      }).catch(function (err) {
        el.textContent = '（图渲染失败：' + (err && err.message ? err.message : err) + '）';
        el.setAttribute('data-processed', 'true');
      });
    });
    return run;
  }
  window.t4iRenderMermaid = renderMermaid;
  renderMermaid();

  // 系统主题变化（Windows 夜间模式、浏览器定时深色）时必须重画。
  // 图的配色是渲染那一刻烤进 SVG 的 fill；而 htmlLabels 让标签文字是
  // foreignObject 里的 HTML，color 继承页面当前的 --fg。系统一翻，
  // CSS 立刻跟着 @media 变、SVG 却停在旧调色板，就会出现
  // 「白底白字」（浅色的 clusterBkg 配上深色模式的近白文字）。
  // 只在没有手动锁定主题时响应——有 data-theme 时媒体查询本就不生效。
  var scheme = window.matchMedia('(prefers-color-scheme: dark)');
  function onSchemeChange() {
    if (document.documentElement.getAttribute('data-theme')) { return; }
    paint();
    renderMermaid();
  }
  if (scheme.addEventListener) { scheme.addEventListener('change', onSchemeChange); }
  else if (scheme.addListener) { scheme.addListener(onSchemeChange); }  // Safari < 14

  document.querySelectorAll('main.page pre').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '复制';
    btn.addEventListener('click', function () {
      var code = pre.querySelector('code');
      navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(function () {
        btn.textContent = '已复制';
        setTimeout(function () { btn.textContent = '复制'; }, 1500);
      });
    });
    pre.appendChild(btn);
  });

  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.sidebar a').forEach(function (a) {
    if (a.getAttribute('href') === here) { a.classList.add('current'); }
  });

  // 今日目标可勾选，进度存 localStorage（按 页面+列表序号+条目序号 记）
  document.querySelectorAll('ul.goals').forEach(function (list, listIdx) {
    list.querySelectorAll(':scope > li').forEach(function (li, i) {
      var key = 't4i-goal:' + here + ':' + listIdx + ':' + i;
      if (localStorage.getItem(key) === '1') { li.classList.add('done'); }
      li.addEventListener('click', function () {
        li.classList.toggle('done');
        localStorage.setItem(key, li.classList.contains('done') ? '1' : '0');
      });
    });
  });

  // 课后回顾选择题：点击选项即勾选，同一题内单选。只做标记，不判对错——
  // 对错自己开"答案与解析"核对
  document.querySelectorAll('ol.quiz > li > ol').forEach(function (opts) {
    opts.querySelectorAll(':scope > li').forEach(function (li) {
      li.addEventListener('click', function () {
        var was = li.classList.contains('picked');
        opts.querySelectorAll(':scope > li').forEach(function (o) {
          o.classList.remove('picked');
        });
        if (!was) { li.classList.add('picked'); }   // 再点一次取消勾选
      });
    });
  });
});
