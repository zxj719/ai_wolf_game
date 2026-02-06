# 鍙樻洿鏃ュ織 (Changelog)

鏈枃浠惰褰曢」鐩殑閲嶈鍙樻洿锛屽寘鎷姛鑳芥洿鏂般€丅ug 淇鍜屾暟鎹簱杩佺Щ绛夈€?

## [2026-02-06] 页面路由管理 + 退出即停机制

### 新功能
- **前端路由映射**
  - 登录页 `/login`、主页 `/home`、自定义局 `/wolfgame/custom`、对局 `/wolfgame/play`、博客 `/sites` 统一由 SPA 管理
  - 仪表盘“我的博客”入口切换为 `/sites` 内嵌展示
- **返回按钮覆盖**
  - 自定义局、对局、博客页新增“返回首页/返回登录”按钮
- **退出即停**
  - 离开对局页立即终止游戏并取消 API 请求

### 行为优化
- **AI 调用防护**
  - 增加 `gameActiveRef` 守卫，阻断退出后继续触发日/夜流程

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.jsx` | 修改 | 增加路由状态、退出逻辑与返回按钮传递 |
| `src/components/Dashboard.jsx` | 修改 | 博客入口改为 `/sites` |
| `src/components/SetupScreen.jsx` | 修改 | 自定义界面新增返回按钮 |
| `src/components/GameArena.jsx` | 修改 | 对局界面新增返回按钮 |
| `src/components/SitesPage.jsx` | 新增 | 博客嵌入页 |
| `src/hooks/useAI.js` | 修改 | 新增 `gameActiveRef` 防止退出后调用 |
| `src/hooks/useDayFlow.js` | 修改 | 流程退出守卫 |

## [2026-02-06] 自定义模式独占 + 天亮结算阶段 + AI 逻辑约束 + Codex 项目配置

## [2026-02-06] 鑷畾涔夋ā寮忕嫭鍗?+ 澶╀寒缁撶畻闃舵 + AI 閫昏緫绾︽潫 + Codex 椤圭洰閰嶇疆

### 鏂板姛鑳?

- **鑷畾涔夊眬鎴愪负鍞竴妯″紡**
  - 绉婚櫎 6/8 浜洪璁惧眬锛屼粎淇濈暀鑷畾涔夐厤缃紙瑙掕壊鏁?澶滄櫄椤哄簭鑷姩鐢熸垚锛?
  - 璁剧疆鐣岄潰澧炲姞鈥滃厤璐圭畻鍔涘钩鍙扳€濇彁绀猴紙鎱?鎺夌嚎/闇€鑰愬績绛夊緟锛?

- **鏂板 `day_resolution` 缁撶畻闃舵**
  - 澶滄櫄缁撴潫鍚庡厛杩涘叆缁撶畻闃舵锛屾敮鎸佺寧浜鸿繛閿佸紑鏋畬鏁寸粨绠楀悗鍐嶅紑濮嬬櫧澶╄璁?

- **AI 妯″瀷涓庢帹鐞嗚〃澧炲己**
  - 瑙掕壊鍗℃樉绀烘瘡鍚?AI 瀹為檯浣跨敤鐨勬ā鍨嬶紙鑷姩 fallback 鍚庝篃浼氭洿鏂帮級
  - `identity_table` 澧炲姞 role pool 纭害鏉?+ 鏈湴娓呮礂锛岄伩鍏嶆帹鐞嗗嚭鏈眬涓嶅瓨鍦ㄧ殑韬唤
  - 鏂板 GLM-4.7 / GLM-4.7-Flash 浣滀负鍙€夋ā鍨?

### Bug 淇

- **鐚庝汉琛屽姩璁板綍缂哄け/閿欏綊澶滄櫄**
  - 鐚庝汉寮€鏋褰曟寔涔呭寲涓虹櫧澶╄鍔紝瀵煎嚭涓庡巻鍙茶〃鍙纭樉绀?

- **鍘嗗彶琛ㄦ覆鏌撳穿婧?*
  - 淇 thought/identity_table 涓哄璞″鑷寸殑 React 娓叉煋閿欒锛堢粺涓€ stringify锛?

### 宸ュ叿涓庢枃妗?

- **鏂板 Codex 椤圭洰閰嶅鏂囦欢**
  - 澧炲姞 `AGENTS.md`銆乣.codex/` 瑙勫垯/閰嶇疆涓?`.agents/skills/*`锛堝榻?`.claude/commands/*` 宸ヤ綔娴侊級

