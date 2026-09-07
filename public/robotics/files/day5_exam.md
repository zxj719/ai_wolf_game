# Day 5 考核 · 按给定参数写出小车模型

**限时：一天**（做不完顺延为周末作业，第 2 周开课前提交）
**满分：100 分，及格线 60 分**
**允许查阅**：本课程讲义、ROS2 与 Gazebo 官方文档
**禁止**：直接复制 `examples/day4` 或 `examples/day5` 的 xacro。
尺寸不同，惯量必须自己算

---

## 场景

Day 4 你做出了一台能跑的小车。今天按**给定的规格**重写一台——
尺寸、质量、各关节位置都由题目指定，你要自己代入公式算出惯量。

写完的模型会接进一套现成的 slam_toolbox + Nav2 环境（由带你的人提供），
用键盘遥控它建图。**第 2 周的所有内容都建立在这台车上**，
所以今天的模型写对了，下周会顺很多。

## 交付物

仍然是那个包，只改一个文件：

```
~/ros2_lab/src/my_robot/urdf/my_robot.urdf.xacro
```

配套的世界文件、bridge 配置、launch 都沿用 Day 4 的，不用重写。

## 给定参数

**长度单位米，质量单位千克，角度单位弧度。**

| 部件 | link 名 | 几何 | 质量 |
|---|---|---|---|
| 车身 | `base_link` | 长方体 0.40 × 0.30 × 0.10 | 5.0 |
| 左驱动轮 | `left_wheel` | 圆柱 半径 0.06、厚 0.03 | 0.5 |
| 右驱动轮 | `right_wheel` | 圆柱 半径 0.06、厚 0.03 | 0.5 |
| 万向轮 | `caster_wheel` | 球 半径 0.03 | 0.2 |
| 激光雷达 | `lidar_link` | 圆柱 半径 0.03、高 0.04 | 0.1 |
| IMU | `imu_link` | 长方体 0.02 × 0.02 × 0.005 | 0.05 |

## 关节

| joint 名 | 类型 | 父 | 子 | 要求 |
|---|---|---|---|---|
| `left_wheel_joint` | `continuous` | `base_link` | `left_wheel` | 绕 y 轴（`axis xyz="0 1 0"`），装在车身左侧 |
| `right_wheel_joint` | `continuous` | `base_link` | `right_wheel` | 同上，右侧 |
| `caster_joint` | `fixed` | `base_link` | `caster_wheel` | 装在车身前下方，支撑住车头 |
| `lidar_joint` | `fixed` | `base_link` | `lidar_link` | **origin 的 z = 0.10**（相对 `base_link` 原点） |
| `imu_joint` | `fixed` | `base_link` | `imu_link` | 装在车身几何中心，origin 全 0 |

> [!WARNING]
> `base_link` 必须是唯一的根节点——不能作为任何 joint 的 `child`。
> TF 树出现第二个根，说明有 link 没连上，`check_urdf` 会直接告诉你。

## 惯量公式

自己代入计算，题目不给算好的数值。矩阵非对角项（`ixy`/`ixz`/`iyz`）全填 0。

| 几何体 | `ixx` | `iyy` | `izz` |
|---|---|---|---|
| 长方体 边长 x, y, z | `m(y²+z²)/12` | `m(x²+z²)/12` | `m(x²+y²)/12` |
| 圆柱 半径 r、长 l（绕 z 轴） | `m(3r²+l²)/12` | `m(3r²+l²)/12` | `mr²/2` |
| 实心球 半径 r | `2mr²/5` | `2mr²/5` | `2mr²/5` |

> [!NOTE]
> 允许用 xacro 的宏把公式写进去让它替你算——这正是推荐做法。
> 但要能说出每个公式对应哪种几何体，口头抽查会问。
> 判定容差是相对误差 1%。

## Gazebo 插件

三个插件的参数要与你的几何一致：

| 插件 | 关键参数 |
|---|---|
| `DiffDrive` | `wheel_separation` 与 `wheel_radius` **必须等于你实际的轮距和轮半径** |
| `gpu_lidar`（挂 `lidar_link`） | 话题 `scan`，360 个采样点，角度 ±π，量程 0.12–10.0 m |
| `imu`（挂 `imu_link`） | 话题 `imu`，`update_rate` 100 |

世界文件里的 `Sensors` 与 `Imu` 系统插件沿用 Day 4 的，不用改。

## 评分细则

### L1 URDF 正确性（60 分，离线可评，不需要仿真在跑）

