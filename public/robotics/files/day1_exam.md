# Day 1 考核 · 建包与第一个话题

**限时：90 分钟**（本时限为初版，会按首批学员实测结果调整）
**满分：100 分，及格线 60 分**
**允许查阅**：本课程讲义、ROS2 Humble 官方文档
**禁止**：整段复制示例代码。`examples/day1/my_robot` 是给你理解用的，逻辑要自己写

---

## 场景

你要做一条最简单的数据链路：一个节点持续报数，另一个节点收到后加工再发出去。
这是后面所有内容的地基——Day 3 的传感器数据、Day 5 的小车里程计，形态都是这个。

## 交付物

一个能编译、能运行的 ROS2 package。

## 硬性要求（评分脚本按这些名字查，写错就是 0 分）

| 项 | 必须是 |
|---|---|
| 包名 | `my_robot`（Day 1 已建好，直接改它，不要另建新包） |
| 构建类型 | `ament_python` |
| 可执行名 1 | `talker` |
| 可执行名 2 | `listener` |
| `talker` 的节点名 | `talker` |
| `listener` 的节点名 | `listener` |
| 输入话题 | `/counter` |
| 输出话题 | `/counter_doubled` |
| 两个话题的类型 | `std_msgs/msg/Int32` |
| `talker` 发布频率 | **5 Hz**（容差 4~6 Hz） |

> 话题名开头的 `/` 不能省。省了会变成相对话题名，评分脚本找不到。

## 任务

在 Day 1 讲义做出来的 `~/ros2_lab/src/my_robot` 上继续改，**不要新建包**：

1. 改 `talker`：把发布频率从讲义里的 2 Hz 改成 **5 Hz**（想想定时器周期该填多少）
2. 改 `listener`：不只是打印，还要把收到的值**乘 2**，发布到 `/counter_doubled`
   （一个节点既订阅又发布，这很常见）
3. 两个话题名都用**绝对名**（开头带 `/`），即 `/counter` 与 `/counter_doubled`
4. `colcon build` 通过，`source install/setup.bash` 后两个节点都能用 `ros2 run` 启动

## 验收方式

开三个终端，**每个终端都要先 source**：

```bash
# 终端 1
cd ~/ros2_lab
colcon build --packages-select my_robot
source install/setup.bash
ros2 run my_robot talker

# 终端 2
cd ~/ros2_lab
source install/setup.bash
ros2 run my_robot listener

# 终端 3
cd ~/ros2_lab
source install/setup.bash
python3 ~/Tutorials4intern/grading/grade_day1.py
```

## 评分细则

| 检查项 | 分值 | 怎么判 |
|---|---|---|
| `/counter` 存在且类型为 `Int32` | 25 | 内省话题表 |
| `/counter` 频率在 4~6 Hz | 20 | 实测 3 秒内到达间隔 |
| 节点 `listener` 正在运行 | 15 | 内省节点表 |
| 倍增逻辑正确 | 40 | 向 `/counter` 注入哨兵值 `123457`，检查 `/counter_doubled` 上是否出现 `246914` |

> 倍增这一项不是"比较两个话题的当前值"——你的计数器一直在涨，那样比不出结果。
> 脚本会主动往输入话题发一个特殊值，看你的 `listener` 有没有正确加工并发出来。
> 所以**你的 `listener` 必须真的处理收到的消息**，自己另发一串数是过不了的。

## 常见丢分点

- 忘了 `source install/setup.bash`，`ros2 run` 报 `Package 'my_robot' not found`
- `setup.py` 的 `entry_points` 里可执行名写错，或改完没重新 `colcon build`，
  报 `No executable found`。用 `ros2 pkg executables my_robot` 确认实际有哪些名字
- 节点名写成了文件名。节点名由 `super().__init__('talker')` 决定
- 话题名漏了开头的 `/`
- 定时器周期写成 5（那是 5 秒一次，不是 5 Hz）。5 Hz 对应 `0.2` 秒
- `listener` 自己另发一串数，没有真的处理收到的消息——注入哨兵值那一项会直接归零
