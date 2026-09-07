# 考核说明

## 给学员

每天一份考卷，在对应的 `dayN_exam.md` 里。做完后自己跑评分脚本，分数当场可见。

```bash
# 先启动你自己的节点（另开终端），然后：
python3 ~/Tutorials4intern/grading/grade_dayN.py
```

评分脚本**不会替你启动节点**。它连上 ROS2 网络观察你已经跑起来的东西。

失败时脚本会打印三行：**期望什么 / 实际测到什么 / 建议怎么查**。先读这三行再改代码。

## 给教师

| 天 | 考卷 | 评分脚本 | 满分 | 形式 |
|---|---|---|---|---|
| 0 | 无 | `selfcheck_day0.py` | — | 自测，不计分 |
| 1 | `day1_exam.md` | `grade_day1.py` | 100 | 限时 90 分钟 |
| 2 | `day2_exam.md` | `grade_day2.py` | 100 | 累加式 |
| 3 | `day3_exam.md` | `grade_day3.py` | 100 | 累加式 |
| 4 | 无 | `selfcheck_day4.py` | — | 自检，不计分 |
| 5 | `day5_exam.md` | `grade_day5.py` | 100 | 综合大考 |

每次运行会在当前目录生成 `report_dayN.json`，可用于汇总全班成绩。

包名、可执行名、话题名是**考卷与评分脚本之间的契约**，改一边必须改另一边。
契约表见实现计划 `docs/superpowers/plans/`。

## 待人工验证项（Tier B）

以下内容无法在无图形界面的验证机上确认，**必须在 x86_64 学员机上人工过一遍**
才能认为教程可用。未完成前，相关页面均带"未验证"提示。

### Day 3 · rviz2 与实机

- [ ] rviz2 能显示 Livox Mid-360 点云
- [ ] 点云的 `frame_id` 与 `appendix-livox.html` 所写一致
- [ ] `livox_ros_driver2` 的话题名与文档一致
- [ ] bag 回放的点云在 rviz2 中可见
- [ ] PointCloud2 的 Reliability 设为 Best Effort 才能看到（文档如此声称，需确认）

### Day 4 · Gazebo Fortress 运行时

- [ ] `gz sim` 能加载 `demo_car` 模型，模型静置不塌陷、不下沉、不乱飞
- [ ] `ros_gz_bridge` 启动后 `ros2 topic list` 出现 `/scan` `/imu` `/odom` `/cmd_vel`
- [ ] `ros2 topic hz /scan` 约 10 Hz，`/imu` 约 100 Hz，`/odom` 约 50 Hz
- [ ] `teleop_twist_keyboard` 发 `/cmd_vel` 后小车前进/转向，`/odom` 数值相应变化
- [ ] rviz2 中 Fixed Frame 设为 `odom`，能看到 LaserScan 与 TF 坐标轴

### Day 5 · 考卷包集成

- [ ] 参考答案 xacro 接入 `day5_kit` 后仿真正常启动
- [ ] `grade_day5.py` 的 L2 四项在真实仿真下各自得分
- [ ] slam_toolbox 能建出图
- [ ] Day 0 的 `sudo apt install` 安装流程在干净的 Ubuntu 22.04 上可复现
