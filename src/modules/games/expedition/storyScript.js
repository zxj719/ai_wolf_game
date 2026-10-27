// Narrative is deliberately separate from the simulation: reading never settles a turn.
export const VOICES = {
  narrator: { name: "旁白", detail: "", color: "#c9c9bd" },
  lin: { name: "林渡", detail: "桥梁检修员 · 在你身旁", color: "#a4c6b4" },
  cen: { name: "岑灯", detail: "九号中继站 · 无线电", color: "#d8ba80" },
  radio: { name: "撤离队", detail: "公共频道", color: "#d8ba80" },
};
const line = (speaker, text, next) => ({ speaker, text, next });

export const STORY_SCENES = {
  firstSteps: {
    chapter: "旧站台", title: "先把脚下看清", location: "九号线 · 检修口", finish: "拿起探测器",
    lines: [
      line("narrator", "林渡拧亮提灯。台阶下面，旧电线和尘土缠在一起。"),
      line("lin", "这里以前埋过雷。你看地面，我照着。"),
      line("cen", "频道开着。找到能歇脚的地方，叫我一声。"),
    ],
  },
  opening: {
    chapter: "序章", title: "断桥的另一端", location: "九号线 · 旧检修站", finish: "去修这条路",
    lines: [
      line("narrator", "收音机响起时，林渡正把最后一截旧桥索卷进包里。"),
      line("cen", "……有人听得见吗？这里是九号中继站。", "回应他"),
      line("lin", "听得见。别关机。"),
      line("cen", "我没打算关。就是电池快替我决定了。"),
      line("narrator", "她停下手，望向断桥另一端。那扇窗还亮着。"),
      line("lin", "我本来准备走了。"),
      line("lin", "你替我看路。我把备用电池送过去。"),
    ],
  },
  reunion: {
    chapter: "相遇", title: "终于不用对着电台说话", location: "一次信号接通之后", finish: "让岑灯加入队伍",
    lines: [
      line("narrator", "门开了一条缝。门后的人还戴着耳机，先看了看林渡，又看了看你。"),
      line("cen", "原来你们这么近。刚才听着，像还隔着半座城。"),
      line("lin", "你的天线歪了。"),
      line("cen", "……我还以为是自己耳朵坏了。"),
      line("narrator", "他笑了一下，把耳机摘下来。桌上有两只洗干净的杯子。"),
    ],
    tip: "岑灯已加入。选择他的名字，之后清扫得到的势力就会分给他。",
  },
  firstCamp: {
    chapter: "落脚", title: "留一盏灯", location: "新接通的桥头", finish: "看看桥头",
    lines: [
      line("lin", "灯放这儿。别挂太高，后面的人看得见就行。"),
      line("cen", "要给这里起个名字吗？"),
      line("lin", "等住进来的人起。我们先把路留好。"),
    ],
    tip: "营地每回合增长 1。桥连好后，较强的角色会自动向它运送补给。",
  },
  firstClear: {
    chapter: "第一夜", title: "可以把鞋脱下来了", location: "第一间扫清的房间", finish: "回到房间",
    lines: [
      line("narrator", "林渡又检查了一遍地面，蹲下来，擦掉门上的危险记号。"),
      line("lin", "这块地干净了。"),
      line("cen", "那我可以把鞋脱了吗？穿着睡了好几天。"),
      line("lin", "脱吧。明早走之前记得穿。"),
      line("narrator", "电台那头安静了一会儿，随后传来一声很长的叹息。"),
    ],
    tip: "用方向门去隔壁房间。这里清出的地面和建好的桥都会保留，随时能回来。",
  },
  invasion: {
    chapter: "来客", title: "他们没有敲门", location: "公共频道 · 紧急呼叫", finish: "查看红色据点",
    lines: [
      line("narrator", "头顶传来绳扣滑过钢梁的声音。有人沿通风井降了下来。"),
      line("cen", "灰帆的人。上次他们来，把中继站的电池全拿走了。"),
      line("lin", "先别出声。让桥头的人往一块儿靠。"),
      line("cen", "这次不走吗？"),
      line("lin", "先看看我们能不能守住。路刚修好。"),
    ],
    tip: "阅读时敌人停在原地。回到地图后，每次清扫或标记，他们才会继续行动。",
  },
  reclaimed: {
    chapter: "回来", title: "名字还在", location: "刚刚收复的房间", finish: "重新接上补给",
    lines: [
      line("narrator", "门闩换过了。林渡推了两次才把门推开。"),
      line("cen", "东西还剩多少？"),
      line("lin", "没多少。"),
      line("narrator", "她用袖口擦了擦桥栏。上次留下的几个名字，露了出来。"),
      line("lin", "这个还在。去叫大家回来吧。"),
    ],
  },
  sixRooms: {
    chapter: "路上的人", title: "门上的字", location: "第六间房之后", finish: "继续往前走",
    lines: [
      line("cen", "有人问，怎么才能找到我们。"),
      line("lin", "沿着亮灯的门走。"),
      line("cen", "他们问灯灭了怎么办。"),
      line("narrator", "林渡想了想，捡起半截粉笔，在门上写：有人，水是热的。"),
      line("lin", "让他们敲门。"),
    ],
    tip: "在人物卡里花原料培养角色，可以提高势力容量；每两级还会增加清扫得到的支援。",
  },
  twelveRooms: {
    chapter: "回信", title: "多出来的一声", location: "第十二间房之后", finish: "把频道留着",
    lines: [
      line("cen", "昨晚关机前，我听见有人敲了三下。"),
      line("lin", "水管。这里的水管一到晚上就响。"),
      line("cen", "我也这么想。后来我敲了两下。"),
      line("narrator", "他把一段很轻的录音放给你听。两声，停顿，然后是三声。"),
      line("lin", "……今晚再试一次。"),
    ],
    tip: "离角色太远，清扫支援会减少。在新房间扫出落脚点后，可以花原料把角色迁驻过来。",
  },
  eighteenRooms: {
    chapter: "同一时间", title: "有人听到了", location: "第十八间房之后", finish: "向下一个信号出发",
    lines: [
      line("cen", "这次听清了。下面还有人。"),
      line("lin", "说什么了？"),
      line("cen", "他说，明天同一时间。"),
      line("lin", "这不是你每天最后说的那句吗？"),
      line("narrator", "岑灯没回答。他把录音倒回去，又听了一遍。"),
    ],
    tip: "缩放至全层后，可以向相邻房间派队。清扫完一间新房，跨区队伍才会抵达；也能用它收复旧家。",
  },
  descent: {
    chapter: "下行", title: "把门留着", location: "下一层入口", finish: "继续下行",
    lines: [
      line("cen", "上面的灯，要关掉吗？"),
      line("lin", "留着。有人可能还没走到。"),
      line("narrator", "她把一张通路图压在杯子下面，背起工具包。楼梯深处，收音机又响了。"),
    ],
  },
};

