# Day 2 考核 · 包结构、library 与 launch

**限时：90 分钟**（本时限为初版，会按首批学员实测结果调整）
**满分：100 分，及格线 60 分**
**允许查阅**：本课程讲义、ROS2 Humble 官方文档
**禁止**：整段复制示例代码。`examples/day2/my_robot` 是给你理解用的，逻辑要自己写

---

## 场景

Day 1 的两个节点能跑了，但有三个工程问题：乘法逻辑写死在节点里没法复用、
倍数 2 写死在代码里改一次要重编译、启动要开两个终端各敲一条命令。
今天把它改造成正规工程的样子：逻辑进 library、参数进 YAML、启动进 launch。

## 交付物

还是那个 `my_robot` 包，在 Day 1 的基础上重构。**一条命令启动全部**：

```bash
ros2 launch my_robot robot.launch.py
```

## 硬性要求（评分脚本按这些名字查，写错就是 0 分）

| 项 | 必须是 |
|---|---|
| 包名 | `my_robot`（仍是同一个包，不要新建） |
| 可执行名 | `talker`、`listener` |
| launch 文件 | `launch/robot.launch.py` |
| 参数文件 | `config/params.yaml` |
| 两个节点的 namespace | `robot1`（由 launch 给，不要写死在代码里） |
| 实际话题 | `/robot1/counter`、`/robot1/counter_doubled` |
| 类型 | `std_msgs/msg/Int32` |
| talker 频率 | 5 Hz，由参数 `publish_hz: 5.0` 提供 |
| listener 倍数 | 由参数 `multiplier: 2` 提供 |
| 共用库 | `my_robot/math_lib.py`，乘法函数 `scale(value, factor)` |

> 话题名在**代码里写相对名** `counter` / `counter_doubled`（不带开头的 `/`）。
> 带 `/` 的绝对名不吃 namespace，launch 里给的 `robot1` 会失效——这是今天最重要的知识点之一。

## 任务

1. 在 `~/ros2_lab/src/my_robot` 里继续改，包名、目录都不动
2. 新建 `my_robot/math_lib.py`，把乘法逻辑抽成 `scale(value, factor)`，
   `listener` 从库导入使用
3. 两个节点分别 `declare_parameter`：`talker` 的 `publish_hz`（默认随意），
   `listener` 的 `multiplier`（默认随意）；实际值一律由 YAML 提供
4. 写 `config/params.yaml`，注意顶层键是**节点全名**（含 namespace）
5. 写 `launch/robot.launch.py`：两个 `Node`，`namespace='robot1'`，`parameters=[yaml路径]`
6. `setup.py` 的 `data_files` 把 `launch/` 与 `config/` 装进 share 目录

## 验收方式

两个终端，**都要先 source**：

```bash
# 终端 1
cd ~/ros2_lab
colcon build --packages-select my_robot
source install/setup.bash
ros2 launch my_robot robot.launch.py

# 终端 2
cd ~/ros2_lab
source install/setup.bash
python3 ~/Tutorials4intern/grading/grade_day2.py
```

## 评分细则

| 检查项 | 分值 | 怎么判 |
|---|---|---|
| 节点 `/robot1/talker` 在运行 | 15 | 内省节点表（namespace 必须正确） |
| 节点 `/robot1/listener` 在运行 | 15 | 同上 |
| 话题 `/robot1/counter` 存在且类型 `Int32` | 13 | 内省话题表 |
| 话题 `/robot1/counter_doubled` 存在且类型 `Int32` | 12 | 同上 |
| `multiplier` 参数从 YAML 加载成功 | 20 | `ros2 param get /robot1/listener multiplier` 必须返回 2 |
| 倍增逻辑正确 | 25 | 注入哨兵值 `123457`，输出话题上须出现 `246914` |

> 参数那一项查的是**节点里的真实值**。YAML 键写错时 ROS2 不报错，
> 节点会拿 `declare_parameter` 的默认值继续跑——所以默认值别写 2，
> 否则你自己也发现不了 YAML 没生效。

## 常见丢分点

- `setup.py` 忘写 `data_files` 的 launch/config 两行：`colcon build` 不报错，
  `ros2 launch` 报 `file 'robot.launch.py' was not found in the share directory`
- 曾经装成功过、后来改坏 `setup.py` 却看不出来——旧文件还残留在 `install/` 里。
  排查这类"改了没生效"：`rm -rf build/my_robot install/my_robot` 后重新 build
- 代码里话题名没改成相对名（还带着开头的 `/`）：namespace 不生效，话题跑到根下面
- `params.yaml` 顶层键写成 `listener:` 或 `/listener:`：参数静默失效，
  评分第 5 项拿到的是你的默认值
- 忘了 `declare_parameter` 就去 `get_parameter`：节点启动即崩，报
  `ParameterNotDeclaredException: ('Invalid access to undeclared parameter(s)', 'multiplier')`
- 改了 `launch/` 或 `config/` 里的文件没重新 `colcon build`：
  `ros2 launch` 用的是 `install/` 里的旧副本
