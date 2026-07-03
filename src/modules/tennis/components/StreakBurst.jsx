import { useEffect, useState, useRef } from 'react';

export function shouldShowBurst(winStreak) {
  return winStreak >= 5;
}

const COLORS = [
  '#FFD700', '#FF6B35', '#4ECDC4', '#FF3F80',
  '#7FFF00', '#BF5FFF', '#FF9F1C', '#2EC4B6',
];
const SHAPES = ['50%', '2px']; // circle or square

export function seedParticles(count = 30) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: (7 + i * 3.1) % 100,
    delay: parseFloat(((i * 0.11) % 1.6).toFixed(2)),
    duration: parseFloat((2.0 + (i % 5) * 0.25).toFixed(2)),
    size: 7 + (i % 4) * 2,
    radius: SHAPES[i % 2],
    startRotate: (i * 47) % 360,
  }));
}

/** 五连胜全屏庆祝动效。pointer-events:none，不拦截用户操作。3.5s 后自动消失。 */
export function StreakBurst({ count }) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timerRef.current);
  }, []);

  if (!shouldShowBurst(count) || !visible) return null;

  const particles = seedParticles(30);

  return (
    <div className="streak-burst-overlay" aria-hidden="true">
      <div className="streak-burst-flash" />
      <div className="streak-burst-text">🔥🔥🔥 {count} 连胜！🔥🔥🔥</div>
      {particles.map((p) => (
        <div
          key={p.id}
          className="streak-burst-particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.radius,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--burst-start-rotate': `${p.startRotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
