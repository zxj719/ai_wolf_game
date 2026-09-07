#!/usr/bin/env python3
"""Day 2 评分：library、setup.py data_files、launch、namespace、参数。满分 100。

用法（学员先用 launch 启动自己的两个节点）：
    ros2 launch my_robot robot.launch.py   # 终端 1
    python3 grading/grade_day2.py          # 终端 2
"""
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from graderlib import checks                       # noqa: E402
from graderlib.probe import Probe                  # noqa: E402
from graderlib.report import CheckResult, Report   # noqa: E402

NS = '/robot1'
TOPIC_IN = f'{NS}/counter'
TOPIC_OUT = f'{NS}/counter_doubled'
TYPE = 'std_msgs/msg/Int32'

# 不可能由计数器自然产生的值：确认 listener 真的在处理输入
SENTINEL = 123457


def check_param_from_yaml(max_points: float) -> CheckResult:
    """用 ros2 param get 验证 multiplier 确实加载成功。

    这一步经由 ROS2 的参数服务读到节点内的真实值——YAML 键写错时参数会被
    静默忽略，节点里剩下的是 declare_parameter 的默认值，这里就能暴露出来。
    """
    cmd = ['ros2', 'param', 'get', f'{NS}/listener', 'multiplier']
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        out = (r.stdout.strip() + r.stderr.strip()).strip()
    except Exception as e:  # noqa: BLE001 —— 评分脚本要把一切失败变成可读输出
        out = f'调用失败：{e}'
    m = re.search(r'value is:\s*(-?\d+)', out)
    ok = m is not None and int(m.group(1)) == 2
    return CheckResult(
        name='multiplier 参数从 YAML 加载', max_points=max_points, passed=ok,
        expected=f"`{' '.join(cmd)}` 输出 Integer value is: 2",
        actual=out or '（无输出）',
        hint='三处逐一核对：节点里 declare_parameter("multiplier", ...)；'
             'launch 的 Node(parameters=[yaml路径])；'
             'YAML 顶层键必须是节点全名 /robot1/listener——键写错不报错，参数静默失效')


def check_doubling(probe: Probe, max_points: float) -> CheckResult:
    """注入哨兵值，看输出话题上是否出现它的 multiplier(=2) 倍。"""
    from std_msgs.msg import Int32

    msg = Int32()
    msg.data = SENTINEL
    got = probe.publish_and_collect(
        TOPIC_IN, TYPE, msg, TOPIC_OUT, TYPE, count=12, hz=20.0)

    values = [m.data for m in got]
    if not values:
        return CheckResult(
            name='倍增逻辑正确', max_points=max_points, passed=False,
            expected=f'向 {TOPIC_IN} 发送 {SENTINEL} 后，{TOPIC_OUT} 上出现 {SENTINEL * 2}',
            actual=f'{TOPIC_OUT} 上一条消息都没收到',
            hint='确认 launch 起的 listener 在运行，且话题名是相对的 counter_doubled'
                 '（带 / 的绝对名不吃 namespace，会跑到根下面去）')

    ok = SENTINEL * 2 in values
    uniq = sorted(set(values))
    shown = uniq[:8] + (['...'] if len(uniq) > 8 else [])
    return CheckResult(
        name='倍增逻辑正确', max_points=max_points, passed=ok,
        expected=f'收到 {SENTINEL} 后应发出 {SENTINEL * 2}',
        actual=f'{TOPIC_OUT} 上观察到的值：{shown}',
        hint='listener 回调里应把 msg.data 乘以 multiplier 参数（YAML 给 2）再发布')


def main() -> int:
    rep = Report(day='day2')
    with Probe() as p:
        rep.add(checks.check_node_running(
            p, f'{NS}/talker', 15,
            hint='用 ros2 launch my_robot robot.launch.py 启动；'
                 '节点不在 /robot1 下说明 launch 里没写 namespace="robot1"'))
        rep.add(checks.check_node_running(
            p, f'{NS}/listener', 15,
            hint='两个节点应由同一个 launch 文件启动'))
        rep.add(checks.check_topic_exists(
            p, TOPIC_IN, TYPE, 13,
            hint='节点里话题名要写相对的 counter；'
                 '写成 /counter 这种带斜杠的绝对名不会被 namespace 加前缀'))
        rep.add(checks.check_topic_exists(
            p, TOPIC_OUT, TYPE, 12,
            hint='同上，相对名 counter_doubled'))
        rep.add(check_param_from_yaml(20))
        rep.add(check_doubling(p, 25))

    print(rep.render_terminal())
    rep.save_json('report_day2.json')
    print('\n已写出 report_day2.json')
    return 0 if rep.total() >= 60 else 1


if __name__ == '__main__':
    sys.exit(main())
