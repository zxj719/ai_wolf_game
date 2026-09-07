#!/usr/bin/env python3
"""Day 1 评分：建包、编译、Publisher / Subscriber。满分 100。

用法（学员先在别的终端启动自己的节点）：
    ros2 run my_robot talker      # 终端 1
    ros2 run my_robot listener    # 终端 2
    python3 grading/grade_day1.py  # 终端 3
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from graderlib import checks                       # noqa: E402
from graderlib.probe import Probe                  # noqa: E402
from graderlib.report import CheckResult, Report   # noqa: E402

TOPIC_IN = '/counter'
TOPIC_OUT = '/counter_doubled'
TYPE = 'std_msgs/msg/Int32'

# 一个不可能由学员的计数器自然产生的值。用它来确认 listener 真的在
# 处理输入，而不是恰好也在发一串递增的数。
SENTINEL = 123457


def check_doubling(probe: Probe, max_points: float) -> CheckResult:
    """注入哨兵值，看输出话题上是否出现它的两倍。"""
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
            hint='确认 listener 正在运行，且它发布的话题名是 ' + TOPIC_OUT)

    ok = SENTINEL * 2 in values
    uniq = sorted(set(values))
    shown = uniq[:8] + (['...'] if len(uniq) > 8 else [])
    return CheckResult(
        name='倍增逻辑正确', max_points=max_points, passed=ok,
        expected=f'收到 {SENTINEL} 后应发出 {SENTINEL * 2}',
        actual=f'{TOPIC_OUT} 上观察到的值：{shown}',
        hint='在 listener 的回调里把 msg.data 乘 2 后再 publish')


def main() -> int:
    rep = Report(day='day1')
    with Probe() as p:
        rep.add(checks.check_topic_exists(
            p, TOPIC_IN, TYPE, 25,
            hint='用 ros2 topic list 确认。话题名必须是 /counter，注意前面的斜杠'))
        rep.add(checks.check_topic_hz(
            p, TOPIC_IN, TYPE, 4.0, 6.0, 20,
            hint='create_timer 的周期应为 0.2 秒（1 / 5 Hz）'))
        rep.add(checks.check_node_running(
            p, 'listener', 15,
            hint='节点名由 super().__init__("listener") 决定，不是文件名'))
        rep.add(check_doubling(p, 40))

    print(rep.render_terminal())
    rep.save_json('report_day1.json')
    print('\n已写出 report_day1.json')
    return 0 if rep.total() >= 60 else 1


if __name__ == '__main__':
    sys.exit(main())