### 鏂囦欢鍙樻洿
| 鏂囦欢 | 鎿嶄綔 | 璇存槑 |
|------|------|------|
| `src/config/roles.js` | 淇敼 | 绉婚櫎 6/8 浜洪璁撅紝浠呬繚鐣欒嚜瀹氫箟 setup |
| `src/components/SetupScreen.jsx` | 淇敼 | 鑷畾涔?only UI + 鍏嶈垂绠楀姏骞冲彴鎻愮ず |
| `src/components/CirclePlayerLayout.jsx` | 淇敼 | Game Over 鏄剧ず鑳滆礋锛涜鑹插崱鏄剧ず瀹為檯妯″瀷 |
| `src/App.jsx` | 淇敼 | 鍥哄畾浣跨敤鑷畾涔?setup锛涚Щ闄ら璁惧垏鎹㈢姸鎬?|
| `src/hooks/useDayFlow.js` | 淇敼 | 鐚庝汉杩為攣寮€鏋粨绠楋紱琛屽姩璁板綍鎸佷箙鍖?|
| `src/hooks/useAI.js` | 淇敼 | `identity_table` 娓呮礂 + 妯″瀷杩借釜鍥炶皟 |
| `src/services/identityTableSanitizer.js` | 鏂板缓 | 鍩轰簬瑙掕壊姹犵殑 `identity_table` 绾犲亸 |
| `src/services/aiPrompts.js` | 淇敼 | role pool 绾︽潫鎻愮ず |
| `src/config/aiConfig.js` | 淇敼 | 澧炲姞 GLM-4.7/Flash 妯″瀷 |
| `src/components/GameHistoryTable.jsx` | 淇敼 | thought/object 瀹夊叏娓叉煋 |
| `AGENTS.md` | 鏂板缓 | Codex 椤圭洰鎸囧崡 |
| `.codex/` | 鏂板缓 | Codex 椤圭洰閰嶇疆涓?rules |
| `.agents/skills/*` | 鏂板缓 | Codex skills锛堝榻?Claude commands锛?|
| `.gitignore` | 淇敼 | 蹇界暐 Codex 杩愯鎬佹枃浠?|

---

## [2026-02-06] 娓告垙瑙勫垯寮哄埗鎵ц + 椤甸潰鍏抽棴澶勭悊 + 鏁版嵁搴撳ご鍍忕郴缁?

### 鏂板姛鑳?

- **椤甸潰鍏抽棴鏃剁粓姝㈠鎴?*
  - 娣诲姞鍏ㄥ眬 AbortController 绠＄悊 API 璇锋眰
  - 椤甸潰鍏抽棴/闅愯棌鏃惰嚜鍔ㄥ彇娑堟墍鏈夎繘琛屼腑鐨?API 璋冪敤
  - 椤甸潰鎭㈠鍙鏃堕噸缃?AbortController

- **鐙间汉绂佹绌哄垁**
  - AI 鎻愮ず璇嶆槑纭己鍒?"鐙间汉姣忔櫄蹇呴』琚嚮涓€鍚嶇帺瀹?
  - 鍚庣閫昏緫锛欰I 杩斿洖鏃犳晥鏃堕殢鏈洪€夋嫨鐩爣
  - 绉婚櫎 UI 涓殑 "绌哄垁" 鎸夐挳

- **鐚庝汉蹇呴』寮€鏋?*
  - AI 鎻愮ず璇嶆槑纭?"鐚庝汉姝讳骸鏃跺繀椤诲紑鏋?锛堟瘨姝婚櫎澶栵級
  - 鍚庣閫昏緫锛欰I 杩斿洖鏃犳晥鏃堕殢鏈洪€夋嫨鐩爣
  - UI 绂佺敤鏈€夋嫨鐩爣鏃剁殑寮€鏋寜閽?

- **鏁版嵁搴撳ご鍍忕郴缁?*
  - 鏂板缓 `avatars` 琛ㄥ瓨鍌ㄩ鐢熸垚澶村儚
  - 娣诲姞 `/api/avatars` 鍜?`/api/avatars/batch` API
  - 鍓嶇 `avatarService.js` 浠庢暟鎹簱鑾峰彇澶村儚
  - 鍒涘缓 `scripts/generateAvatars.js` 鐢熸垚鑴氭湰

- **AI 妯″瀷鎺掕姒滄暟鎹簱**
  - 鏂板缓 `game_model_usage` 琛ㄨ褰曟瘡灞€妯″瀷浣跨敤
  - 鏂板缓 `ai_model_stats` 琛ㄨ仛鍚堟ā鍨嬭儨鐜囩粺璁?

