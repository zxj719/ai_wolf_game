#!/usr/bin/env python3
"""Day 3 评分：传感器消息、话题内省、QoS、数据链路。满分 100。

用法（学员先用 launch 启动自己的四个节点）：
    ros2 launch my_robot robot.launch.py   # 终端 1
    python3 grading/grade_day3.py          # 终端 2
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
TOPIC_IMU = f'{NS}/imu/data'
TOPIC_MAG = f'{NS}/imu/magnitude'
TYPE_IMU = 'sensor_msgs/msg/Imu'
TYPE_MAG = 'std_msgs/msg/Float64'

# 注入用的加速度：模长恰好 13.0（3-4-12 直角三角形），
# 与 imu_talker 自然产生的 ~9.81 区分得开
SENTINEL_XYZ = (3.0, 4.0, 12.0)
SENTINEL_MAG = 13.0


def check_qos_best_effort(max_points: float) -> CheckResult:
    """确认 imu/data 的发布端用的是 BEST_EFFORT。

    传感器话题该用 BEST_EFFORT——这是 Day 3 §4.2 的核心结论。
    QoS 读不到 Probe 里，用 ros2 topic info --verbose 解析。
    """
    cmd = ['ros2', 'topic', 'info', TOPIC_IMU, '--verbose']
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        out = (r.stdout + r.stderr).strip()
    except Exception as e:  # noqa: BLE001 —— 评分脚本要把一切失败变成可读输出
        out = f'调用失败：{e}'

    # 只看 PUBLISHER 那一段的 Reliability
    pub_rel = None
    section = None
    for line in out.splitlines():
        s = line.strip()
        if s.startswith('Endpoint type:'):
            section = s.split(':', 1)[1].strip()
        elif s.startswith('Reliability:') and section == 'PUBLISHER':
            pub_rel = s.split(':', 1)[1].strip()
            break

    ok = pub_rel == 'BEST_EFFORT'
    return CheckResult(
        name='imu/data 发布端 QoS 为 BEST_EFFORT', max_points=max_points, passed=ok,
        expected=f'{TOPIC_IMU} 的 PUBLISHER 端 Reliability 是 BEST_EFFORT',
        actual=(f'实际读到 {pub_rel}' if pub_rel else f'没解析出 PUBLISHER 的 QoS。原始输出：\n{out[:400]}'),
        hint='create_publisher 的第三个参数要传 QoSProfile('
             'reliability=ReliabilityPolicy.BEST_EFFORT, '
             'history=HistoryPolicy.KEEP_LAST, depth=10)，不能只写一个数字 10')


def check_magnitude(probe: Probe, max_points: float) -> CheckResult:
    """注入一条已知加速度，看 magnitude 上是否出现对应的模长。"""
    from sensor_msgs.msg import Imu

    x, y, z = SENTINEL_XYZ
    msg = Imu()
    msg.header.frame_id = 'grader_probe'
    msg.linear_acceleration.x = x
    msg.linear_acceleration.y = y
    msg.linear_acceleration.z = z

    got = probe.publish_and_collect(
        TOPIC_IMU, TYPE_IMU, msg, TOPIC_MAG, TYPE_MAG, count=20, hz=25.0)
    values = [m.data for m in got]

    if not values:
        return CheckResult(
            name='模长计算正确', max_points=max_points, passed=False,
            expected=f'向 {TOPIC_IMU} 注入 ({x}, {y}, {z}) 后，'
                     f'{TOPIC_MAG} 上出现 {SENTINEL_MAG}',
            actual=f'{TOPIC_MAG} 上一条消息都没收到',
            hint='确认 imu_listener 在运行；话题名要写相对的 imu/magnitude；'
                 '订阅 imu/data 的 QoS 必须与发布端兼容，否则回调根本不会被调用')

    hit = any(abs(v - SENTINEL_MAG) < 0.01 for v in values)
    uniq = sorted({round(v, 3) for v in values})
    shown = uniq[:8] + (['...'] if len(uniq) > 8 else [])
    return CheckResult(
        name='模长计算正确', max_points=max_points, passed=hit,
        expected=f'注入 ({x}, {y}, {z}) 应得到 {SENTINEL_MAG}',
        actual=f'{TOPIC_MAG} 上观察到的值：{shown}',
        hint='回调里应算 sqrt(x²+y²+z²)。只看到 9.8 左右说明注入的消息没被处理，'
             '只算了 z 轴说明漏了 x、y')


def main() -> int:
    rep = Report(day='day3')
    with Probe() as p:
        rep.add(checks.check_node_running(
            p, f'{NS}/imu_talker', 10,
            hint='用 ros2 launch my_robot robot.launch.py 启动；'
                 '节点不在 /robot1 下说明 launch 里漏了 namespace="robot1"'))
        rep.add(checks.check_node_running(
            p, f'{NS}/imu_listener', 10,
            hint='四个节点应由同一个 launch 文件一起启动'))
        rep.add(checks.check_topic_exists(
            p, TOPIC_IMU, TYPE_IMU, 15,
            hint='节点里话题名写相对的 imu/data；类型是 sensor_msgs/msg/Imu'))
        rep.add(checks.check_topic_exists(
            p, TOPIC_MAG, TYPE_MAG, 10,
            hint='相对名 imu/magnitude，类型 std_msgs/msg/Float64'))
        rep.add(checks.check_topic_hz(
            p, TOPIC_IMU, TYPE_IMU, 45.0, 55.0, 15,
            hint='参数 imu_hz 应为 50.0，定时器周期是 1/50=0.02 秒不是 50'))
        rep.add(checks.check_message_field(
            p, TOPIC_IMU, TYPE_IMU, 'header.frame_id',
            lambda v: v == 'imu_link', '等于 imu_link', 10,
            hint='填充消息时设置 msg.header.frame_id，值由参数 frame_id 给出'))
        rep.add(check_qos_best_effort(10))
        rep.add(check_magnitude(p, 20))

    print(rep.render_terminal())
    rep.save_json('report_day3.json')
    print('\n已写出 report_day3.json')
    return 0 if rep.total() >= 60 else 1


if __name__ == '__main__':
    sys.exit(main())
