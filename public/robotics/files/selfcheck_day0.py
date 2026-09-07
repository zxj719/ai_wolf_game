#!/usr/bin/env python3
"""Day 0 自测：确认你具备继续学习的前置能力。

**本脚本不计分。** 它只回答一个问题：你现在能不能开始 Day 1。
五项里有没通过的，按提示解决掉再往下走，Day 1 会顺很多。

刻意不依赖 rclpy：这一步的目的之一就是检查 ROS2 装没装好，
如果 import rclpy 失败会直接崩掉，学员就看不到有用的提示了。
"""
import os
import shutil
import sys


def _ok(label: str, passed: bool, hint: str = "") -> bool:
    print(("  [通过]   " if passed else "  [未通过] ") + label)
    if not passed and hint:
        print("           建议：" + hint)
    return passed


def main() -> int:
    print("===== Day 0 自测（不计分）=====")
    results = []

    # 1. Python 版本
    results.append(_ok(
        f"Python 版本 ≥ 3.10（当前 {sys.version.split()[0]}）",
        sys.version_info >= (3, 10),
        "Ubuntu 22.04 自带 Python 3.10。若版本不对，多半是 conda 等其他环境抢了 python3，"
        "用 which python3 看看它指向哪里",
    ))

    # 2. ROS2 环境是否 source 过
    ros_distro = os.environ.get("ROS_DISTRO", "")
    results.append(_ok(
        f"已 source ROS2 环境（ROS_DISTRO={ros_distro or '未设置'}）",
        ros_distro == "humble",
        "执行 source /opt/ros/humble/setup.bash。"
        "每开一个新终端都要重新 source，建议把这行加进 ~/.bashrc",
    ))

    # 3. 关键命令是否可用
    tools = (
        ("ros2", "ROS2 主命令",
         "未找到 ros2。先确认上一项已通过——没 source 的话这一项必然也过不了"),
        ("colcon", "编译工作空间用",
         "未找到 colcon。装它：sudo apt install python3-colcon-common-extensions"),
    )
    for tool, why, hint in tools:
        results.append(_ok(
            f"命令 {tool} 可用（{why}）",
            shutil.which(tool) is not None,
            hint,
        ))

    # 4. 能不能写一个类、并让别人回调它
    #    这正是 ROS2 节点的模型：你写好回调，交给 rclpy 在消息到达时调用。
    try:
        ns = {}
        exec(
            "class Counter:\n"
            "    def __init__(self):\n"
            "        self.n = 0\n"
            "    def on_tick(self):\n"
            "        self.n += 1\n"
            "\n"
            "c = Counter()\n"
            "for _ in range(3):\n"
            "    c.on_tick()\n"
            "result = c.n\n",
            ns,
        )
        results.append(_ok("理解「类 + 回调」模型", ns.get("result") == 3))
    except Exception as e:  # pragma: no cover - 解释器本身出问题才会走到这里
        results.append(_ok("理解「类 + 回调」模型", False, f"内部错误：{e}"))

    print("-" * 34)
    passed = sum(1 for r in results if r)
    if all(results):
        print(f"{passed}/{len(results)} 项通过，可以开始 Day 1。")
        return 0
    print(f"{passed}/{len(results)} 项通过。按上面的建议把未通过项解决掉，再进 Day 1。")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