### 鏂囦欢鍙樻洿
| 鏂囦欢 | 鎿嶄綔 | 璇存槑 |
|------|------|------|
| `src/services/aiClient.js` | 淇敼 | 娣诲姞 AbortController 绠＄悊 |
| `src/App.jsx` | 淇敼 | 娣诲姞椤甸潰鍏抽棴/鍙鎬у鐞?|
| `src/services/rolePrompts/werewolf.js` | 淇敼 | 娣诲姞绂佹绌哄垁瑙勫垯 |
| `src/services/rolePrompts/hunter.js` | 淇敼 | 娣诲姞蹇呴』寮€鏋鍒?|
| `src/services/aiPrompts.js` | 淇敼 | 鍚屾鏇存柊鐚庝汉鎻愮ず璇?|
| `src/hooks/useDayFlow.js` | 淇敼 | 寮哄埗鐙间汉/鐚庝汉鏈夋晥閫夋嫨 |
| `src/hooks/useNightFlow.js` | 淇敼 | 寮哄埗鐙间汉鏈夋晥閫夋嫨 |
| `src/components/ActionPanel.jsx` | 淇敼 | 绉婚櫎绌哄垁鎸夐挳锛岀鐢ㄦ棤鐩爣寮€鏋?|
| `src/components/CirclePlayerLayout.jsx` | 淇敼 | 绉婚櫎绌哄垁鎸夐挳 |
| `src/services/rolePrompts/witch.js` | 淇敼 | 绉婚櫎 "鐙间汉绌哄垁" 鎻忚堪 |
| `src/services/avatarService.js` | 鏂板缓 | 澶村儚鏈嶅姟锛堜粠鏁版嵁搴撹幏鍙栵級 |
| `src/useWerewolfGame.js` | 淇敼 | 浣跨敤 assignPlayerAvatars |
| `workers/auth/handlers.js` | 淇敼 | 娣诲姞澶村儚 API 澶勭悊鍑芥暟 |
| `workers/auth/index.js` | 淇敼 | 娣诲姞澶村儚 API 璺敱 |
| `schema.sql` | 淇敼 | 娣诲姞 avatars銆乬ame_model_usage銆乤i_model_stats 琛?|
| `scripts/generateAvatars.js` | 鏂板缓 | 澶村儚鐢熸垚鑴氭湰 |

### 鏁版嵁搴撹縼绉?
```sql
-- 棰勭敓鎴愬ご鍍忚〃
CREATE TABLE IF NOT EXISTS avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  personality TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, role, personality)
);

-- AI 妯″瀷娓告垙浣跨敤璁板綍琛?
CREATE TABLE IF NOT EXISTS game_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_session_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  result TEXT CHECK(result IN ('win', 'lose')) NOT NULL,
  game_mode TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI 妯″瀷缁熻鑱氬悎琛?
CREATE TABLE IF NOT EXISTS ai_model_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  role TEXT NOT NULL,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(model_id, role)
);
```

---

## [2026-02-06] 路由改造 + 域名统一 + 令牌安全策略

### 新功能

- **路由结构明确化**
  - `/login` → 登录后 `/home`
  - `/home` 入口：`/sites`、`/wolfgame/custom`
  - `/wolfgame/custom` 配置后进入 `/wolfgame/play`
  - `/wolfgame/play` “结束并返回主页”终止游戏
  - `/sites` 站点聚合页可返回 `/home`
- **新增 Sites 聚合页**
  - 独立页面承载外部站点入口，风格与主页一致
- **SPA 路由回退支持**
  - 新增 `_redirects` 支持直接访问深层路径

### 安全与一致性