export const LESSON_SCENES = [
  {
    chapter: "序章 · 看路", title: "先找一块能落脚的地方", location: "桥头 · 旧勘测图", finish: "拿起探测器",
    lines: [
      line("lin", "桥头埋着旧雷。先别往下走，我们拿勘测图试一下。"),
      line("cen", "探测器上的数字，数的是周围八个格子里的雷。"),
      line("lin", "明白这一点，就能开始了。我在旁边看着。"),
    ],
  },
  {
    chapter: "序章 · 铺路", title: "从我这里出发", location: "桥头 · 已清扫的地面", finish: "画出第一段桥",
    lines: [
      line("lin", "这段路能走了。把图给我。"),
      line("narrator", "她把桥索放在脚边，压住被风掀起的一角。"),
      line("lin", "从我这儿开始，往右划过去。我照着你的路线铺。"),
    ],
  },
  {
    chapter: "序章 · 落脚", title: "桥的尽头", location: "距中继站一步之遥", finish: "看看桥头营地",
    lines: [
      line("cen", "我看见桥头的灯了。"),
      line("lin", "这里留个人守着。后面来的人，有个地方歇脚。"),
      line("narrator", "林渡把提灯挂在桥栏上，试了试绳结。"),
    ],
  },
  {
    chapter: "序章 · 等一等", title: "补给正在路上", location: "桥头营地", finish: "继续清扫，等它过桥",
    lines: [
      line("cen", "桥修好了。电池到了吗？"),
      line("lin", "刚送出去。路得一段一段走。"),
      line("lin", "你继续看前面的路。我在这头等。"),
    ],
  },
  {
    chapter: "序章 · 守住", title: "门外的脚步", location: "九号中继站", finish: "从桥头派人过去",
    lines: [
      line("narrator", "补给刚放下，电台那头响起了急促的脚步声。"),
      line("cen", "灰帆。他们在拆我的天线。"),
      line("lin", "别去拦。把门关上，我们从桥头过去。"),
    ],
  },
  {
    chapter: "序章 · 接通", title: "不用带杯子", location: "九号中继站 · 灯亮着", finish: "带上他们，开始远征",
    lines: [
      line("narrator", "门外安静下来。频道里传来一声金属杯落在桌上的轻响。"),
      line("cen", "热水烧上了。你们过来时，别带杯子。"),
      line("lin", "你这儿能坐几个人？"),
      line("cen", "先来。凳子不够，我再找。"),
      line("lin", "听见了。走吧。"),
    ],
  },
];

export function migrationScene(alert) {
  return {
    chapter: "撤离", title: "先过桥", location: "公共频道 · 线路不稳", finish: "去接应他们",
    lines: [
      line("radio", "守不住了。后面的人还没走完。"),
      line("lin", "东西放下。先过桥。"),
      line("narrator", "一阵刺耳的杂音后，频道重新接通。撤离队报了一遍人数。"),
      line("radio", "人都到了。只是家没了。"),
      line("lin", "先找地方坐下。回去的路，我们慢慢想。"),
    ],
    tip: `${alert.text} 培养等级保留；恢复势力后，可以从相邻房间派队收复。`,
  };
}
