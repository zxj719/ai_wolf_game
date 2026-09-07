# Day 3 考核 · 传感器话题、QoS 与数据记录

**限时：90 分钟**（本时限为初版，会按首批学员实测结果调整）
**满分：100 分，及格线 60 分**
**允许查阅**：本课程讲义、ROS2 Humble 官方文档
**禁止**：整段复制示例代码。`examples/day3/my_robot` 是给你理解用的，逻辑要自己写

---

## 场景

Day 2 结束时，`my_robot` 已经有 `talker` / `listener` / launch / 参数文件。
今天给它接上第一个**传感器**：一个模拟 IMU 按 50 Hz 输出加速度与角速度，
另一个节点订阅后算出线加速度的模长再发布出去。

传感器数据和前两天的计数器有三点不同，这三点就是今天的考点：

1. 消息带 `header`（时间戳 + 坐标系），不能不填
2. 高频、允许丢帧，所以用 `BEST_EFFORT` 而不是默认的可靠传输
3. 数据要能录下来离线回放

## 交付物

还是那个 `my_robot` 包。**一条命令启动全部四个节点**：

```bash
ros2 launch my_robot robot.launch.py
```

外加一个录制好的数据包（见任务四）。

## 硬性要求（评分脚本按这些名字查，写错就是 0 分）

| 项 | 必须是 |
|---|---|
| 包名 | `my_robot`（仍是同一个包，不要新建）|
| 新增可执行名 | `imu_talker`、`imu_listener` |
| 节点名 | `imu_talker`、`imu_listener` |
| namespace | `robot1`（由 launch 给）|
| 传感器话题 | `/robot1/imu/data`，类型 `sensor_msgs/msg/Imu` |
| 输出话题 | `/robot1/imu/magnitude`，类型 `std_msgs/msg/Float64` |
| 发布频率 | 50 Hz，由参数 `imu_hz: 50.0` 提供 |
| `header.frame_id` | `imu_link`，由参数 `frame_id` 提供 |
| `imu/data` 的 QoS | 发布端与订阅端都用 `BEST_EFFORT` + `KEEP_LAST` + `depth=10` |
| 模长函数 | 放进 `my_robot/math_lib.py`，签名 `magnitude(x, y, z)` |

> 话题名在**代码里写相对名** `imu/data` / `imu/magnitude`（不带开头的 `/`）。
> 这一条 Day 2 已经考过，今天继续适用。

## 任务与分值

### 任务一：IMU 发布节点（35 分）

新建 `my_robot/imu_talker.py`：

- 节点名 `imu_talker`，发布 `sensor_msgs/msg/Imu` 到相对话题 `imu/data`
- 频率与 `frame_id` 都从参数读取，参数写在 `config/params.yaml` 里
- 每条消息必须填 `header.stamp`（用 `self.get_clock().now().to_msg()`）
  与 `header.frame_id`
- `linear_acceleration.z` 填重力 `9.81`，`x` 可以叠一个随时间变化的小量
- QoS 必须是 `BEST_EFFORT` + `KEEP_LAST` + `depth=10`

| 检查项 | 分值 |
|---|---|
| 节点 `/robot1/imu_talker` 在运行 | 10 |
| 话题 `/robot1/imu/data` 存在且类型为 `sensor_msgs/msg/Imu` | 15 |
| 发布频率在 45–55 Hz | 15 |
| `header.frame_id` 等于 `imu_link` | 10 |
| 发布端 QoS 为 `BEST_EFFORT` | 10 |

> [!WARNING]
> QoS 那一项只写 `create_publisher(Imu, 'imu/data', 10)` 会得 0 分——
> 那个 `10` 是默认的 `RELIABLE`。必须显式构造 `QoSProfile`。

### 任务二：订阅并加工（30 分）

新建 `my_robot/imu_listener.py`：

- 节点名 `imu_listener`，订阅 `imu/data`，QoS 与发布端一致
- 调用 `math_lib.magnitude(x, y, z)` 算线加速度模长
- 把结果以 `std_msgs/msg/Float64` 发布到相对话题 `imu/magnitude`

| 检查项 | 分值 |
|---|---|
| 节点 `/robot1/imu_listener` 在运行 | 10 |
| 话题 `/robot1/imu/magnitude` 存在且类型为 `std_msgs/msg/Float64` | 10 |
| 模长计算正确 | 20 |