- **登录 Token 永不过期**
- **ModelScope 令牌失效自动清空**
- **统一 API 域名与数据库入口**
  - 明确 `https://zhaxiaoji.com` 为唯一线上域名
  - 移除 `workers/auth/wrangler.toml`，避免误部署到旧 Worker
  - 头像服务改为跟随 `VITE_AUTH_API_URL`，不再指向 `*.workers.dev`

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.jsx` | 修改 | 路由与退出游戏流程 |
| `src/components/Dashboard.jsx` | 修改 | 首页入口拆分 |
| `src/components/SitesPage.jsx` | 新增 | 站点聚合页 |
| `public/_redirects` | 新增 | SPA 路由回退 |
| `workers/auth/jwt.js` | 修改 | JWT 永不过期 |
| `workers/auth/handlers.js` | 修改 | 令牌失效自动清空 |
| `src/contexts/AuthContext.jsx` | 修改 | 前端同步清空令牌 |
| `src/services/avatarService.js` | 修改 | 统一 API Base |
| `workers/auth/wrangler.toml` | 删除 | 避免误部署旧 Worker |
| `.claude/commands/deploy.md` | 修改 | 域名与 API 约定 |
| `.codex/rules/default.rules` | 修改 | 域名约束 |
| `AGENTS.md` | 修改 | 域名约定 |
| CLAUDE.md | 修改 | 域名约定 |

## [2026-02-06] 鐚庝汉寤惰繜寮€鏋?+ 琛屽姩鏉挎寔涔呭寲 + 鎻愮ず璇嶆笎杩涘紡鎶湶

### 鏂板姛鑳?

- **鐚庝汉寤惰繜寮€鏋満鍒?*
  - 鐙间汉琚嚮鐚庝汉鍚庯紝濡傛灉濂戒汉鍗犲鏁帮紝鐚庝汉寤惰繜鍒扮櫧澶╁紑鏋?
  - 鏀寔杩為攣寮€鏋細琚甫璧扮殑鐜╁濡傛灉涔熸槸鐚庝汉锛屽彲缁х画寮€鏋紙鏈€澶?灞傦級
  - 鏂板 `isGoodMajority()` 鍑芥暟鍒ゆ柇闃佃惀浼樺娍
  - 鏂板 `pendingHunterShoot` 鐘舵€佺鐞嗗欢杩熷紑鏋?

- **鍏ˋI妯″紡琛屽姩鏉挎寔涔呭寲**
  - 琛屽姩闈㈡澘鐜板湪鏄剧ず鏁村眬娓告垙鐨勬墍鏈夎褰曪紙涓嶅啀姣忓ぉ鍒锋柊锛?
  - 鎶曠エ缁撴灉浣滀负绯荤粺鍏憡鏄剧ず鍦ㄨ鍔ㄥ垪琛ㄤ腑
  - 鎸夋棩/澶滃垎缁勬樉绀猴紙N1 鈫?D1 鈫?N2 鈫?D2...锛?
  - 姣忕粍鏈?sticky 鏍囬甯﹀浘鏍囷紙馃寵绗?澶?/ 鈽€锔忕1澶╋級

- **鎻愮ず璇嶆笎杩涘紡鎶湶鏋舵瀯**
  - 姣忎釜瑙掕壊鏈夌嫭绔嬬殑鎻愮ず璇嶆ā鍧楋紙`src/services/rolePrompts/`锛?
  - 鏍规嵁娓告垙閰嶇疆鍔ㄦ€佽皟鏁存彁绀哄唴瀹癸紙娌℃湁鐨勮鑹蹭笉浼氳鎻愬強锛?
  - 瀹堝崼棣栧绛栫暐鏍规嵁鏈夋棤濂冲帆璋冩暣锛堝悓瀹堝悓鏁戞彁閱掞級
  - 鐙间汉鍒€娉曚紭鍏堢骇鏍规嵁瀛樺湪鐨勮鑹插姩鎬佺敓鎴?

### 鏂囦欢鍙樻洿
| 鏂囦欢 | 鎿嶄綔 | 璇存槑 |
|------|------|------|
| `src/services/rolePrompts/index.js` | 鏂板缓 | 瑙掕壊妯″潡瀵煎嚭鑱氬悎鍣?|
| `src/services/rolePrompts/baseRules.js` | 鏂板缓 | 閫氱敤瑙勫垯鍜岃緟鍔╁嚱鏁?|
| `src/services/rolePrompts/werewolf.js` | 鏂板缓 | 鐙间汉鎻愮ず璇嶆ā鍧?|
| `src/services/rolePrompts/seer.js` | 鏂板缓 | 棰勮█瀹舵彁绀鸿瘝妯″潡 |
| `src/services/rolePrompts/witch.js` | 鏂板缓 | 濂冲帆鎻愮ず璇嶆ā鍧?|
| `src/services/rolePrompts/hunter.js` | 鏂板缓 | 鐚庝汉鎻愮ず璇嶆ā鍧?|
| `src/services/rolePrompts/guard.js` | 鏂板缓 | 瀹堝崼鎻愮ず璇嶆ā鍧?|
| `src/services/rolePrompts/villager.js` | 鏂板缓 | 鏉戞皯鎻愮ず璇嶆ā鍧?|
| `src/services/promptFactory.js` | 鏂板缓 | 娓愯繘寮忔姭闇叉彁绀鸿瘝宸ュ巶 |
| `src/services/aiPrompts.js` | 淇敼 | 闆嗘垚娓愯繘寮忔姭闇叉灦鏋?|
| `src/useWerewolfGame.js` | 淇敼 | 娣诲姞 `pendingHunterShoot` 鐘舵€?|
| `src/App.jsx` | 淇敼 | 娣诲姞 `isGoodMajority()` 鍜屽欢杩熷紑鏋€昏緫 |
| `src/hooks/useDayFlow.js` | 淇敼 | 瀹炵幇杩為攣寮€鏋満鍒?|
| `src/components/GameArena.jsx` | 淇敼 | `getAllActions()` 娣诲姞鎶曠エ鍘嗗彶 |
| `src/components/SidePanels.jsx` | 淇敼 | 娣诲姞鏃?澶滃垎缁勬爣棰?|
| `CLAUDE.md` | 淇敼 | 鏇存柊鐩綍缁撴瀯鍜屽父瑙佷换鍔℃寚鍗?|

### 鎶€鏈粏鑺?
- 寤惰繜寮€鏋姸鎬佹牸寮忥細`{ hunterId, source: 'night', chainDepth: 0 }`
- 杩為攣娣卞害闄愬埗锛歚chainDepth > 3` 鏃跺仠姝㈤€掑綊
- 娓愯繘寮忔姭闇叉牳蹇冨嚱鏁帮細`detectExistingRoles()` 杩斿洖 `{ hasWitch, hasGuard, hasHunter, hasSeer }`
- 鏉′欢鍖栬鍒欓€氳繃 `buildConditionalRules(existingRoles, gameSetup)` 鍔ㄦ€佺敓鎴?

---

## [2026-02-05] 灞犺竟/灞犲煄妯″紡 + AI韬唤鎺ㄧ悊琛?+ 鎬濊€冭繃绋嬭褰?

### Bug 淇
- **AI 妯″瀷鎺掕姒滅綉缁滈敊璇?*
  - 闂锛氭帓琛屾鏄剧ず"缃戠粶閿欒锛岃绋嶅悗閲嶈瘯"
  - 鍘熷洜锛氭暟鎹簱杩佺Щ `002_add_model_stats.sql` 鏈墽琛岋紝`ai_model_stats` 琛ㄤ笉瀛樺湪
  - 淇锛氭墽琛屾暟鎹簱杩佺Щ鍒涘缓琛ㄥ拰绱㈠紩