| 检查项 | 分值 |
|---|---|
| xacro 能展开为合法 URDF | 5 |
| 六个约定的 link 齐全 | 10 |
| TF 树单根（`base_link`）且无孤立 link | 10 |
| 五个关节的类型与父子关系正确 | 10 |
| 各 link 质量与题面一致 | 10 |
| 惯量矩阵与公式计算一致 | 10 |
| `lidar_joint` 的 origin z = 0.10 | 5 |

### L2 仿真可用性（40 分，需要仿真在跑）

| 检查项 | 分值 |
|---|---|
| `/scan` 存在且类型为 `sensor_msgs/msg/LaserScan` | 15 |
| `/imu` 存在且类型为 `sensor_msgs/msg/Imu` | 10 |
| `/odom` 存在且类型为 `nav_msgs/msg/Odometry` | 10 |
| `/cmd_vel` 存在且类型为 `geometry_msgs/msg/Twist` | 5 |

### 人工验收（不计入 100 分，但必须通过）

- 车在 Gazebo 里静置不塌陷、不下沉、不自己乱动
- `teleop_twist_keyboard` 能把车开动，`/odom` 数值跟着变
- 以 0.3 m/s 前进 5 秒，`/odom` 的 x 增加约 1.5 m（误差 5% 以内）

> [!WARNING]
> 最后一条最能暴露问题：走的距离对不上，说明 `DiffDrive` 插件里的
> `wheel_radius` 与你 URDF 里的实际轮子半径不一致。
> 这类错误不报任何错，只体现为数值不对。

## 怎么自测

```bash
cd ~/ros2_lab
colcon build --packages-select my_robot
source install/setup.bash

# 只测 L1（不用起仿真）
python3 ~/Tutorials4intern/grading/grade_day5.py

# 完整测 100 分：终端 1 起仿真
ros2 launch my_robot gazebo.launch.py
# 终端 2 评分
python3 ~/Tutorials4intern/grading/grade_day5.py
```

只跑 L1 时是这样，L2 会明确说未计分而不是给 0：

```text
[通过] xacro 能展开为合法 URDF  (5/5 分)
[通过] 约定的 link 齐全  (10/10 分)
[通过] TF 树单根且全连通  (10/10 分)
[通过] 关节的类型与父子关系正确  (10/10 分)
[通过] 各 link 质量与题面一致  (10/10 分)
[通过] 惯量矩阵与公式计算一致  (10/10 分)
[通过] lidar_joint 的安装位置正确  (5/5 分)
[未通过] L2 仿真可用性  (0/40 分)
    期望：仿真运行中，/scan 与 /odom 有数据
    实际：未检测到任何仿真话题——L2 未计分
    建议：先用 ros2 launch my_robot gazebo.launch.py 起仿真，再跑本脚本。L1 的 60 分不受影响
----------------------------------
总分：60 / 100
```

数值写错时，脚本会把每一处差异列出来：

```text
[未通过] 各 link 质量与题面一致  (0/10 分)
    实际：base_link=3(应为5)；left_wheel=0.4(应为0.5)；right_wheel=0.4(应为0.5)；caster_wheel=0.15(应为0.2)
[未通过] 惯量矩阵与公式计算一致  (0/10 分)
    实际：base_link.ixx=0.0116(应为0.0416667)；left_wheel.izz=0.0005(应为0.0009)
    建议：圆柱的 izz 只跟半径有关（m·r²/2），ixx/iyy 还跟长度也有关——轮子最容易在这里写错
```

照着差异改就行，不用猜。

## 常见丢分点

- **圆柱的 `izz` 用错公式**。`izz = m·r²/2`，只跟半径有关；
  `ixx`/`iyy = m(3r²+l²)/12` 才跟长度有关。轮子的三个数不该全一样
- 惯量用了 Day 4 示范车的数值——两台车尺寸不同，必须重算
- `lidar_joint` 的 origin 写成"车身上表面之上 0.10"（即 0.15），
  题目要的是**相对 `base_link` 原点** 0.10
- 轮子忘了 `<origin rpy="1.5708 0 0"/>`，圆柱躺平了
- 驱动轮写成 `fixed`，或 `axis` 写成 `0 0 1`
- `DiffDrive` 的 `wheel_separation`/`wheel_radius` 与实际几何不一致
- `imu_link` 没有 `<inertial>` 段——它没有 visual 无所谓，但质量不能少
- 改完没 `colcon build` 就跑评分，评的还是旧文件
