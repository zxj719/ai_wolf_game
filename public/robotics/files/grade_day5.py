#!/usr/bin/env python3
"""Day 5 评分：L1 URDF 正确性 60 分（离线可评）+ L2 仿真可用性 40 分。满分 100。

用法：
    ros2 launch my_robot gazebo.launch.py    # 终端 1（L2 需要）
    python3 grading/grade_day5.py            # 终端 2

L1 只读文件，不需要仿真在跑；没起仿真时 L2 会明确提示未计分，
不会静默给 0。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from graderlib import checks, robotcheck as rc          # noqa: E402
from graderlib.probe import Probe                       # noqa: E402
from graderlib.report import CheckResult, Report        # noqa: E402

XACRO = os.path.expanduser('~/ros2_lab/src/my_robot/urdf/my_robot.urdf.xacro')

# ===== 考卷给定的尺寸。改这里必须同步改 exams/day5_exam.md =====
BASE = dict(m=5.0, x=0.40, y=0.30, z=0.10)
WHEEL = dict(m=0.5, r=0.06, l=0.03)
CASTER = dict(m=0.2, r=0.03)
LIDAR_M = 0.1
LIDAR_Z = 0.10          # lidar_joint 的 origin z，相对 base_link 原点
IMU_M = 0.05

REQUIRED = ['base_link', 'left_wheel', 'right_wheel',
            'caster_wheel', 'lidar_link', 'imu_link']

JOINTS = {
    'left_wheel_joint':  dict(type='continuous', parent='base_link',
                              child='left_wheel', axis=(0.0, 1.0, 0.0)),
    'right_wheel_joint': dict(type='continuous', parent='base_link',
                              child='right_wheel', axis=(0.0, 1.0, 0.0)),
    'lidar_joint':       dict(type='fixed', parent='base_link', child='lidar_link'),
    'imu_joint':         dict(type='fixed', parent='base_link', child='imu_link'),
    'caster_joint':      dict(type='fixed', parent='base_link', child='caster_wheel'),
}


def grade_l1(rep: Report) -> None:
    """URDF 正确性，60 分。只读文件，不需要仿真。"""
    res, model = rc.check_xacro_expands(XACRO, 5)
    rep.add(res)
    if model is None:
        # 展开失败，后面的都没法查，直接给出剩余项的零分并说明原因
        for name, pts in [('约定的 link 齐全', 10), ('TF 树单根且全连通', 10),
                          ('关节的类型与父子关系正确', 10),
                          ('各 link 质量与题面一致', 10),
                          ('惯量矩阵与公式计算一致', 10),
                          ('lidar_joint 的安装位置正确', 5)]:
            rep.add(CheckResult(
                name=name, max_points=pts, passed=False,
                expected='—', actual='xacro 没能展开，本项无法评定',
                hint='先解决上一项的展开错误'))
        return

    rep.add(rc.check_links_present(model, REQUIRED, 10))
    rep.add(rc.check_tree_connected(model, 'base_link', 10))
    rep.add(rc.check_joints(model, JOINTS, 10))
    rep.add(rc.check_masses(model, {
        'base_link': BASE['m'],
        'left_wheel': WHEEL['m'],
        'right_wheel': WHEEL['m'],
        'caster_wheel': CASTER['m'],
        'lidar_link': LIDAR_M,
        'imu_link': IMU_M,
    }, 10))
    rep.add(rc.check_inertias(model, {
        'base_link': rc.box_inertia(BASE['m'], BASE['x'], BASE['y'], BASE['z']),
        'left_wheel': rc.cylinder_inertia(WHEEL['m'], WHEEL['r'], WHEEL['l']),
        'right_wheel': rc.cylinder_inertia(WHEEL['m'], WHEEL['r'], WHEEL['l']),
        'caster_wheel': rc.sphere_inertia(CASTER['m'], CASTER['r']),
    }, 10))
    rep.add(rc.check_joint_origin(
        model, 'lidar_joint', 2, LIDAR_Z,
        f'雷达装在 base_link 上方 {LIDAR_Z} m', 5))


def grade_l2(rep: Report) -> None:
    """仿真可用性，40 分。需要仿真在跑。"""
    with Probe() as p:
        # 门槛判断必须轮询等待，不能用单次快照。
        # DDS 的发现是渐进的：仿真明明在跑，Probe 刚建好的那一瞬间也可能
        # 一个话题都看不到，那样会把正确作业判成 0 分（CLAUDE.md §7.3）。
        types = p.wait_for_topic('/odom', timeout=20.0)
        if '/odom' not in types:
            types = p.wait_for_topic('/scan', timeout=10.0)
        if '/scan' not in types and '/odom' not in types:
            rep.add(CheckResult(
                name='L2 仿真可用性', max_points=40, passed=False,
                expected='仿真运行中，/scan 与 /odom 有数据',
                actual='未检测到任何仿真话题——L2 未计分',
                hint='先用 ros2 launch my_robot gazebo.launch.py 起仿真，再跑本脚本。'
                     'L1 的 60 分不受影响'))
            return

        rep.add(checks.check_topic_exists(
            p, '/scan', 'sensor_msgs/msg/LaserScan', 15,
            hint='世界文件里要有 Sensors 插件；gpu_lidar 需要图形环境才出数据'))
        rep.add(checks.check_topic_exists(
            p, '/imu', 'sensor_msgs/msg/Imu', 10,
            hint='世界文件里要有 Imu 插件，且 imu_link 上挂了 imu 传感器'))
        rep.add(checks.check_topic_exists(
            p, '/odom', 'nav_msgs/msg/Odometry', 10,
            hint='DiffDrive 插件发布 odom，检查 bridge 有没有桥接'))
        rep.add(checks.check_topic_exists(
            p, '/cmd_vel', 'geometry_msgs/msg/Twist', 5,
            hint='bridge 里 cmd_vel 的 direction 应为 ROS_TO_GZ'))


def main() -> int:
    rep = Report(day='day5')
    grade_l1(rep)
    grade_l2(rep)
    print(rep.render_terminal())
    rep.save_json('report_day5.json')
    print('\n已写出 report_day5.json')
    return 0 if rep.total() >= 60 else 1


if __name__ == '__main__':
    sys.exit(main())