### 鏂板姛鑳?
- **灞犺竟/灞犲煄鑳滃埄妯″紡閫夋嫨**
  - 灞犺竟妯″紡锛堥粯璁わ級锛氱嫾浜烘潃鍏夋墍鏈夋潙姘戞垨鎵€鏈夌鑱屽嵆鍙儨鍒?
  - 灞犲煄妯″紡锛氱嫾浜哄繀椤绘潃鍏夋墍鏈夊ソ浜猴紙鏉戞皯+绁炶亴锛夋墠鑳借儨鍒?
  - 鍦ㄨ缃晫闈㈡坊鍔犳ā寮忛€夋嫨 UI
  - 鏍规嵁妯″紡鍔ㄦ€佽皟鏁?AI 鎻愮ず璇嶅拰绛栫暐寤鸿

- **AI 韬唤鎺ㄧ悊琛ㄧ郴缁?*
  - 姣忎釜 AI 缁存姢鑷繁鐨勮韩浠芥帹鐞嗚〃锛坄identity_table`锛?
  - 璁板綍瀵规瘡涓帺瀹剁殑韬唤鐚滄祴銆佺疆淇″害锛?-100%锛夊拰鎺ㄧ悊渚濇嵁
  - AI 鍩轰簬鎺掗櫎娉曞拰琛屼负鍒嗘瀽杩涜鎺ㄧ悊
  - 鎺ㄧ悊琛ㄥ湪姣忔鍙戣█鍚庢洿鏂帮紝瀹炵幇鎸佺画鐨勮韩浠借拷韪?

- **AI 鎬濊€冭繃绋嬭褰?*
  - 鍙戣█鍘嗗彶涓繚瀛?AI 鐨?`thought`锛堟€濊€冭繃绋嬶級鍜?`identity_table`锛堟帹鐞嗚〃锛?
  - 瀵煎嚭鐨?txt 璁板綍鏂囦欢鐜板湪鍖呭惈锛?
    - 馃挱 鎬濊€冭繃绋嬶細AI 鍐呴儴鐨勫垎鏋愬拰鎺ㄧ悊
    - 馃棾锔?鎶曠エ鎰忓悜锛欰I 鐨勬姇绁ㄧ洰鏍?
    - 馃搳 韬唤鎺ㄧ悊琛細姣忎釜 AI 瀵瑰満涓婄帺瀹惰韩浠界殑鏈€缁堝垽鏂?

### 鏂囦欢鍙樻洿
| 鏂囦欢 | 鎿嶄綔 | 璇存槑 |
|------|------|------|
| `src/config/roles.js` | 淇敼 | 鏂板 `VICTORY_MODES` 鑳滃埄妯″紡閰嶇疆 |
| `src/components/SetupScreen.jsx` | 淇敼 | 娣诲姞鑳滃埄妯″紡閫夋嫨 UI |
| `src/App.jsx` | 淇敼 | 娣诲姞 `victoryMode` 鐘舵€侊紝淇敼 `checkGameEnd` 鍜屽鍑哄嚱鏁?|
| `src/services/aiPrompts.js` | 淇敼 | 娣诲姞 `VICTORY_MODE_PROMPTS`銆乣IDENTITY_TABLE_PROMPT`锛屼慨鏀硅緭鍑烘牸寮?|
| `src/hooks/useAI.js` | 淇敼 | 娣诲姞 `identityTablesRef` 瀛樺偍鎺ㄧ悊琛紝浼犻€?`victoryMode` |
| `migrations/002_add_model_stats.sql` | 鎵ц | 鍒涘缓 `ai_model_stats` 鍜?`game_model_usage` 琛?|

### 鎶€鏈粏鑺?
- 韬唤鎺ㄧ悊琛ㄦ牸寮忥細`{"鐜╁鍙?: {"suspect": "瑙掕壊鐚滄祴", "confidence": 0-100, "reason": "鎺ㄧ悊渚濇嵁"}}`
- 鑳滃埄鏉′欢鍒ゆ柇鍦?`checkGameEnd` 鍑芥暟涓牴鎹?`victoryMode` 鍔ㄦ€佸垏鎹?
- AI 鎻愮ず璇嶆牴鎹鑹查樀钀ユ樉绀轰笉鍚岀殑鑳滃埄鐩爣鍜岀瓥鐣ュ缓璁?

---

## [2026-02-05] 鑷畾涔夎鑹查€夋嫨鍔熻兘