模长这一项的判法：脚本会**主动向 `/robot1/imu/data` 注入一条
线加速度为 `(3.0, 4.0, 12.0)` 的消息**，然后在 `/robot1/imu/magnitude` 上
找有没有出现 `13.0`。所以：

- 只把 `z` 轴透传过去 → 拿不到 13.0，0 分
- 自己另发一串数、不真正处理输入 → 0 分
- QoS 配错导致回调根本不被调用 → 0 分

### 任务三：登记与启动（25 分，并入上面两项一起判）

新节点要在四个地方登记，漏一处就跑不起来：

1. `package.xml` 加 `<depend>sensor_msgs</depend>`
2. `setup.py` 的 `entry_points` 加两个可执行
3. `config/params.yaml` 加 `/robot1/imu_talker` 的参数段
4. `launch/robot.launch.py` 加两个 `Node(...)`，namespace 仍是 `robot1`

这部分不单独给分，但**做不到就没法一条命令启动四个节点**，
上面所有检查项都会连带失分。

### 任务四：录制数据包（人工检查，10 分）

用 `ros2 bag` 录制至少 10 秒，同时包含两个话题：

```bash
ros2 bag record -o ~/ros2_lab/imu_bag /robot1/imu/data /robot1/imu/magnitude
```

提交时 `~/ros2_lab/imu_bag/` 目录下要同时有 `.db3` 和 `metadata.yaml`。
验收方式：停掉所有节点后 `ros2 bag play`，两个话题应重新出现，
`ros2 topic hz /robot1/imu/data` 仍在 50 Hz 左右。

> [!NOTE]
> 这一项评分脚本不查，由带你的人当面验收。

## 怎么自测

```bash
# 终端 1
cd ~/ros2_lab
colcon build --packages-select my_robot
source install/setup.bash
ros2 launch my_robot robot.launch.py

# 终端 2
cd ~/ros2_lab && source install/setup.bash
python3 ~/Tutorials4intern/grading/grade_day3.py
```

全部做对是这样：

```text
===== day3 评分结果 =====
[通过] 节点 /robot1/imu_talker 正在运行  (10/10 分)
[通过] 节点 /robot1/imu_listener 正在运行  (10/10 分)
[通过] 话题 /robot1/imu/data 存在且类型正确  (15/15 分)
[通过] 话题 /robot1/imu/magnitude 存在且类型正确  (10/10 分)
[通过] 话题 /robot1/imu/data 频率在 45.0~55.0 Hz  (15/15 分)
[通过] /robot1/imu/data 的 header.frame_id 等于 imu_link  (10/10 分)
[通过] imu/data 发布端 QoS 为 BEST_EFFORT  (10/10 分)
[通过] 模长计算正确  (20/20 分)
----------------------------------
总分：100 / 100
```

漏了 `imu_listener` 是这样——脚本会把当前真实的节点列表和话题列表打出来，
照着对就知道差在哪：

```text
[未通过] 节点 /robot1/imu_listener 正在运行  (0/10 分)
    期望：节点列表中存在 /robot1/imu_listener
    实际：当前节点列表：['/robot1/imu_talker', '_ros2cli_daemon_77_...', 'grader_probe']
    建议：四个节点应由同一个 launch 文件一起启动
[未通过] 话题 /robot1/imu/magnitude 存在  (0/10 分)
    实际：未找到该话题。当前话题：['/parameter_events', '/robot1/imu/data', '/rosout']
----------------------------------
总分：60 / 100
```

列表里的 `grader_probe` 是评分脚本自己的节点，`_ros2cli_daemon_*` 是
ROS2 命令行工具的后台进程，都不用管。

## 常见丢分点

- `create_publisher` 第三个参数直接写 `10`，没有构造 `QoSProfile` → QoS 那项 0 分
- 订阅端 QoS 与发布端不一致 → 回调不被调用，模长那项直接 0 分。
  用 `ros2 topic info /robot1/imu/data --verbose` 对比两端
- 话题名写成 `/imu/data`（带斜杠）→ 不吃 namespace，跑到根下面去了
- 忘了填 `header.frame_id`，或写死成别的字符串
- 定时器周期写成 `50`（那是 50 秒一次）。50 Hz 对应 `1/50 = 0.02` 秒
- 模长只算了 `z`，漏掉 `x`、`y`
- `params.yaml` 的键写成 `imu_talker` 或 `/imu_talker` → 参数静默失效，
  节点用 `declare_parameter` 的默认值继续跑，不报任何错
- 改完 `setup.py` 没重新 `colcon build` → `No executable found`
