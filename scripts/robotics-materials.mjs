#!/usr/bin/env node
/**
 * 把 Tutorials4intern 的考卷与评分脚本搬进 public/robotics/files/，供讲义页直接下载。
 *
 * 为什么要打 zip：grade_dayN.py 全都 `from graderlib import ...`，
 * 单独下载一个 .py 拿到手是跑不起来的（ModuleNotFoundError: graderlib）。
 * 所以每天给两种下载：
 *   - 单文件：考卷 .md 与脚本 .py，方便在线看一眼
 *   - zip   ：脚本 + graderlib/ + requirements-dev.txt，解压即可运行
 *
 * 用法：node scripts/robotics-materials.mjs
 */
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = 'C:/Users/xingj/Documents/Tutorials4intern';
const OUT = resolve(process.cwd(), 'public/robotics/files');
const STAGE = resolve(process.cwd(), '.robotics-stage');

/** 每天有什么材料。exam 为 null 表示这天不计分、只有自检脚本。 */
const DAYS = [
  { day: 'day0', exam: null, script: 'selfcheck_day0.py', needsLib: false },
  { day: 'day1', exam: 'day1_exam.md', script: 'grade_day1.py', needsLib: true },
  { day: 'day2', exam: 'day2_exam.md', script: 'grade_day2.py', needsLib: true },
  { day: 'day3', exam: 'day3_exam.md', script: 'grade_day3.py', needsLib: true },
  { day: 'day4', exam: null, script: 'selfcheck_day4.py', needsLib: true },
  { day: 'day5', exam: 'day5_exam.md', script: 'grade_day5.py', needsLib: true },
];

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/** 复制 graderlib/，但把 __pycache__ 挡在外面——那是本机字节码，别发出去。 */
function copyGraderlib(dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(resolve(REPO, 'grading/graderlib'))) {
    if (name === '__pycache__') continue;
    cpSync(resolve(REPO, 'grading/graderlib', name), resolve(dest, name), { recursive: true });
  }
}

// 考试规则总说明，放在 index 上给所有人看
cpSync(resolve(REPO, 'exams/README.md'), resolve(OUT, 'exam_rules.md'));

for (const { day, exam, script, needsLib } of DAYS) {
  const stage = resolve(STAGE, day);
  mkdirSync(stage, { recursive: true });

  if (exam) {
    cpSync(resolve(REPO, 'exams', exam), resolve(OUT, exam));
    cpSync(resolve(REPO, 'exams', exam), resolve(stage, exam));
  }
  cpSync(resolve(REPO, 'grading', script), resolve(OUT, script));
  cpSync(resolve(REPO, 'grading', script), resolve(stage, script));
  // 文件名只用 ASCII：PowerShell 5.1 的 Compress-Archive 不设 UTF-8 文件名标志位，
  // 中文名在 Linux 下 unzip 出来是乱码（学员跑的是 Ubuntu 22.04）。
  cpSync(resolve(REPO, 'exams/README.md'), resolve(stage, 'exam_rules.md'));

  if (needsLib) {
    copyGraderlib(resolve(stage, 'graderlib'));
    cpSync(resolve(REPO, 'grading/requirements-dev.txt'), resolve(stage, 'requirements-dev.txt'));
  }

  const zip = resolve(OUT, `${day}-materials.zip`);
  rmSync(zip, { force: true });
  // Node 没有内置 zip。这里不能用 Compress-Archive——它把嵌套路径写成反斜杠，
  // Linux 解出来的是名叫 "graderlib\checks.py" 的文件而不是目录，import 必挂。
  // 详见 scripts/zip-dir.ps1 的注释。
  execFileSync('powershell', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', resolve(process.cwd(), 'scripts/zip-dir.ps1'),
    '-Source', stage, '-Destination', zip,
  ], { stdio: 'inherit' });
  console.log(`${day}: ${exam ? `${exam} + ` : ''}${script}${needsLib ? ' + graderlib/' : ''} → ${day}-materials.zip`);
}

rmSync(STAGE, { recursive: true, force: true });
console.log(`\n输出目录：${OUT}`);
console.log(readdirSync(OUT).join('\n'));
if (!existsSync(resolve(OUT, 'day5-materials.zip'))) process.exit(1);