### 鏂板姛鑳?
- **鑷畾涔夎鑹查厤缃郴缁?*
  - 鐜╁鍙嚜鐢遍€夋嫨鍙備笌娓告垙鐨勮鑹诧紝涓嶅啀灞€闄愪簬鍥哄畾妯″紡
  - 鏂板 `RoleSelector` 缁勪欢锛屾彁渚涚洿瑙傜殑瑙掕壊閫夋嫨鐣岄潰
  - 瑙掕壊鍒嗙被灞曠ず锛氱嫾浜洪樀钀ワ紙绾㈣壊锛夈€佺鑱岃鑹诧紙鐞ョ弨鑹诧級銆佸ソ浜洪樀钀ワ紙缁胯壊锛?
  - 鍞竴瑙掕壊锛堥瑷€瀹?濂冲帆/瀹堝崼锛変娇鐢ㄥ紑鍏抽€夋嫨锛屾渶澶?涓?
  - 澶氶€夎鑹诧紙鐙间汉/鏉戞皯/鐚庝汉锛変娇鐢?+/- 鎸夐挳璋冩暣鏁伴噺

- **瑙掕壊鍏冩暟鎹郴缁?* (`ROLE_METADATA`)
  - 涓烘瘡涓鑹插畾涔夌害鏉熸潯浠讹紙maxCount锛夊拰澶滈棿琛屽姩椤哄簭锛坣ightOrder锛?
  - 鏀寔鍔ㄦ€佺敓鎴愬闂磋鍔ㄩ『搴?`generateNightSequence()`
  - 鑷姩鐢熸垚閰嶇疆鎻忚堪瀛楃涓?`generateDescription()`

- **閰嶇疆楠岃瘉绯荤粺**
  - 瀹炴椂楠岃瘉锛氭€讳汉鏁?4-10 浜恒€佽嚦灏?鍚嶇嫾浜恒€佸ソ浜烘暟閲忓浜庣嫾浜?
  - 閿欒鎻愮ず锛堢孩鑹诧級闃绘寮€濮嬫父鎴?
  - 璀﹀憡鎻愮ず锛堢惀鐝€鑹诧級浠呮彁绀轰絾涓嶉樆姝紙濡傜嫾浜烘瘮渚嬪亸楂橈級

### 鏂囦欢鍙樻洿
| 鏂囦欢 | 鎿嶄綔 | 璇存槑 |
|------|------|------|
| `src/config/roles.js` | 淇敼 | 鏂板 ROLE_METADATA銆侀獙璇佸嚱鏁般€佸伐鍏峰嚱鏁?|
| `src/components/RoleSelector.jsx` | 鏂板缓 | 瑙掕壊閫夋嫨鍣?UI 缁勪欢 |
| `src/components/SetupScreen.jsx` | 淇敼 | 闆嗘垚鑷畾涔夋寜閽拰 RoleSelector |
| `src/App.jsx` | 淇敼 | 鐘舵€佹彁鍗囥€佷紶閫掓柊 props |
| `src/components/ModelLeaderboard.jsx` | 淇 | 淇 authService 瀵煎叆閿欒 |

### 鎶€鏈粏鑺?
- 澶滈棿椤哄簭鏍规嵁 `nightOrder` 鏁板€艰嚜鍔ㄦ帓搴忥紝娣诲姞鏂拌鑹插彧闇€鍦?`ROLE_METADATA` 涓畾涔?
- 鍚戝悗鍏煎锛氶璁炬ā寮忥紙8浜哄眬銆?浜哄眬锛夊畬鍏ㄤ繚鐣?
- 鑷畾涔夐厤缃湪寮€濮嬫父鎴忔椂鏋勫缓锛屽鐢ㄧ幇鏈夌殑 `selectedSetup` 鐘舵€?

---

## [2026-02-05] AI 妯″瀷鎺掕姒滅郴缁?+ 娓告垙閫昏緫浼樺寲

### 鏂板姛鑳?
- **AI 妯″瀷鎺掕姒滅郴缁?*
  - 娣诲姞鏁版嵁搴撹〃杩借釜姣忎釜 AI 妯″瀷鍦ㄤ笉鍚岃鑹蹭笅鐨勮〃鐜扮粺璁?
  - 瀹炵幇绛夋鐜囬殢鏈烘ā鍨嬮€夋嫨鏈哄埗锛岀‘淇濆叕骞崇珵浜?
  - 娓告垙缁撴潫鏃惰嚜鍔ㄤ笂鎶ユā鍨嬩娇鐢ㄦ暟鎹拰缁撴灉
  - 鏂板鍚庣 API 绔偣锛?
    - `POST /api/model-stats` - 鎻愪氦妯″瀷娓告垙缁熻
    - `GET /api/model-leaderboard` - 鑾峰彇妯″瀷鎺掕姒滐紙鏀寔鎸夎鑹茬瓫閫夊拰鎺掑簭锛?
  - 鏂板鍓嶇鎺掕姒滅粍浠?`ModelLeaderboard.jsx`
    - 鏄剧ず妯″瀷鑳滅巼銆佹€诲満娆°€佽儨璐熻褰?
    - 鏀寔鎸夎鑹茬瓫閫夊拰澶氱鎺掑簭鏂瑰紡锛堣儨鐜?鎬诲満娆?鑳滃満锛?
    - 鎵€鏈夋敞鍐岀敤鎴峰彲瑙侊紝闆嗘垚鍒?Dashboard 涓婚〉

