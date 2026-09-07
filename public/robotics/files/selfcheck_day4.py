#!/usr/bin/env python3
"""Day 4 自检：URDF 结构、TF 树、仿真三个话题。不计分。

用法（先用 launch 把仿真起起来）：
    ros2 launch my_robot gazebo.launch.py gui:=false   # 终端 1
    python3 grading/selfcheck_day4.py                  # 终端 2

Day 5 的评分用的是同一批检查项，今天全绿等于给 Day 5 铺好了路。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from graderlib import checks, robotcheck as rc          # noqa: E402
from graderlib.probe import Probe                       # noqa: E402
from graderlib.report import Report                     # noqa: E402

XACRO = os.path.expanduser('~/ros2_lab/src/my_robot/urdf/my_robot.urdf.xacro')

# Day 4 示范车的尺寸。Day 5 考题另给一套，不要照抄。
BASE = dict(m=3.0, x=0.30, y=0.20, z=0.08)
WHEEL = dict(m=0.4, r=0.05, l=0.025)
CASTER = dict(m=0.15, r=0.025)

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


def main() -> int:
    rep = Report(day='day4（自检，不计分）')

    res, model = rc.check_xacro_expands(XACRO, 10)
    rep.add(res)
    if model is not None:
        rep.add(rc.check_links_present(model, REQUIRED, 10))
        rep.add(rc.check_tree_connected(model, 'base_link', 10))
        rep.add(rc.check_joints(model, JOINTS, 10))
        rep.add(rc.check_masses(model, {
            'base_link': BASE['m'], 'left_wheel': WHEEL['m'],
            'right_wheel': WHEEL['m'], 'caster_wheel': CASTER['m'],
        }, 10))
        rep.add(rc.check_inertias(model, {
            'base_link': rc.box_inertia(BASE['m'], BASE['x'], BASE['y'], BASE['z']),
            'left_wheel': rc.cylinder_inertia(WHEEL['m'], WHEEL['r'], WHEEL['l']),
            'right_wheel': rc.cylinder_inertia(WHEEL['m'], WHEEL['r'], WHEEL['l']),
            'caster_wheel': rc.sphere_inertia(CASTER['m'], CASTER['r']),
        }, 10))

    with Probe() as p:
        types = p.topic_types()
        if '/scan' not in types and '/odom' not in types:
            print(rep.render_terminal())
            print('\n仿真话题一个都没有——先用 '
                  'ros2 launch my_robot gazebo.launch.py 把仿真起起来，再跑本脚本。')
            return 1
        rep.add(checks.check_topic_exists(
            p, '/scan', 'sensor_msgs/msg/LaserScan', 10,
            hint='世界文件里要有 Sensors 插件；gpu_lidar 还需要图形环境'))
        rep.add(checks.check_topic_exists(
            p, '/imu', 'sensor_msgs/msg/Imu', 10,
            hint='世界文件里要有 Imu 插件'))
        rep.add(checks.check_topic_exists(
            p, '/odom', 'nav_msgs/msg/Odometry', 10,
            hint='DiffDrive 插件负责发 odom，检查 bridge 是否桥接了它'))
        rep.add(checks.check_topic_exists(
            p, '/cmd_vel', 'geometry_msgs/msg/Twist', 10,
            hint='bridge 里 cmd_vel 的 direction 应为 ROS_TO_GZ'))

    print(rep.render_terminal())
    total, mx = rep.total(), rep.max_total()
    print(f'\n{total:g}/{mx:g}。本脚本不计分，'
          f'{"全绿，可以进 Day 5" if total == mx else "上面未通过的项建议先解决"}。')
    return 0
if __name__ == "__main__":
    sys.exit(main())
