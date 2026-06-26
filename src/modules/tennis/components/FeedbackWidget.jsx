import { useState } from 'react';
import { sendMatchFeedback } from '../../../services/tennisService';

const LABELS = ['', '差评', '一般', '还行', '不错', '超赞！'];

/** 赛后评价控件 — ResultScreen / LadderScreen / AdventureScreen 共用 */
export function FeedbackWidget({ mode, character, result }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  // 'idle' | 'submitted' | 'skipped'
  const [status, setStatus] = useState('idle');

  function submit() {
    sendMatchFeedback({ rating, comment, mode, character, result });
    setStatus('submitted');
  }

  return (
    <div className="card flat fb-card">
      {status === 'submitted' ? (
        <p className="fb-thanks">✅ 感谢你的评价，会帮我们把游戏做得更好！</p>
      ) : status === 'skipped' ? (
        <p className="fb-skip-msg">好的，没问题 🎾</p>
      ) : (
        <>
          <h2>💬 赛后评价（可跳过）</h2>
          <p className="hint">打完有什么感受？一两句话也行，匿名收集，直接影响下次优化方向。</p>
          <div className="fb-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`fb-star${rating >= n ? ' fb-star--on' : ''}`}
                onClick={() => setRating(n)}
                aria-label={`${n} 星`}
              >
                {rating >= n ? '★' : '☆'}
              </button>
            ))}
            {rating > 0 && <span className="fb-rating-label">{LABELS[rating]}</span>}
          </div>
          <textarea
            className="fb-input"
            placeholder="有什么想说的？（可跳过）"
            maxLength={200}
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="fb-actions">
            <button
              type="button"
              className="btn"
              disabled={rating === 0}
              onClick={submit}
            >
              提交评价
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setStatus('skipped')}
            >
              跳过
            </button>
          </div>
        </>
      )}
    </div>
  );
}