### 浼樺寲鏀硅繘
- **AI 妯″瀷璋冪敤浼樺寲**
  - 淇敼 AI 瀹㈡埛绔粠鍩轰簬鐜╁ ID 鐨勮疆璇㈡敼涓虹湡闅忔満閫夋嫨
  - 娣诲姞妯″瀷浣跨敤杩借釜锛屾瘡娆?AI 璋冪敤璁板綍浣跨敤鐨勬ā鍨嬩俊鎭?
  - 娓告垙鐘舵€佹柊澧?`modelUsage` 瀛楁杩借釜鏁村眬娓告垙鐨勬ā鍨嬩娇鐢?

- **娓告垙閫昏緫鏀硅繘**
  - 淇鐜╁妯″紡涓嬫姇绁ㄨ褰曚笉鏄剧ず闂
  - 娣诲姞韬唤鎺ㄧ悊绯荤粺锛孉I 鍙牴鎹父鎴忛厤缃帹鏂鑹茶韩浠?
    - 绀轰緥锛?鍙湁1鍙疯烦棰勮█瀹讹紝澶ф鐜囨槸鐪熼瑷€瀹讹紙鏈眬鍙湁1涓瑷€瀹讹級"
  - 鐧藉ぉ鎶曠エ澧炲姞鎬濊€冭繃绋嬭褰曪紝鏄剧ず鎶曠エ鍘熷洜
  - 浼樺寲鎶曠エ娴佺▼涓哄苟琛屾墽琛岋紝澶у箙鍑忓皯绛夊緟鏃堕棿
  - 濂冲帆绛栫暐璋冩暣涓哄熀浜庢帹鐞嗚€岄潪"涓婂笣瑙嗚"
    - 涓嶅啀鐩存帴鍛婄煡濂戒汉/鐙间汉鍓╀綑鏁伴噺
    - 寮曞濂冲帆閫氳繃鏃堕棿绾裤€佸巻鍙叉浜°€佹煡楠岃褰曡嚜宸辨帹鏂眬鍔?

### 鏁版嵁搴撳彉鏇?
**杩佺Щ鏂囦欢**: `migrations/002_add_model_stats.sql`

鏂板琛細
1. **ai_model_stats** - AI 妯″瀷缁熻鑱氬悎琛?
   ```sql
   CREATE TABLE ai_model_stats (
     id INTEGER PRIMARY KEY,
     model_id TEXT NOT NULL,
     model_name TEXT NOT NULL,
     role TEXT NOT NULL,
     total_games INTEGER DEFAULT 0,
     wins INTEGER DEFAULT 0,
     losses INTEGER DEFAULT 0,
     win_rate REAL DEFAULT 0.0,
     created_at TIMESTAMP,
     updated_at TIMESTAMP,
     UNIQUE(model_id, role)
   );
   ```

2. **game_model_usage** - 娓告垙妯″瀷浣跨敤璁板綍琛?
   ```sql
   CREATE TABLE game_model_usage (
     id INTEGER PRIMARY KEY,
     game_session_id TEXT NOT NULL,
     player_id INTEGER NOT NULL,
     role TEXT NOT NULL,
     model_id TEXT NOT NULL,
     model_name TEXT NOT NULL,
     result TEXT CHECK(result IN ('win', 'lose')),
     game_mode TEXT NOT NULL,
     duration_seconds INTEGER,
     created_at TIMESTAMP
   );
   ```

### 淇敼鏂囦欢鍒楄〃
**鍓嶇**:
- `src/services/aiClient.js` - 闅忔満妯″瀷閫夋嫨鍜屼俊鎭拷韪?
- `src/hooks/useAI.js` - 妯″瀷浣跨敤鍥炶皟
- `src/useWerewolfGame.js` - 妯″瀷杩借釜鐘舵€佺鐞?
- `src/App.jsx` - 娓告垙缁撴潫鏃朵笂鎶ョ粺璁?
- `src/services/authService.js` - 鏂板 API 璋冪敤鏂规硶
- `src/components/ModelLeaderboard.jsx` - **鏂板**鎺掕姒滅粍浠?
- `src/components/Dashboard.jsx` - 闆嗘垚鎺掕姒滅粍浠?
- `src/hooks/useDayFlow.js` - 浼樺寲鎶曠エ閫昏緫涓哄苟琛屾墽琛?
- `src/services/aiPrompts.js` - 娣诲姞韬唤鎺ㄧ悊鍜屽コ宸帹鐞嗗紩瀵?

**鍚庣**:
- `workers/auth/handlers.js` - 鏂板缁熻澶勭悊閫昏緫
- `workers/auth/index.js` - 鏂板璺敱

### 閮ㄧ讲鍛戒护
```bash
# 搴旂敤鏁版嵁搴撹縼绉?
npx wrangler d1 execute wolfgame-db --remote --file=migrations/002_add_model_stats.sql

# 鏋勫缓骞堕儴缃?
npm run build
npm run deploy
```

### 楠岃瘉鍛戒护
```bash
# 鏌ョ湅鏂拌〃缁撴瀯
npx wrangler d1 execute wolfgame-db --remote --command "SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('ai_model_stats', 'game_model_usage');"

# 鏌ョ湅鎺掕姒滄暟鎹?
npx wrangler d1 execute wolfgame-db --remote --command "SELECT * FROM ai_model_stats ORDER BY win_rate DESC LIMIT 10;"
```

