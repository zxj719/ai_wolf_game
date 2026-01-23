# 🐺 狼人杀 AI 对战平台 (Werewolf Pro)

一个现代化的、基于多智能体博弈理论的狼人杀 Web 应用程序。多个大语言模型（LLM）智能体相互对战或与人类玩家进行深度博弈。项目实现了完整的贝叶斯推理、欺骗检测、双系统认知架构等高级 AI 功能。

基于 **React 18 + Vite** 构建，支持 **ModelScope** 和 **SiliconFlow** 双 API 提供商。

## ✨ 核心特性

### 🤖 多模型 AI 后端
- **双提供商支持**：ModelScope 和 SiliconFlow 无缝切换
- **动态模型加载**：自动获取 SiliconFlow 可用模型列表
- **负载均衡**：智能分配玩家到不同模型，优化请求频率
- **自动故障转移**：API 失败时自动切换备用模型

### 🧠 高级 AI 认知架构

#### 双系统框架 (Thinker-Listener)
基于认知科学理论，实现三层认知架构：
- **Listener（感知层）**：处理自然语言理解，提取关键信息摘要，过滤噪声
- **Thinker（推理层）**：核心逻辑演绎，在抽象策略空间进行决策
- **Presenter（表达层）**：根据战略意图生成符合角色的说服性语言

#### 贝叶斯身份推断
```
P(Role_i | Action_j) = P(Action_j | Role_i) × P(Role_i) / P(Action_j)
```
- 基于行为的后验概率动态更新
- 完整的行为-角色似然度矩阵
- 支持 16+ 种行为类型分析

#### GRATR 信任评分系统
多维度信任评估：
- 身份可信度（Identity）
- 逻辑连贯性（Logic）
- 行为一致性（Behavior）
- 情绪真实度（Emotion）
- 阵营倾向（Alignment）
- 逻辑严密度（Consistency）

#### 欺骗检测引擎
识别 15+ 种欺骗信号：
- **认知负荷信号**：过度细节、逻辑断层、自相矛盾
- **行为信号**：投票背叛、立场翻转、选择性记忆
- **社交信号**：过度辩护、先发制人指控、情绪操控
- **高级欺骗**：战术性暴露、反向心理、深度潜伏

### 🎭 智能角色扮演
AI 智能体严格遵循角色机制，具备独特的人格系统：

| 人格类型 | 名称 | 特点 |
|---------|------|------|
| logical | 逻辑怪 | 严谨冷静，通过投票记录和发言矛盾找狼 |
| aggressive | 暴躁哥 | 直觉敏锐，攻击性强，怀疑划水者 |
| steady | 稳健派 | 发言平和，倾向于保护神职 |
| cunning | 心机王 | 善于伪装和误导，喜欢带节奏 |

角色专属策略：
- **狼人**：悍跳逻辑、深水策略、倒钩战术、刀法规划
- **预言家**：查验逻辑、警徽流决策、防守逻辑、心路历程
- **女巫**：解药逻辑、毒药逻辑、轮次平衡、身份隐藏
- **守卫**：守护次序、自守价值、心理博弈
- **猎人**：威慑逻辑、枪口准星

### 🎮 多种游戏模式
- **玩家模式**：你作为 0 号玩家参与博弈
- **全 AI 模式**：观看 AI 智能体之间的全自动对决

### 📊 游戏配置
支持多种局制：
- **8 人标准局**：2狼 2民 1预 1女 1猎 1守
- **6 人迷你局**：2狼 2民 1预 1女

### 🎨 沉浸式界面
- 暗黑/赛博朋克美学设计，玻璃拟态效果
- 实时状态追踪（存活/死亡、角色揭示）
- **AI 头像生成**：支持 ModelScope 和 SiliconFlow 图像模型
- 详细的游戏日志，支持导出

### ⚙️ 完整游戏逻辑
- **夜晚阶段**：守卫 → 狼人 → 预言家 → 女巫
- **白天阶段**：公告 → 讨论发言 → 投票放逐
- 支持遗言、猎人开枪、同票 PK 等机制
- **逻辑剪枝验证**：自动检测并修正 AI 生成的规则违规内容

### 💭 思维过程可视化
- Chain-of-Thought 推理过程展示
- 支持 Thinking Model 的专用处理
- 实时显示 AI "正在思考" 状态

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | React 18 + Vite 5 |
| **语言** | JavaScript (ES6+) |
| **样式** | Tailwind CSS 3 |
| **图标** | Lucide React |
| **AI 接口** | ModelScope / SiliconFlow (兼容 OpenAI 接口) |
| **部署** | Cloudflare Workers |

## 🚀 快速开始

### 环境要求
- Node.js (v16+)
- npm 或 yarn

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <repository_url>
   cd battle-web
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   创建 `.env` 文件：
   ```env
   # 选择 AI 提供商: modelscope 或 siliconflow
   VITE_AI_PROVIDER=modelscope

   # ModelScope API Key
   VITE_API_KEY=your_modelscope_api_key

   # SiliconFlow API Key (可选)
   VITE_SILICONFLOW_API_KEY=your_siliconflow_api_key
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **开始游戏**
   打开浏览器访问 `http://localhost:5173`

## 🧠 AI 模型配置

### 支持的 AI 提供商

| 提供商 | API 地址 | 特点 |
|--------|----------|------|
| **ModelScope** | api-inference.modelscope.cn | 异步模式，国内访问快 |
| **SiliconFlow** | api.siliconflow.cn | 同步模式，模型丰富 |

### Thinking Models（推理决策）

用于 AI 角色的深度推理和决策：

