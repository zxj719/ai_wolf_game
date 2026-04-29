# The Robot Is Not An Algorithm

机器人笔记的核心教训很简单，也很冷酷：

**仿真里的成功，只能证明算法在理想世界里成立；真机上的稳定，才证明工程系统真的存在。**

这个 vault 里最重的一条线，是从扫地机、Go2w 到宇树 G1 的实机调试。它反复显示同一个事实：机器人项目从来不是一个单点技术问题。SLAM、Nav2、TF、costmap、传感器、电源、启动脚本、状态机、网络、控制器、现场人员，任何一个环节松动，最终都会表现为“机器人又卡住了”。

## The Real System

一个机器人导航系统表面上可以拆成三块：建图、定位、导航。实际落地时，它更像一串互相牵扯的条件：

- 地图要稳定。
- `map -> odom -> base_link` 的 TF 链要可信。
- 激光、深度相机、IMU 和轮速要按正确频率发布。
- `global_costmap` 和 `local_costmap` 要各自承担清楚的责任。
- planner 不能把路径压在障碍物边缘。
- controller 不能在危险区域里继续偏离路径。
- recovery 行为不能因为定位抖动而把问题放大。
- 一键启动脚本不能只会启动，不会关闭。
- 电源、网络和远程控制必须支撑连续测试。

这就是为什么实机调试总是比仿真慢。仿真里三天能跑通的流程，到了 G1 或 Go2w 上可能三周还在打磨。不是因为算法突然变差，而是因为真实世界把所有工程债一次性收回来。

## The Frontier Trap

Frontier exploration 的诱惑在于它看起来很优雅：找到已知和未知的边界，把机器人送过去，地图自然扩展。但真实环境里的 frontier 不关心机器人会不会难受。

笔记里反复出现一个问题：frontier 目标点太靠近障碍物，或者落在凹字形、窄通道、复杂结构内部。Explorer 给出一个几何上“有意义”的点，但 Nav2 执行时会出现几种危险情况：

- 目标点落在膨胀区边缘。
- 全局路径贴障。
- 控制器偏离路径后撞墙。
- 机器人进入狭窄结构后无法后退。
- 导航失败后 recovery spin 进一步扰动定位。
- explorer 更新慢，不合理目标不能立刻替换。

一个关键判断是：不要急着把 VLM 或 Voronoi 直接塞进 explorer 的核心逻辑。更稳的第一步，是在目标点吸附时读取 `global_costmap/costmap`，只允许发送同时满足两个条件的目标：

- 探索图上是 free。
- Nav2 的 global costmap 上也是 free。

这样 frontier 仍然负责发现“哪里值得探索”，Nav2 的 costmap 负责判断“哪里真正安全”。这是一种工程上更干净的分工。

## Geometry Is The Safety Layer

VLM 语义探索方案里最重要的一句话是：

**Geometry is ground truth, semantics is preference.**

这句话可以成为整个机器人系统的安全原则。VLM 可以判断“哪里更像水杯所在的区域”，可以对 frontier 候选排序，可以解释为什么某个方向更值得去。但 VLM 不能直接决定机器人去一个几何上不可达、不可控或不安全的位置。

更合理的系统分工是：

- 几何层负责安全：SLAM、costmap、reachability、collision check。
- 语义层负责偏好：任务理解、候选排序、到达确认、belief 更新。
- 控制层负责执行：Nav2、controller、behavior tree、recovery。
- 接口层负责约束：WebSocket schema、JSON 字段、POI 协议、状态回传。

当语义系统掉线、VLM 输出异常、网络不稳定时，机器人必须能降级回纯 frontier 或手动控制。这不是保守，而是真机系统必须具备的生存能力。

## The Costmap Is A Contract

很多调参笔记看似细碎：`inflation_radius`、`footprint_padding`、`planner tolerance`、`progress_checker`、`failure_tolerance`、`spin_dist`、`number_of_retries`。但它们背后其实是在定义一个合同：

**机器人和环境之间的安全距离到底是多少？**

如果 `global_costmap` 把窄通道视为可走，planner 就可能规划进去。如果 `local_costmap` 太敏感，机器人会在噪声里频繁 abort。如果 recovery 太激进，一次定位抖动会变成连续旋转。如果 goal tolerance 太大，机器人可能“靠近算成功”，但没有触发 blacklist；如果太小，人形机器人又未必能控制到这么细。

所以 costmap 调参不是玄学。它要回答几个明确问题：

- 哪些地方应该绝对不能去？
- 哪些地方可以走，但代价很高？
- 哪些地方可以作为 frontier 目标点？
- 失败时应该快速换点，还是先尝试恢复？
- 对人形机器人和四轮底盘，安全距离是否应该不同？

## Interfaces Are Product Boundaries

G1 导航接口、POI 标记协议、WebSocket 消息、`mark_current_poi`、`on_arrived`、`on_error` 这些内容说明另一件事：机器人系统最终要变成产品，就必须有稳定接口。

接口不是“后端字段怎么写”这么简单。接口决定了大脑模块、导航执行端、移动端 App、测试人员和现场操作流程之间如何协作。

一个好的机器人接口需要：

- 请求有唯一 `request_id`。
- ack 和最终结果分开。
- success 和 error 都有明确事件。
- 错误原因可解释。
- POI、导航点、任务状态能持久化。
- 联调时能清楚判断是哪一端错。

没有接口约束，机器人就只是一个能跑 demo 的系统。有了接口，它才开始接近可交付产品。

## Calibration Is How The Robot Learns To See

相机标定、多棋盘角点、鱼眼内参、SE(3) 外参、重投影误差这些材料看起来像另一类技术，但它们和导航是同一个问题：机器人如何相信自己的感知。

标定不是一次性工具，而是视觉系统的可信度基础。外参误差会传导到地图、障碍物、路径和控制。一个看似小的重投影误差，最终可能变成机器人在真实空间里的错误判断。

这些标定笔记后续应该从 `Day Planner/` 中抽出来，形成独立的视觉与标定知识库。

## Working Principles

- 先让系统稳定，再让系统聪明。
- VLM 只做偏好，不做安全裁决。
- Frontier 只负责发现候选，不直接代表可导航目标。
- Costmap 是机器人对世界的安全合同。
- Recovery 行为要谨慎，尤其是真机定位不稳时。
- 日期笔记里的调试记录，要定期沉淀成 checklist。
- 每个接口都要有 request、ack、success、error 和持久化策略。

## Next Work

- 把 G1/Go2w 的导航接口协议稳定成唯一 spec。
- 为 frontier 目标点吸附加入 `grid_map == 0` 和 `global_costmap == 0` 的双重校验。
- 写一份 G1 一键启动脚本的正式说明，包含参数、默认值、失败处理和关闭流程。
- 把 XT16 丢帧、AMCL 抖动、recovery spin、costmap 膨胀区目标这几类问题整理成排障手册。
- 把标定相关文件从 daily notes 中抽成独立技术文档。