---

## [2026-02-04] 淇 Cloudflare 閮ㄧ讲鍜屼护鐗岄獙璇佸姛鑳?

### 闂鎻忚堪
- 鐢ㄦ埛鐧诲綍鍚庨厤缃?ModelScope 浠ょ墝鏃舵姤閿?"Not found"
- Cloudflare 閮ㄧ讲澶辫触锛岄敊璇? `binding DB of type d1 must have a valid id specified`

### 鏍规湰鍘熷洜鍒嗘瀽
1. **wrangler.toml 閰嶇疆閿欒**
   - `database_id` 浣跨敤鍗犱綅绗?`"your-database-id-here"` 鑰岄潪瀹為檯 ID
   - `database_name` 涓嶅尮閰?(`wolfgame_db` vs 瀹為檯鐨?`wolfgame-db`)

2. **JWT_SECRET 鏈厤缃?*
   - Cloudflare Workers Secret 鏈缃?
   - 瀵艰嚧鐧诲綍鏃?HMAC 绛惧悕澶辫触 (key length = 0)

3. **鏁版嵁搴?Schema 涓嶅畬鏁?*
   - `users` 琛ㄧ己灏?`modelscope_token` 鍜?`token_verified_at` 鍒?
   - 琛ㄧ粨鏋勪笌 `schema.sql` 瀹氫箟涓嶅悓姝?

### 淇鍐呭

#### 1. 淇 wrangler.toml 閰嶇疆
```toml
# 淇敼鍓?
[[d1_databases]]
binding = "DB"
database_name = "wolfgame_db"
database_id = "your-database-id-here"

# 淇敼鍚?
[[d1_databases]]
binding = "DB"
database_name = "wolfgame-db"
database_id = "f54315ad-c129-41e4-a23d-82463488d315"
```

#### 2. 閰嶇疆 JWT_SECRET
```bash
npx wrangler secret put JWT_SECRET
# 杈撳叆 32 瀛楄妭闅忔満瀵嗛挜
```

#### 3. 鏁版嵁搴撹縼绉?- 娣诲姞浠ょ墝鐩稿叧鍒?
```sql
ALTER TABLE users ADD COLUMN modelscope_token TEXT;
ALTER TABLE users ADD COLUMN token_verified_at TIMESTAMP;
```

### 淇鍚庣殑 users 琛ㄧ粨鏋?
| 鍒楀悕 | 绫诲瀷 | 璇存槑 |
|------|------|------|
| id | INTEGER | 涓婚敭 |
| username | TEXT | 鐢ㄦ埛鍚?|
| email | TEXT | 閭 |
| password_hash | TEXT | 瀵嗙爜鍝堝笇 |
| email_verified | INTEGER | 閭楠岃瘉鐘舵€?|
| created_at | TIMESTAMP | 鍒涘缓鏃堕棿 |
| updated_at | TIMESTAMP | 鏇存柊鏃堕棿 |
| last_login | TIMESTAMP | 鏈€鍚庣櫥褰曟椂闂?|
| **modelscope_token** | TEXT | ModelScope API 浠ょ墝 (鏂板) |
| **token_verified_at** | TIMESTAMP | 浠ょ墝楠岃瘉鏃堕棿 (鏂板) |

### 楠岃瘉鍛戒护
```bash
# 鏌ョ湅 D1 鏁版嵁搴撳垪琛?
npx wrangler d1 list

# 鏌ョ湅 Secrets 閰嶇疆
npx wrangler secret list

# 鏌ョ湅琛ㄧ粨鏋?
npx wrangler d1 execute wolfgame-db --remote --command "PRAGMA table_info(users);"

# 閮ㄧ讲
npm run build && npm run deploy
```

### 缁忛獙鏁欒
1. **閰嶇疆鏂囦欢妫€鏌?*: 閮ㄧ讲鍓嶇‘淇?`wrangler.toml` 涓病鏈夊崰浣嶇
2. **Secrets 绠＄悊**: Workers Secrets 闇€瑕佸崟鐙厤缃紝涓嶈兘鍐欏湪浠ｇ爜涓?
3. **鏁版嵁搴撹縼绉?*: 鐢熶骇鐜琛ㄧ粨鏋勫彉鏇撮渶瑕佹墜鍔ㄦ墽琛?`ALTER TABLE`
4. **鐗堟湰淇濈暀**: Cloudflare Workers 閮ㄧ讲澶辫触鏃舵棫鐗堟湰缁х画杩愯锛岄渶娉ㄦ剰鏂板姛鑳藉彲鑳芥湭涓婄嚎

---

## 鍘嗗彶鐗堟湰

### [2026-01-23] 鍒濆鐗堟湰
- 鍒涘缓 D1 鏁版嵁搴?`wolfgame-db`
- 閮ㄧ讲鍩虹璁よ瘉绯荤粺
- 瀹炵幇鐢ㄦ埛娉ㄥ唽/鐧诲綍鍔熻兘