| 模型 | 参数量 | 特点 |
|------|--------|------|
| DeepSeek-R1-0528 | 684B | 顶级推理模型 |
| QwQ-32B | 32B | 轻量推理模型 |
| Qwen3-235B-Thinking | 235B | 高级思维模型 |
| Qwen3-Next-80B-Thinking | 80B | 混合注意力模型 |
| MiMo-V2-Flash | 309B | 小米超大规模推理 |
| DeepSeek-V3.2 | - | Thinking 模式 |

### Instruct Models（总结任务）

用于发言压缩、历史总结等任务：

| 模型 | 参数量 | 特点 |
|------|--------|------|
| Qwen3-Coder-480B | 480B | 编码模型 |
| Qwen3-235B-Instruct | 235B | 指令跟随 |
| ERNIE-4.5-300B | 300B | 百度文心 |
| Mistral-Large | 123B | 多语言支持 |
| Llama-4-Maverick | 400B | Meta 最新 |
| Command-R-Plus | 104B | Cohere 对话 |

> 配置文件位于 [src/config/aiConfig.js](src/config/aiConfig.js)

## 🎮 游戏规则

### 8 人标准局

| 角色 | 数量 | 能力 |
|------|------|------|
| 🐺 **狼人** | 2 | 每晚选择一名玩家击杀 |
| 🔮 **预言家** | 1 | 每晚查验一名玩家的阵营 |
| 🧪 **女巫** | 1 | 1 瓶解药 + 1 瓶毒药 |
| 🛡️ **守卫** | 1 | 每晚守护一人（不能连守） |
| 🔫 **猎人** | 1 | 死亡时可开枪（被毒除外） |
| 🧑‍🌾 **村民** | 2 | 白天投票 |

### 6 人迷你局

| 角色 | 数量 |
|------|------|
| 🐺 狼人 | 2 |
| 🔮 预言家 | 1 |
| 🧪 女巫 | 1 |
| 🧑‍🌾 村民 | 2 |

### 胜利条件

- **好人阵营**：投票放逐所有狼人
- **狼人阵营**：屠边（杀光神职或平民）或屠城

## 📂 项目结构

```
battle-web/
├── src/
│   ├── components/              # UI 组件
│   │   ├── ActionPanel.jsx          # 阶段操作按钮
│   │   ├── CirclePlayerLayout.jsx   # 圆桌玩家布局
│   │   ├── ErrorBoundary.jsx        # 错误边界处理
│   │   ├── GameArena.jsx            # 游戏主舞台
│   │   ├── GameHeader.jsx           # 游戏头部状态栏
│   │   ├── GameHistoryTable.jsx     # 游戏历史表格
│   │   ├── GameLog.jsx              # 可滚动的历史日志
│   │   ├── PhaseActionContainer.jsx # 阶段动作容器
│   │   ├── PlayerCardList.jsx       # 玩家卡片列表
│   │   ├── SetupScreen.jsx          # 游戏设置界面
│   │   ├── SidePanels.jsx           # 侧边信息面板
│   │   ├── SpeechBubble.jsx         # 发言气泡组件
│   │   ├── SpeechPanel.jsx          # 讨论发言界面
│   │   └── VotePanel.jsx            # 投票界面
│   │
│   ├── hooks/                   # React Hooks
│   │   ├── useAI.js                 # AI 调用封装
│   │   ├── useDayFlow.js            # 白天流程控制
│   │   ├── useDualSystem.js         # 双系统集成
│   │   ├── useNightFlow.js          # 夜晚流程控制
│   │   └── useTrustInference.js     # 信任推理集成
│   │
│   ├── services/                # 核心服务
│   │   ├── aiClient.js              # AI API 客户端
│   │   ├── aiPrompts.js             # 提示词工程系统
│   │   ├── bayesianInference.js     # 贝叶斯身份推断
│   │   ├── deceptionDetection.js    # 欺骗检测引擎
│   │   ├── dualSystem.js            # 双系统认知架构
│   │   ├── imageGenerator.js        # AI 头像生成
│   │   ├── logicValidator.js        # 逻辑剪枝验证
│   │   ├── ragRetrieval.js          # RAG 检索服务
│   │   ├── ragSchema.js             # RAG 数据结构
│   │   ├── speechSummarizer.js      # 发言压缩服务
│   │   └── trustScoring.js          # GRATR 信任评分
│   │
│   ├── config/                  # 配置文件
│   │   ├── aiConfig.js              # AI 模型配置
│   │   └── roles.js                 # 角色与游戏配置
│   │
│   ├── useWerewolfGame.js       # 核心游戏状态机
│   ├── App.jsx                  # 应用主入口
│   ├── main.jsx                 # React 入口
│   └── index.css                # 全局样式
│
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── wrangler.toml                # Cloudflare 部署配置
```

## 📚 文档

- [提示词工程架构](PROMPT_ENGINEERING.md)：AI 上下文管理、系统提示词、幻觉防止技术
- [游戏设计理论](game.md)：多智能体博弈理论研究报告
  - 贝叶斯博弈与不完全信息转化
  - 纳什均衡与混合策略分布
  - 角色核心思维建模
  - 双系统架构设计
  - 潜空间策略优化（LSPO）

## 🔧 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint

# 部署到 Cloudflare Workers
npm run deploy
```

## 🔑 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_AI_PROVIDER` | AI 提供商 | `modelscope` |
| `VITE_API_KEY` | ModelScope API Key | - |
| `VITE_API_URL` | ModelScope API 地址 | 内置默认值 |
| `VITE_SILICONFLOW_API_KEY` | SiliconFlow API Key | - |
| `VITE_SILICONFLOW_API_URL` | SiliconFlow API 地址 | 内置默认值 |

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。
> `const API_KEY = "ms-..."`

**For local development:**
If the key expires or hits rate limits, please replace it with your own ModelScope API Token in `src/App.jsx`.

## License

MIT