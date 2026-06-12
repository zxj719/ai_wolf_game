# 网球游戏 · 待用户拍板决策

---

## [2026-06-12] Elza 控制流 100% 胜率 · 结构性问题

**当前数据（仿真，tellReader avg vs 55-65 中档对手）：**
- Elza（控制流）：**100.0%**（已经连续 3 轮保持，本轮 balance patch 无效）
- 对比：诚 96.5%、菲比 85.6%、丫 88.6%

**根本原因（非数值失衡，是配招集设计问题）：**

Elza 的配招：`[slice, dropShot, lob, volley]`

- slice 克 topspin（1.5×）
- dropShot 克 flatDrive（1.5×）
- lob 克 volley（1.5×）
- volley 克 dropShot / slice（1.5×）

这 4 招对所有角色的所有配招几乎都有反制，加上 tellReader 75% 准确读招，Elza 几乎永远在打顺风球。同时 slice 低耗（已从 -10 改到 -3），体力从不耗尽，energyPenalty 始终 1.0。

**本轮已做的小修（直接实现）：**
- slice energyCost：-10 → -3（减少体力回复，铁蛋受影响 99.9%→96.8%，Elza 无影响）
- lob powerFactor：0.90 → 0.86（轻微削输出，对 Elza 无显著影响）

**待拍板的修复方案：**

### 方案 A（推荐）：替换 Elza 配招之一，破坏反制覆盖性
将 Elza 的 `dropShot`（克 flatDrive）换成 `topspin`：
- 新配招：`[slice, topspin, lob, volley]`
- 代价：Elza 对 flatDrive 不再有直接反制 → 理论胜率约 88-93%
- 收益：维持角色风格（仍是控制流），去掉一个反制点
- 风险：改变已有玩家对 Elza 的经验（她的绝技"狐步幻影"依然兼容）

### 方案 B：增大 lob 和 dropShot 的 powerFactor 削减
- dropShot: 0.95 → 0.78，lob: 0.86 → 0.76，slice: 0.85 → 0.74
- 需维持单调性：0.74 ≤ 0.76 ≤ 0.78 ≤ 1.05 ✓
- 利：不改配招集，对其他角色影响小
- 弊：大幅削弱了玩家选 Elza 时的体验；控制系招式仿真降幅难以精准预测

### 方案 C（接受现状）
- Elza 理论胜率 100% 仅出现在"完美 tellReader avg"场景
- 真实玩家读招不完美、不总是选最优招，实际体验中 Elza 不会 100% 胜
- 接受此数据异常，后续靠真实遥测数据（/api/tennis/telemetry/summary）监控 Elza 实际胜率

**建议：用户反馈遥测数据 Elza 实际胜率超过 70% 时再动手术（方案 A）。**

---
