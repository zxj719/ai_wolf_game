window.THINKING_LIBRARY = {
  storageKey: "thinking-library-locale",
  common: {
    zh: {
      library: "思考图书馆",
      issue: "第 01 期",
      essay: "阅读长文",
      views: "观点索引",
      archive: "资料库",
      home: "返回首页",
      libraryHome: "图书馆首页",
      raw: "原始文件",
      language: "语言",
      chinese: "中文",
      english: "英文",
      loading: "正在载入...",
      unavailable: "文档暂时不可用",
      unavailableBody: "请求的文档无法载入。请返回资料库重新选择。",
      archiveNote: "资料库保留了整理后的 Obsidian 主题稿。中文模式显示原始整理稿，英文模式显示对应的英文阅读版。"
    },
    en: {
      library: "Thinking Library",
      issue: "Issue 01",
      essay: "Read Essay",
      views: "Argument Index",
      archive: "Archive",
      home: "Home",
      libraryHome: "Library Home",
      raw: "Raw file",
      language: "Language",
      chinese: "Chinese",
      english: "English",
      loading: "Loading...",
      unavailable: "Document unavailable",
      unavailableBody: "The requested document could not be loaded. Please return to the archive and choose again.",
      archiveNote: "The archive preserves edited Obsidian topic drafts. Chinese mode shows the original edited drafts. English mode shows an English reading edition."
    }
  },
  home: {
    zh: {
      kicker: "杂志化的私人知识库",
      title: "把散乱的笔记，改写成能被阅读的思想。",
      dek: "这里不再只是一个文件索引，而是一张阅读桌：长文负责叙事，观点索引负责复查，资料库保存原始整理稿。",
      meta: "工作、机器人、AI、公司、生活。五条线索，最后指向同一个问题：一个人如何在高速度时代保存判断力。",
      primary: "阅读主文",
      secondary: "浏览观点",
      archiveCta: "打开资料库",
      cards: [
        {
          label: "封面长文",
          title: "把选择做成系统",
          body: "一篇重新编排后的长文：从骑行、焦虑、工程、组织和家庭说起，写一个人如何把选择从情绪变成方法。"
        },
        {
          label: "观点索引",
          title: "八个核心观点",
          body: "把长文压缩成可复查的论点，不再让观点散落在段落里。"
        },
        {
          label: "资料库",
          title: "Obsidian 整理稿",
          body: "保留机器人、AI 工程、公司观察、生活素材、日期笔记等主题稿，并提供英文阅读版。"
        }
      ],
      sectionsTitle: "本期结构",
      sections: [
        "从一次骑行进入路径依赖",
        "从焦虑与速度讨论注意力",
        "从工程现场讨论决策",
        "从组织讨论经验如何被保存",
        "从生活底盘回到选择本身"
      ]
    },
    en: {
      kicker: "A magazine edition of a private knowledge base",
      title: "Turning scattered notes into readable thought.",
      dek: "This is no longer a file index. It is a reading desk: the essay carries the narrative, the argument index supports review, and the archive preserves the edited source drafts.",
      meta: "Work, robotics, AI, companies, and ordinary life. Five threads return to one question: how can a person preserve judgment in an age of speed?",
      primary: "Read the essay",
      secondary: "Browse arguments",
      archiveCta: "Open archive",
      cards: [
        {
          label: "Cover Essay",
          title: "Turning Choice Into a System",
          body: "A reconstructed long essay that begins with cycling, anxiety, engineering, organizations, and family, then asks how choice can become a method instead of a mood."
        },
        {
          label: "Index",
          title: "Eight central arguments",
          body: "A compressed map of the essay, built for rereading rather than skimming."
        },
        {
          label: "Archive",
          title: "Edited Obsidian drafts",
          body: "Topic drafts on robotics, AI engineering, company memory, life material, and daily notes, with English reading editions."
        }
      ],
      sectionsTitle: "Issue structure",
      sections: [
        "Path dependence, seen from a night ride",
        "Attention, anxiety, and the violence of speed",
        "Decision-making in engineering work",
        "How organizations preserve experience",
        "The body, the home, and the final shape of choice"
      ]
    }
  },
  essay: {
    zh: {
      title: "把选择做成系统",
      subtitle: "关于注意力、工程、组织和生活底盘的一篇私人长文",
      byline: "整理自 2025-2026 年个人笔记，已匿名化改写",
      date: "2026-04-30",
      standfirst: "我越来越相信，区分人的不是宏大的命运，而是一次次小到几乎看不见的选择。真正困难的不是做出选择，而是在疲惫、焦虑、舒适和噪音里，让正确的选择仍然可以被重复。",
      pullQuote: "一个人需要的不是更多刺激，而是一套在刺激退潮后仍能工作的判断系统。",
      sections: [
        {
          id: "opening",
          label: "开场",
          title: "夜路上的舒适陷阱",
          paragraphs: [
            "有一晚，我在一座潮湿的海岛城市骑车。路面干净，风里有海的味道，街灯把新的城区照得像一张刚渲染好的模型。这样的地方很容易让人放松，也很容易让人误以为放松就是抵达。",
            "我突然意识到自己正在喜欢这种稳定：熟悉的路、可预测的生活、不会突然冒出来的麻烦。它当然很好。可正因为它好，危险也更温柔。舒适不会像失败那样把人撞醒，它只会让半径一点点变小。",
            "朋友曾经提醒我一个词：路径依赖。那天晚上，这个词不再像概念，而像一个安静的警报。人会因为一次正确选择获益，也会因为它太有效而被困住。最深的惯性常常不是痛苦，而是舒服。"
          ]
        },
        {
          id: "attention",
          label: "注意力",
          title: "速度让人来不及记住世界",
          paragraphs: [
            "另一种更现代的惯性发生在屏幕里。短视频、消息流、无穷尽的链接，把焦虑伪装成补给，把疲惫伪装成休息。人并不是不知道自己在被消耗，只是消耗发生得太顺滑，几乎没有摩擦。",
            "我曾把这种状态写成一个不太体面的词：brainrot。它不是道德批判，而是身体感受。注意力被剪碎以后，人会失去对时间的重量感。半小时过去，世界没有变清楚，只是心里更空。",
            "速度还有另一层伤害。现实里的山路需要脚步去记住，游戏里的地图可以一瞬间跨越。效率让人兴奋，却也让经验变薄。很多时候，我们并不是没有去过哪里，而是快到来不及真正抵达。"
          ],
          quote: "注意力不是可以无限透支的账户。它更像睡眠，一旦被长期剥夺，人会失去判断自己的能力。"
        },
        {
          id: "work",
          label: "工作",
          title: "工作越复杂，越稀缺的是决策",
          paragraphs: [
            "我曾以为工程师最重要的价值来自技术本身。后来越来越明白，技术只是语言，决策才是句法。真正难的时刻，不是写不出代码，而是不知道什么值得被写；不是没有工具，而是不知道哪个问题应该先被解决。",
            "复杂系统会惩罚含糊。机器人调不动、接口对不上、模型输出不稳、现场噪声太大，这些问题表面上属于不同专业，底层却都在逼问同一件事：你是否有能力把混乱拆成可验证的链路。",
            "所以我开始相信最小可行版本的价值。MVP 不是粗糙的借口，而是一种诚实：先让关键链路暴露在现实里，再决定要不要打磨。许多团队失败，不是因为没有努力，而是太晚让现实参与评审。"
          ]
        },
        {
          id: "robots",
          label: "现实",
          title: "机器人是最残酷的编辑",
          paragraphs: [
            "机器人项目之所以迷人，是因为它不允许幻觉长期存在。仿真里能跑，不代表真机会跑；算法漂亮，不代表电源、传感器、TF、costmap、网络和现场人员会一起配合。",
            "一台机器人卡住时，它不会尊重 PPT，也不会给概念留面子。它只把系统里最薄弱的连接点暴露出来。于是工程不再是抽象能力的展示，而是和现实一遍遍校准的过程。",
            "这也是 AI 工具给我的提醒。AI 可以加快表达，可以补齐模板，可以像同事一样推动任务，但它不能替代判断。好的 prompt 背后不是咒语，而是任务拆解、验收标准和失败路径。"
          ],
          quote: "让系统稳定，再让系统聪明。语义可以提供偏好，几何必须守住安全。"
        },
        {
          id: "company",
          label: "组织",
          title: "公司是保存经验的机器",
          paragraphs: [
            "如果说机器人暴露工程债，公司则暴露组织债。一个问题解决了，却没有文档；一次联调成功了，却没有接口规范；一个人熬夜救火了，却没有复盘。这样的组织会显得很忙，但忙并不等于成长。",
            "我越来越喜欢把公司理解成保存经验的机器。它最珍贵的不是某个英雄时刻，而是能不能把偶然成功沉淀成稳定能力。文档、测试、清单、复盘、部署脚本，这些看起来不性感的东西，才是组织记忆的骨架。",
            "管理也在这里变得具体。管理不是喊口号，不是把人推向更久的加班，而是让信息流动，让人待在适合的位置，让经验不因为人员更替而蒸发。"
          ]
        },
        {
          id: "life",
          label: "生活",
          title: "身体是精神的地基",
          paragraphs: [
            "当工作变得越来越像一场长期战役，身体就不再是附属品。睡眠、噪音、饮食、运动，这些朴素的东西决定了一个人还能不能做出清醒判断。很多所谓意志力问题，其实只是系统过热后的保护性降频。",
            "我曾经愿意为安静付出溢价。不是因为矫情，而是因为噪音会偷走更隐蔽的东西：它让人无法进入心流，让思考不断被打断，让一个本来可以完成的下午碎成很多无意义的片段。",
            "家在这个意义上也不是抽象的温暖。它更像急流旁的锚点，让人可以短暂停下，重新确认自己不是一台只负责交付的机器。"
          ]
        },
        {
          id: "morality",
          label: "选择",
          title: "良善不是情绪，是成本",
          paragraphs: [
            "我过去常把良善想得太轻，好像它只是性格温柔。后来才明白，真正的良善往往发生在代价出现之后。更容易的路摆在眼前，更正确的路需要付出，人仍然愿意选择后者，这才使良善成为一种力量。",
            "同样，长期主义也不是漂亮词。它意味着在短期刺激面前保留耐心，在价格战里守住品质底线，在焦虑里坚持复盘，在舒适里继续练习离开的能力。",
            "这些选择并不宏大。它们常常只是今晚早点睡、今天把笔记整理完、这次把问题写清楚、这个方案先做验证。但人最终就是被这些小选择塑形。"
          ]
        },
        {
          id: "system",
          label: "结语",
          title: "把选择写成可以重复的系统",
          paragraphs: [
            "我写这篇文章，不是为了证明自己已经稳定。恰恰相反，它来自一种不稳定的自觉：我知道自己会疲惫，会刷屏，会被舒适困住，也会在复杂问题前想逃走。",
            "所以我需要的不是更多励志，而是一套在情绪退潮之后仍能工作的系统。它提醒我先睡觉，再判断；先做 MVP，再宏大叙事；先记录事实，再解释意义；先保护注意力，再谈野心。",
            "人生也许不能完全工程化，但选择可以被设计得更可靠。把选择做成系统，并不是取消自由，而是让自由不被噪音、惯性和疲惫轻易夺走。"
          ]
        }
      ]
    },
    en: {
      title: "Turning Choice Into a System",
      subtitle: "A personal essay on attention, engineering, organizations, and the ground beneath ordinary life",
      byline: "Adapted from private notes written between 2025 and 2026, with identifying details removed",
      date: "April 30, 2026",
      standfirst: "I increasingly believe that people are separated less by grand destiny than by small choices repeated under pressure. The hard part is not choosing once. The hard part is making the right choice repeatable when one is tired, anxious, comfortable, or surrounded by noise.",
      pullQuote: "A person does not need more stimulation. A person needs a judgment system that still works after the stimulation fades.",
      sections: [
        {
          id: "opening",
          label: "Opening",
          title: "The Comfortable Trap On A Night Road",
          paragraphs: [
            "One night I rode a bike through a humid island city. The roads were clean. The air carried the smell of the sea. Streetlights made the new district look like a freshly rendered model. A place like that makes it easy to relax, and easier still to confuse relaxation with arrival.",
            "I suddenly realized that I was beginning to like the stability: the familiar road, the predictable day, the absence of sudden trouble. It was good, of course. But because it was good, the danger was gentle. Comfort does not strike like failure. It simply narrows the radius of life, inch by inch.",
            "A friend once warned me about path dependence. That night the phrase stopped sounding like a concept and became a quiet alarm. A person can benefit from one correct choice, then be trapped by how well it works. The deepest inertia is often not pain. It is comfort."
          ]
        },
        {
          id: "attention",
          label: "Attention",
          title: "Speed Makes The World Hard To Remember",
          paragraphs: [
            "A more modern inertia happens inside the screen. Short videos, message feeds, and endless links disguise anxiety as fuel and fatigue as rest. We are not unaware of the damage. The damage is simply too smooth to resist.",
            "I once described this state with the ugly word brainrot. It was not a moral judgment. It was a bodily sensation. Once attention is sliced into fragments, time loses weight. Half an hour passes. The world is no clearer. The heart is merely emptier.",
            "Speed harms in another way too. A mountain road in real life must be remembered by the feet. In a game, a wand or a button can cross a continent. Efficiency thrills us, but it also thins experience. Often we have not failed to go somewhere. We have moved too fast to arrive."
          ],
          quote: "Attention is not an account that can be overdrawn forever. It is closer to sleep. When it is chronically deprived, a person loses the ability to judge the deprivation."
        },
        {
          id: "work",
          label: "Work",
          title: "As Work Gets More Complex, Decision Becomes Scarce",
          paragraphs: [
            "I used to think an engineer's value came mainly from technical skill. Later I came to see technique as the language, and decision as the grammar. The difficult moment is not always writing the code. It is knowing what deserves to be written. It is not the absence of tools, but the absence of priority.",
            "Complex systems punish vagueness. A robot refuses to move. An interface does not match. A model responds unreliably. A factory floor is too loud for careful thought. These problems appear to belong to different fields, but underneath they ask the same question: can you turn confusion into a chain that can be verified?",
            "That is why I began to respect the minimum viable product. An MVP is not an excuse for roughness. It is a form of honesty. Let reality inspect the essential chain first. Many teams fail not because they did not work hard, but because they invited reality too late."
          ]
        },
        {
          id: "robots",
          label: "Reality",
          title: "The Robot Is The Most Ruthless Editor",
          paragraphs: [
            "Robotics is fascinating because it does not allow illusion to survive for long. A simulation that works does not prove the machine will work. A beautiful algorithm does not guarantee that power, sensors, TF, costmaps, networks, and people on site will cooperate.",
            "When a robot gets stuck, it does not respect slides or spare a concept's feelings. It exposes the weakest connection in the system. Engineering then stops being a display of abstraction and becomes a repeated negotiation with reality.",
            "AI tools teach a similar lesson. AI can accelerate expression, fill templates, and push a task forward like a colleague. But it cannot replace judgment. A good prompt is not a spell. It is task decomposition, acceptance criteria, and a path for failure."
          ],
          quote: "Make the system stable before making it clever. Semantics can express preference. Geometry must guard safety."
        },
        {
          id: "company",
          label: "Organization",
          title: "A Company Is A Machine For Preserving Experience",
          paragraphs: [
            "If robots expose engineering debt, companies expose organizational debt. A problem is solved, but no document is written. An integration succeeds, but no interface contract survives. Someone works through the night to put out a fire, but no review follows. Such an organization looks busy, but busyness is not growth.",
            "I increasingly like to understand a company as a machine for preserving experience. Its most valuable asset is not a heroic moment, but the ability to turn accidental success into stable capability. Documents, tests, checklists, retrospectives, and deployment scripts are not glamorous. They are the bones of organizational memory.",
            "Management becomes concrete here. It is not a slogan, nor a way to push people into longer hours. It is the work of making information flow, putting people where their strengths matter, and preventing experience from evaporating when people move on."
          ]
        },
        {
          id: "life",
          label: "Life",
          title: "The Body Is The Ground Beneath The Mind",
          paragraphs: [
            "As work begins to resemble a long campaign, the body stops being a side issue. Sleep, noise, food, and movement determine whether a person can still make clear judgments. Many failures of willpower are simply protective downshifts after a system overheats.",
            "I have become willing to pay a premium for quiet. Not out of fragility, but because noise steals something subtle. It prevents flow, interrupts thought, and breaks an afternoon that could have been whole into many useless pieces.",
            "Home, in this sense, is not only warmth in the abstract. It is an anchor beside a current, a place where one can stop briefly and remember that one is not a machine built only to deliver."
          ]
        },
        {
          id: "morality",
          label: "Choice",
          title: "Goodness Is Not A Mood. It Is A Cost.",
          paragraphs: [
            "I used to imagine goodness too lightly, as if it were merely a gentle temperament. Later I understood that real goodness often begins after a cost appears. The easier road is available. The better road asks for payment. Choosing the latter is what turns goodness into force.",
            "Long-termism is not a decorative phrase either. It means keeping patience in front of short-term stimulation, preserving quality in a price war, reviewing one's anxiety instead of worshiping it, and practicing the courage to leave comfort.",
            "These choices are rarely dramatic. They may be as small as sleeping earlier tonight, finishing a note today, writing a problem clearly, or validating a proposal before defending it. But a person is shaped by exactly these small choices."
          ]
        },
        {
          id: "system",
          label: "Conclusion",
          title: "Write Choice Into A Repeatable System",
          paragraphs: [
            "I do not write this essay because I have become stable. I write it because I know my instability well. I know I get tired. I know I scroll. I know comfort can trap me. I know complexity can make me want to leave the room.",
            "What I need, then, is not more inspiration, but a system that works after the mood fades. It tells me to sleep first and judge later; to build the MVP before the grand story; to record facts before explaining meaning; to protect attention before speaking of ambition.",
            "A life cannot be fully engineered, but choices can be made more reliable. Turning choice into a system does not cancel freedom. It keeps freedom from being stolen too easily by noise, inertia, and fatigue."
          ]
        }
      ]
    }
  },
  views: {
    zh: {
      title: "观点索引",
      subtitle: "长文不是为了制造更多句子，而是为了沉淀可以复用的判断。这里把主文压缩成八条论点。",
      cards: [
        ["路径依赖", "最危险的惯性常常不是痛苦，而是舒适。舒适越温柔，人越需要有意识地练习离开。"],
        ["注意力", "短视频和消息流把焦虑伪装成补给。一个人要先保护注意力，才有资格谈野心。"],
        ["决策", "复杂工作里，技术只是语言，决策才是句法。真正稀缺的是知道什么问题值得先解决。"],
        ["MVP", "最小可行版本不是粗糙借口，而是让现实尽早参与评审的诚实方法。"],
        ["机器人", "机器人是最残酷的编辑。它不会尊重概念，只会暴露系统最薄弱的连接点。"],
        ["组织记忆", "公司最重要的能力之一，是把个人经验变成集体能力，而不是一次次靠英雄救火。"],
        ["身体", "睡眠、噪音和心流不是生活边角料，而是判断力的地基。"],
        ["良善", "真正的良善发生在成本出现之后。更正确的路需要付出，人仍然愿意选择它。"]
      ]
    },
    en: {
      title: "Argument Index",
      subtitle: "The essay is not meant to produce more sentences. It is meant to preserve reusable judgment. This page compresses the essay into eight arguments.",
      cards: [
        ["Path dependence", "The most dangerous inertia is often not pain but comfort. The gentler comfort becomes, the more deliberately one must practice leaving."],
        ["Attention", "Feeds and short videos disguise anxiety as fuel. A person must protect attention before speaking seriously about ambition."],
        ["Decision", "In complex work, technique is the language and decision is the grammar. The scarce ability is knowing which problem deserves to be solved first."],
        ["MVP", "A minimum viable product is not an excuse for roughness. It is an honest way to let reality review the work early."],
        ["Robotics", "The robot is the most ruthless editor. It does not respect concepts. It exposes the weakest connection in the system."],
        ["Organizational memory", "A company's crucial ability is turning individual experience into collective capability, not relying on heroic firefighting again and again."],
        ["The body", "Sleep, noise, and flow are not lifestyle decoration. They are the ground beneath judgment."],
        ["Goodness", "Real goodness begins after cost appears. The better road asks for payment, and one chooses it anyway."]
      ]
    }
  },
  archive: {
    docs: [
      {
        id: "obsidian-vault/00-index.md",
        color: "blue",
        zhTitle: "Obsidian Vault：阅读指南",
        enTitle: "Obsidian Vault: A Field Guide",
        zhKind: "指南",
        enKind: "Guide",
        zhDesc: "整理后的主题稿如何阅读，以及它们真正关心的问题。",
        enDesc: "How to read the edited topic drafts, and what they are really asking."
      },
      {
        id: "obsidian-vault/01-robotics-ros-navigation.md",
        color: "green",
        zhTitle: "机器人不是算法",
        enTitle: "The Robot Is Not An Algorithm",
        zhKind: "机器人",
        enKind: "Robotics",
        zhDesc: "G1、Go2w、Nav2、SLAM、costmap、接口与现场调试。",
        enDesc: "G1, Go2w, Nav2, SLAM, costmaps, interfaces, and real-world debugging."
      },
      {
        id: "obsidian-vault/02-ai-coding-and-platforms.md",
        color: "violet",
        zhTitle: "AI 是工作流，不是捷径",
        enTitle: "AI Is A Workflow, Not A Shortcut",
        zhKind: "AI 工作流",
        enKind: "AI Workflow",
        zhDesc: "Claude Code、OpenClaw、长任务 agent 与平台化思考。",
        enDesc: "Claude Code, OpenClaw, long-running agents, and platform thinking."
      },
      {
        id: "obsidian-vault/03-company-career-and-principles.md",
        color: "orange",
        zhTitle: "公司是保存经验的机器",
        enTitle: "A Company Is A Machine For Preserving Experience",
        zhKind: "组织",
        enKind: "Organization",
        zhDesc: "公司记忆、领导力、成本、质量和合伙人心态。",
        enDesc: "Company memory, leadership, cost, quality, and the partner mindset."
      },
      {
        id: "obsidian-vault/04-content-life-and-misc.md",
        color: "pink",
        zhTitle: "生活笔记是原材料",
        enTitle: "Life Notes Are Raw Material",
        zhKind: "生活",
        enKind: "Life",
        zhDesc: "音乐、旅行、阅读、草稿和未归类想法。",
        enDesc: "Music, travel, reading, drafts, and unclassified ideas."
      },
      {
        id: "obsidian-vault/05-daily-notes-and-plans.md",
        color: "teal",
        zhTitle: "日期笔记是黑匣子",
        enTitle: "Daily Notes Are A Black Box Recorder",
        zhKind: "时间线",
        enKind: "Timeline",
        zhDesc: "把 daily notes 看作研发证据，而不只是日记。",
        enDesc: "Daily notes as engineering evidence rather than ordinary diary entries."
      },
      {
        id: "obsidian-vault/06-source-inventory.md",
        color: "graphite",
        zhTitle: "非链接版来源清单",
        enTitle: "Source Inventory Without Links",
        zhKind: "清单",
        enKind: "Inventory",
        zhDesc: "整理覆盖的 markdown 文件范围与排除项。",
        enDesc: "The markdown scope covered by the edit, plus exclusions."
      }
    ],
    zhMarkdown: {
      "obsidian-vault/00-index.md": `# 知识库阅读指南

整理日期：2026-04-29。

这组文件不是原始笔记的地图，而是一批面向阅读重新整理的主题稿。原始 Obsidian 文件没有移动，也没有重命名；阅读时不需要不断跳回原始笔记。

你可以把它看作一本小杂志。每篇文章负责一个主题：机器人、AI 工程、公司与职业、生活素材、日期笔记。原始笔记是矿石，这里是阅读版。

## 阅读顺序

1. \`01-robotics-ros-navigation.md\`
   - 机器人实机工程：G1、Go2w、Nav2、SLAM、探索、视觉语言模型、标定、避障和现场调试。

2. \`02-ai-coding-and-platforms.md\`
   - AI 编程和平台化：Claude Code、OpenClaw、长任务 agent、工程自动化和工作流设计。

3. \`03-company-career-and-principles.md\`
   - 公司、职业和原则：组织记忆、领导力、长期主义和真实价值。

4. \`04-content-life-and-misc.md\`
   - 内容、生活和零散兴趣：音乐、旅行、读书、草稿和未归档想法。

5. \`05-daily-notes-and-plans.md\`
   - 日期笔记时间线：把 daily notes 看成研发日志，而不是普通日记。

6. \`06-source-inventory.md\`
   - 非链接版来源清单：说明整理覆盖了哪些材料。

## 真正的问题

这批笔记表面上很散：机器人调参、导航报告、AI 编程、公司观察、读书分享、旅行计划、音乐和弦。但读下来会发现，它们在反复追问同一件事：

**一个人如何在 AI 时代，用工程化的方法，把混乱的想法变成可交付的现实？**

机器人是最残酷的训练场。仿真能跑，不代表真机能跑；代码能编译，不代表电源、传感器、坐标变换、状态机和现场人员能一起工作。

AI 编程是另一条训练线。Claude Code、OpenClaw、MCP 和 agent 不会自动让工程变好，它们只会放大已有的任务拆解能力、验证能力和组织能力。

公司与职业反思则是第三条线。代码能否被维护，经验能否被保存，产品是否值得被认真打磨，最终都取决于组织有没有保存经验的能力。`,
      "obsidian-vault/01-robotics-ros-navigation.md": `# 机器人不是算法

机器人笔记的核心教训很简单，也很冷酷：

**仿真里的成功，只能证明算法在理想世界成立；真机上的稳定，才证明工程系统真的存在。**

这条线从扫地机、Go2w 到宇树 G1 的实机调试，反复显示同一个事实：机器人项目从来不是一个单点技术问题。建图、定位、导航、坐标变换、代价地图、传感器、电源、启动脚本、状态机、网络、控制器和现场人员，任何一个环节松动，都会表现为“机器人又卡住了”。

## 真实系统

导航系统表面上可以拆成建图、定位、导航。实际落地时，它更像一串互相牵扯的条件。

- 地图要稳定。
- \`map -> odom -> base_link\` 的坐标链要可信。
- 激光、深度相机、IMU 和轮速要按正确频率发布。
- 全局代价地图和局部代价地图要各自承担清楚的责任。
- 规划器不能把路径压在障碍物边缘。
- 控制器不能在危险区域继续偏离路径。
- 恢复行为不能因为定位抖动而放大问题。
- 一键启动脚本不能只会启动，不会关闭。

这就是为什么实机调试总是比仿真慢。仿真三天跑通的流程，到了真机上可能三周还在打磨。不是算法突然变差，而是真实世界把所有工程债一次性收回来了。

## 探索目标的陷阱

边界探索看起来很优雅：找到已知和未知的边界，把机器人送过去，地图自然扩展。但真实环境不关心这个目标点是否让机器人难受。

更稳的方式，是在目标点吸附时同时检查探索地图和导航代价地图：探索模块负责发现哪里值得去，导航模块负责判断哪里真正安全。

## 几何层必须守住安全

视觉语言模型可以告诉系统“哪里更像目标区域”，可以给候选点排序，也可以解释理由。但它不能直接决定机器人去一个几何上不可达或不安全的位置。

**语义负责偏好，几何负责安全。**

如果语义系统掉线、输出异常或网络不稳，机器人必须能降级回纯探索或手动控制。这不是保守，而是真机系统必须具备的生存能力。`,
      "obsidian-vault/02-ai-coding-and-platforms.md": `# AI 是工作流，不是捷径

AI 编程工具最容易被误解成“更快写代码”。这些笔记真正指向的结论更深：

**AI 的价值不是替人写几行代码，而是把工程推进变成可重复、可恢复、可验证的流程。**

Claude Code、OpenClaw、深度思考平台、全栈指南和 Copilot 会话，表面上是不同项目，实际都在回答同一个问题：怎样让 AI 从聊天窗口，变成工程组织里的基础设施。

## 从助手到同事

Claude Code 不是行级补全，而是终端原生的 AI 编程代理。它能读仓库、改文件、执行命令、看结果、继续推进。

既然它更像一个工程同事，就需要工作规则：

- 先理解仓库，再动手。
- 先提出计划，再修改文件。
- 每次改动都要能验证。
- 不确定时暴露假设。
- 遇到权限、网络、依赖问题要有清晰失败路径。
- 大型任务要拆阶段，而不是一次性生成。

团队推广 AI 的真正难点不只是安装，而是形成共同使用习惯：什么任务交给 AI，什么判断必须由人负责，什么结果需要资深工程师把关。

## 长任务需要状态机

如果一个 agent 要持续推进网络问题修复、构建失败排查或跨模块重构，它不能只靠一次 prompt。工程任务会失败、卡住、遇到权限不足、发现前一个假设错误。

没有状态机，agent 只是不断生成下一段文字；有了状态机，它才知道自己处在观察、诊断、修改、验证、重试还是人工接管。

AI 工程化和普通聊天的分界线，就在这里。`,
      "obsidian-vault/03-company-career-and-principles.md": `# 公司是保存经验的机器

公司、职业和原则这组笔记，表面上是在写某家公司、领导力、读书分享和工作感受。真正的问题只有一个：

**一个组织如何把个人经验变成集体能力？**

机器人项目会暴露技术问题，也会暴露组织问题。为什么系统反复靠口口相传？为什么问题解决后没有沉淀？为什么项目能做完，但下一次仍然像从头开始？这些问题最后都指向公司最核心的能力：保存经验。

## 价格战问题

笔记里有一句很重的话：大多数时候，减成本就是在降品质。

这不是反对成本控制，而是反对用价格战掩盖产品力不足。工程师天然会对这种事情敏感，因为每一次“省一点”，最后都会落在材料、测试、冗余、稳定性和维护成本上。

一个只讲利润的公司没有社会价值，一个不讲利润的公司无法生存。真正困难的是在两者之间建立平衡。

## 组织记忆问题

公司最危险的不是遇到问题，而是问题解决后没有留下任何东西。

没有文档，经验就留在个人脑子里。没有测试，质量就靠现场运气。没有复盘，下一次就会犯同样的错。没有接口规范，联调就会变成互相猜字段。

技术文档、接口协议、调试清单、自动化测试、复盘记录、代码规范、部署脚本和失败案例库，都是组织记忆的一部分。

## 领导力不是表演

头衔让人成为管理者，品格让人成为领导者。技术团队不需要舞台式领导，需要能讲真话、承担后果、公开透明、学会授权、帮助下属成长，并在压力下保护长期价值的人。

如果领导力只剩下头衔和指令，团队会变成被动执行系统。如果领导力能建立真实信任，团队才有机会从完成任务走向共同创造。`,
      "obsidian-vault/04-content-life-and-misc.md": `# 生活笔记是原材料

不是所有笔记一开始都像项目。音乐和弦、旅行计划、读书分享、短句、空白文件和未命名草稿，看起来杂乱，但它们有另一种价值：

**它们记录的是兴趣的方向，而不是完成的成果。**

一个人的知识库里需要正式文档，也需要未成形的材料。很多项目最早都不是项目，只是一句突然冒出来的话、一次旅行念头、一段读书感受或一个还没命名的文件。

## 音乐作为结构

和弦笔记看起来和机器人、AI、公司报告没有关系，但它有相似的底层结构：秩序、节奏、组合、张力和释放。

如果以后继续积累，音乐不应长期待在杂项里。它值得有自己的主题文件，因为它可能会连接到创作、情绪表达和内容产品。

## 旅行作为愿望

旅行计划很短，但短不代表没价值。旅行计划常常不是为了立刻执行，而是记录一种向外走的愿望。

知识库不应该只容纳确定性，也应该容纳愿望。

## 阅读作为自我重构

真正好的读书笔记，不只是摘录观点，而是用书里的观点重新理解自己。它可以继续变成演讲稿、PPT 大纲、个人原则、职业选择标准和团队管理信条。

好的读书笔记，最后会反过来改变人的行动。

## 杂项不是垃圾桶

杂项不是垃圾桶，而是孵化区。它的任务不是永久存放，而是临时收容尚未找到类别的东西。健康的知识库应该允许三种状态同时存在：已经成形的文章、正在推进的项目、尚未归类的原材料。`,
      "obsidian-vault/05-daily-notes-and-plans.md": `# 日期笔记是黑匣子

这个知识库里的日期笔记，大多不是传统日记。它们更像研发现场的黑匣子：记录任务、故障、会议、调参、临时判断和当天推进到哪里。

黑匣子的价值不在于当下读起来优美，而在于之后能还原现场。一个月后回看，你能知道当时为什么改代价地图，为什么怀疑定位，为什么要写导航接口，为什么网络配置要调整。

## 日期笔记是证据

正式文档往往会把过程清理得很干净，只留下结论。但工程问题最重要的部分经常藏在过程里：

- 当时有哪些假设？
- 哪些方案试过但失败了？
- 是谁提出了哪个风险？
- 为什么选择这个参数？
- 失败是偶发还是稳定复现？
- 哪个日志真正暴露了根因？

这些内容不一定适合放进最终报告，但如果没有它们，复盘会变成凭记忆写故事。

## 什么时候应该毕业

如果一条日期笔记只是一次性任务，留在当天记录里就可以。如果它包含可复用经验，就应该毕业成正式文档。

适合毕业的内容包括接口协议、排障流程、调参原则、测试清单、环境安装指南、技术方案、复盘结论和可复用模板。

## 每周抽取

日期笔记最怕堆积。堆积之后，它们会从黑匣子变成噪音。解决方式不是每天精修，而是每周抽取。

每周问五个问题：这周哪些问题反复出现？哪个问题找到了根因？哪个解决方案可以复用？哪些任务其实是同一个主题？哪些内容应该迁移到正式主题文件？`,
      "obsidian-vault/06-source-inventory.md": `# 非链接版来源清单

这个文件只说明整理覆盖了哪些 markdown 来源，不保留 source 链接。需要查看原文时，可以直接在 Obsidian Vault 中按文件名搜索。

## 纳入范围

本次整理纳入了根目录日期笔记、\`Day Planner/\` 日期笔记和技术记录、\`ROS2/\` 技术文档、原则笔记、包含项目内容的 Copilot 会话记录，以及根目录下的机器人、AI、公司、内容和生活类 markdown 文件。

## 未纳入范围

本次整理不纳入 \`copilot-custom-prompts/\` 的支持 prompt 模板、Obsidian 配置、图片、HTML、CSS、JS 和非 markdown 文件。

## 如何使用这份清单

这不是正文文章，而是控制表。它用来确认整理范围、发现遗漏材料，并决定哪些原始笔记值得在下一轮升级成正式主题稿。`
    },
    enMarkdown: {
      "obsidian-vault/00-index.md": `# Obsidian Vault: A Field Guide

Edited on April 29, 2026.

This folder is not a source map. It is a small set of edited topic essays. The original Obsidian files were not moved or renamed, and this reading edition does not force the reader to jump back to source notes.

Think of it as a small magazine. Each piece carries one subject: robotics, AI engineering, companies and careers, life material, and the timeline of daily notes. The raw notes are the quarry. This edition is the reading cut.

## Reading Order

1. \`01-robotics-ros-navigation.md\`
   - Real-machine robotics engineering: G1, Go2w, Nav2, SLAM, frontier exploration, VLMs, calibration, obstacle avoidance, and site debugging.

2. \`02-ai-coding-and-platforms.md\`
   - AI coding and platform work: Claude Code, OpenClaw, long-running agents, engineering automation, and workflow design.

3. \`03-company-career-and-principles.md\`
   - Companies, careers, and principles: leadership, engineering mindset, long-term thinking, and real value.

4. \`04-content-life-and-misc.md\`
   - Content, life, and miscellaneous interests: music, travel, reading, rough notes, and unfinished ideas.

5. \`05-daily-notes-and-plans.md\`
   - Daily notes as an engineering timeline rather than a private diary.

6. \`06-source-inventory.md\`
   - A plain inventory of the materials covered by this edit.

## The Real Question

The notes look scattered: robot tuning, Nav2 reports, Claude Code adoption, company observations, book notes, travel plans, and music chords. Read together, they keep asking one question:

**How can a person use engineering methods to turn chaotic ideas into deliverable reality in the age of AI?**

Robotics is the harshest training ground. A simulation can work while the real machine still fails. Code can compile while power, sensors, TF, state machines, and people on site refuse to cooperate. The repeated vocabulary of costmaps, frontier goals, map-to-odom, CycloneDDS, recovery, launch scripts, and calibration is not jargon. It is reality insisting that a system succeeds or fails at its weakest connection.

AI coding is a second training ground. Claude Code, OpenClaw, MCP, and agents do not automatically improve engineering. They amplify task definition, decomposition, verification, and organizational discipline. A good prompt is usually a sign of good engineering judgment.

The company and career notes form the third thread. Why can one company survive for years? Why do engineers fall into an agent mindset? Why does cost cutting often become quality cutting? These questions appear far from code, but they decide whether code is maintained, whether experience is preserved, and whether products deserve careful work.`,
      "obsidian-vault/01-robotics-ros-navigation.md": `# The Robot Is Not An Algorithm

The central lesson of the robotics notes is simple and cold:

**Success in simulation only proves that an algorithm survives an ideal world. Stability on the real machine proves that an engineering system exists.**

The heaviest thread in this vault runs from cleaning robots and Go2w to Unitree G1 debugging. It repeats one fact: a robotics project is never a single technical point. SLAM, Nav2, TF, costmaps, sensors, power, launch scripts, state machines, networks, controllers, and people on site all have to work together. If one connection loosens, the visible symptom is simply that the robot is stuck again.

## The Real System

A navigation system appears to have three parts: mapping, localization, and navigation. In practice, it is a chain of conditions.

- The map must be stable.
- The \`map -> odom -> base_link\` TF chain must be believable.
- Laser, depth camera, IMU, and odometry streams must publish at useful rates.
- Global and local costmaps must have distinct responsibilities.
- The planner must not press paths against obstacles.
- The controller must not continue drifting in dangerous areas.
- Recovery behaviors must not amplify localization noise.
- One-click scripts must know how to stop, not only how to start.
- Power, network, and remote control must support long tests.

This is why real-machine debugging is slow. A flow that works in simulation after three days may take three weeks on G1 or Go2w. The algorithm did not suddenly become worse. The real world collected every engineering debt at once.

## The Frontier Trap

Frontier exploration is seductive because it looks elegant: find the boundary between known and unknown space, send the robot there, and the map grows. But real environments do not care whether a frontier is comfortable for the robot.

Many failures come from frontier targets placed too close to obstacles, inside narrow passages, or within concave structures. The explorer may choose a geometrically meaningful point, while Nav2 has to execute a dangerous command.

A cleaner first step is not to place a VLM or Voronoi system inside the explorer core. Instead, when snapping a target point, read the global costmap and only send goals that are free both on the exploration map and on Nav2's costmap. Frontier decides what is worth exploring. The costmap decides what is safe.

## Geometry Is The Safety Layer

The most important sentence in the semantic exploration plan is:

**Geometry is ground truth. Semantics is preference.**

The VLM can rank candidate regions and explain why one direction seems useful. It must not directly send the robot into a geometrically unsafe place. If the semantic layer fails, the robot must degrade to pure frontier exploration or manual control. That is not conservatism. It is survival.`,
      "obsidian-vault/02-ai-coding-and-platforms.md": `# AI Is A Workflow, Not A Shortcut

AI coding tools are easily misunderstood as a way to write code faster. The deeper conclusion in these notes is different:

**The value of AI is not that it writes a few lines for you. Its value is turning engineering progress into a repeatable, recoverable, verifiable workflow.**

Claude Code, OpenClaw, deep-thinking platforms, full-stack guides, and Copilot conversations all ask the same question: how does AI move from a chat window into the infrastructure of engineering work?

## Claude Code: From Assistant To Coworker

Claude Code is not line-level completion. It is a terminal-native programming agent that can read a repository, edit files, run commands, inspect results, and continue.

That makes it closer to a junior or mid-level coworker than to an autocomplete tool. A coworker needs rules:

- Understand the repository before editing.
- Make a plan before changing files.
- Verify every change.
- Expose assumptions when uncertain.
- Provide clear failure paths for permission, network, or dependency issues.
- Split large tasks into stages.

The hard part of adopting Claude Code is not installation. It is creating shared habits: what should AI do, what must humans decide, what can be delegated to an agent, and what needs senior review.

## The Long-Running Agent Problem

OpenClaw points to a harder problem. If an agent is meant to keep working on a network failure, it cannot rely on one prompt. Long tasks need a state machine.

Engineering work fails, stalls, runs into missing permissions, discovers that an earlier assumption was wrong, and needs human handoff. Without state, an agent merely produces the next paragraph. With state, it knows whether it is observing, diagnosing, changing, verifying, retrying, or handing off.

AI engineering begins where chat ends.`,
      "obsidian-vault/03-company-career-and-principles.md": `# A Company Is A Machine For Preserving Experience

These notes appear to discuss one company, leadership, book sharing, and work feelings. The real question is narrower:

**How does an organization turn individual experience into collective capability?**

Robotics projects expose technical problems, but they also expose organizational ones. Why does knowledge keep traveling by word of mouth? Why does a solved problem leave no artifact? Why can a project finish while the next one still feels like starting from zero? These questions lead to one core company ability: preserving experience.

## The Price War Problem

One note says that most cost cutting is quality cutting. The point is not to oppose cost control. It is to oppose hiding weak product power behind a price war.

Engineers are sensitive to this because they know every little saving eventually lands somewhere: materials, testing, redundancy, stability, or maintenance cost. A company that speaks only of profit has no social value. A company that ignores profit cannot survive. The real difficulty is the balance.

## The Memory Problem

The most dangerous thing is not that a company encounters problems. It is that solved problems leave nothing behind.

Without documents, experience lives only in someone's head. Without tests, quality depends on luck. Without reviews, the same mistakes return. Without interface contracts, integration becomes guesswork. Without delivery checklists, projects rely on exhaustion.

Documents, protocols, checklists, tests, retrospectives, coding standards, deployment scripts, and failure libraries are not bureaucracy at their best. They are organizational memory.

## Leadership Is Not Performance

Leadership is not performance. A title makes someone a manager. Character makes someone a leader.

Engineering teams do not need theatrical leadership. They need people who tell the truth, take responsibility, remain transparent, trust others, delegate, help people grow, and protect long-term value under pressure.

If leadership becomes only title and command, the team turns into a passive execution system. If leadership builds real trust, the team can move from completing tasks to creating together.`,
      "obsidian-vault/04-content-life-and-misc.md": `# Life Notes Are Raw Material

Not every note begins as a project. Music chords, travel plans, book reflections, short sentences, blank files, and unnamed drafts look disorderly. They have another kind of value:

**They record the direction of interest, not the completion of work.**

A knowledge base needs formal documents, but it also needs unformed material. Many projects first appear not as projects, but as a line, a trip imagined, a reading response, or a file without a name.

## Music As Structure

Chord notes appear far from robotics, AI, or company reports, yet they share an underlying structure: order, rhythm, combination, tension, and release.

Music can later become chord progressions, arrangement notes, song analysis, practice records, or a map between emotion and melody. If it continues to grow, it deserves a theme of its own.

## Travel As Desire

A travel note can be short and still valuable. Planning a trip is not always about immediate execution. Sometimes it records the desire to move outward.

A mature plan needs route, time, budget, transport, equipment, preferences, risks, and constraints. At the earliest stage, writing down the wish may already be enough. A knowledge base should hold desire as well as certainty.

## Reading As Self-Reconstruction

The best reading notes are not summaries. They are moments when the book changes how one understands oneself. A leadership book can become a speech, a slide outline, a personal principle, or a career standard.

Good reading notes eventually change action.

## The Role Of Misc

Miscellaneous is not a trash can. It is an incubator. Its purpose is not permanent storage but temporary shelter for ideas that have not found their category yet.`,
      "obsidian-vault/05-daily-notes-and-plans.md": `# Daily Notes Are A Black Box Recorder

The daily notes in this vault are not traditional diary entries. They are closer to black box recorders from a work site: tasks, failures, meetings, parameter changes, temporary judgments, and the state of progress at the end of a day.

The value of a black box is not beauty in the moment. It is the ability to reconstruct what happened later.

## Daily Notes Are Evidence

Formal documents often clean the process and preserve only conclusions. Engineering problems hide the important parts in the process:

- What assumptions existed at the time?
- Which approaches failed?
- Who raised which risk?
- Why was this parameter chosen?
- Was the failure stable or accidental?
- Which log revealed the cause?

These details may not belong in the final report, but without them retrospectives become stories written from memory.

## When A Daily Note Should Graduate

If a note is a one-time task, it can remain in the daily record. If it contains reusable experience, it should graduate.

Graduation candidates include interface protocols, troubleshooting flows, tuning principles, test lists, installation guides, technical proposals, retrospective conclusions, and reusable report templates.

## The Weekly Extraction Habit

Daily notes become noise when they pile up. The solution is not to polish every entry. It is to extract weekly.

Ask: what repeated this week, what root cause was found, what solution can be reused, which tasks were actually one theme, and which materials belong in formal topic files?`,
      "obsidian-vault/06-source-inventory.md": `# Source Inventory Without Links

This file describes which markdown materials were covered by the edit. It does not preserve source links. To inspect an original file, search for the filename in the Obsidian vault.

## Included Scope

The edit includes root daily notes, \`Day Planner/\` notes and technical records, \`ROS2/\` documents, principle notes, project-related Copilot conversations, and root-level markdown files about robotics, AI, companies, content, and life.

## Excluded Scope

The edit excludes the 13 support prompt templates in \`copilot-custom-prompts/\`, Obsidian configuration, images, HTML, CSS, JavaScript, and non-markdown files.

## How To Use This Inventory

This inventory is not an essay. It is a control sheet. Use it to understand coverage, identify missing material, and decide which raw notes should graduate into future topic drafts.`
    }
  }
};
