/**
 * TileFace — 麻将牌面（SVG 自绘，viewBox 40×54）。
 * 不用 Unicode 🀀-🀫：各平台字体覆盖不一，Windows 上大半显示成方框。
 */

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WINDS = { E: '東', S: '南', W: '西', N: '北' };
const FLOWERS = ['', '梅', '蘭', '竹', '菊'];
const SEASONS = ['', '春', '夏', '秋', '冬'];

const RED = '#c0392b';
const GREEN = '#1e8449';
const BLUE = '#1f4e8c';
const INK = '#1c1c1c';

// 筒 / 条的点位（中心坐标）
const SPOTS = {
  1: [[20, 27]],
  2: [[20, 14], [20, 40]],
  3: [[10, 11], [20, 27], [30, 43]],
  4: [[12, 15], [28, 15], [12, 39], [28, 39]],
  5: [[11, 12], [29, 12], [20, 27], [11, 42], [29, 42]],
  6: [[12, 11], [28, 11], [12, 27], [28, 27], [12, 43], [28, 43]],
  7: [[9, 8], [20, 13], [31, 18], [13, 32], [27, 32], [13, 45], [27, 45]],
  8: [[13, 8], [27, 8], [13, 20], [27, 20], [13, 33], [27, 33], [13, 46], [27, 46]],
  9: [[10, 11], [20, 11], [30, 11], [10, 27], [20, 27], [30, 27], [10, 43], [20, 43], [30, 43]],
};

function Dots({ n }) {
  const r = n === 1 ? 11 : n <= 2 ? 7.5 : n <= 6 ? 5.6 : 4.6;
  return SPOTS[n].map(([x, y], i) => {
    const color = n === 1 ? RED : (n === 5 && i === 2) || (n === 7 && i < 3) || (n === 9 && i >= 3 && i < 6) ? RED : i % 2 ? GREEN : BLUE;
    return (
      <g key={i}>
        <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={r > 6 ? 2.4 : 1.8} />
        <circle cx={x} cy={y} r={r * 0.38} fill={color} />
      </g>
    );
  });
}

function Bamboo({ n }) {
  if (n === 1) {
    // 一条：传统是只鸟，这里画一根大竹 + 红顶
    return (
      <g>
        <rect x={16} y={8} width={8} height={38} rx={4} fill={GREEN} />
        <rect x={16} y={25} width={8} height={2} fill="#fff" opacity={0.7} />
        <circle cx={20} cy={8} r={4.5} fill={RED} />
      </g>
    );
  }
  const h = n <= 4 ? 16 : n <= 6 ? 12 : 10;
  return SPOTS[n].map(([x, y], i) => {
    const color = (n === 5 && i === 2) || (n === 7 && i === 0) || (n === 9 && i % 3 === 1) ? RED : GREEN;
    return (
      <g key={i}>
        <rect x={x - 2.6} y={y - h / 2} width={5.2} height={h} rx={2.4} fill={color} />
        <rect x={x - 2.6} y={y - 0.6} width={5.2} height={1.2} fill="#fff" opacity={0.75} />
      </g>
    );
  });
}

function Glyph({ text, color, size = 26, y = 36 }) {
  return (
    <text x={20} y={y} textAnchor="middle" fontSize={size} fontWeight={700} fill={color}
      fontFamily='"Noto Serif SC","Songti SC","SimSun",serif'>
      {text}
    </text>
  );
}

export default function TileFace({ face }) {
  const kind = face[0];
  const v = face.slice(1);
  let body;
  if (kind === 'm') {
    body = (
      <>
        <Glyph text={NUMERALS[v]} color={BLUE} size={17} y={22} />
        <Glyph text="萬" color={RED} size={19} y={46} />
      </>
    );
  } else if (kind === 'p') body = <Dots n={Number(v)} />;
  else if (kind === 's') body = <Bamboo n={Number(v)} />;
  else if (kind === 'w') body = <Glyph text={WINDS[v]} color={INK} />;
  else if (kind === 'd') {
    body = v === 'C' ? <Glyph text="中" color={RED} />
      : v === 'F' ? <Glyph text="發" color={GREEN} />
      : <rect x={8} y={10} width={24} height={34} rx={2} fill="none" stroke={BLUE} strokeWidth={2.5} />;
  } else if (kind === 'f') {
    body = (
      <>
        <Glyph text={FLOWERS[v]} color="#8e44ad" size={22} y={34} />
        <text x={33} y={49} textAnchor="middle" fontSize={8} fill="#8e44ad">{v}</text>
      </>
    );
  } else if (kind === 'j') {
    body = (
      <>
        <Glyph text={SEASONS[v]} color="#d35400" size={22} y={34} />
        <text x={33} y={49} textAnchor="middle" fontSize={8} fill="#d35400">{v}</text>
      </>
    );
  }
  return (
    <svg viewBox="0 0 40 54" width="100%" height="100%" aria-hidden="true">
      {body}
    </svg>
  );
}

const FACE_NAMES = { m: '万', p: '筒', s: '条' };
export function faceLabel(face) {
  const kind = face[0];
  const v = face.slice(1);
  if (FACE_NAMES[kind]) return `${NUMERALS[v]}${FACE_NAMES[kind]}`;
  if (kind === 'w') return `${WINDS[v]}风`;
  if (kind === 'd') return { C: '红中', F: '发财', P: '白板' }[v];
  if (kind === 'f') return `花·${FLOWERS[v]}`;
  return `季·${SEASONS[v]}`;
}
