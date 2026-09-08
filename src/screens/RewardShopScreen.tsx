import { useState } from 'react';
import type { Reward } from '../data/types';
import { addReward, redeemReward, removeReward, updateReward } from '../state/store';
import { useAppState } from '../state/useStore';
import { TopBar } from '../components/TopBar';

export function RewardShopScreen() {
  const state = useAppState();
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const [tab, setTab] = useState<'shop' | 'history'>('shop');

  const points = state.user.rewardPoints;
  const shop = state.rewards.filter((r) => r.active);

  function handleRedeem(reward: Reward) {
    if (!window.confirm(`${reward.emoji} ${reward.name} 보상을 사용할까요?\n${reward.cost}P가 차감됩니다.`)) return;
    const result = redeemReward(reward.id);
    setMessage(
      result.ok
        ? `${reward.emoji} ${reward.name} 보상을 사용했습니다. 남은 포인트 : ${result.remaining}P`
        : result.error,
    );
    window.setTimeout(() => setMessage(null), 4000);
  }

  return (
    <>
      <TopBar title="보상 상점" />
      <div className="page">
        {message && <div className="banner banner--info">{message}</div>}

        <div className="points-hero">
          <div className="points-hero__label">현재 포인트</div>
          <div className="points-hero__value">{points.toLocaleString('ko-KR')}P</div>
          <div className="points-hero__hint">
            근력 운동 1회 약 170P · 러닝 6.8km 약 102P
          </div>
        </div>

        <div className="tabs">
          <button className="tab" aria-selected={tab === 'shop'} onClick={() => setTab('shop')}>
            상점
          </button>
          <button className="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
            사용 내역 {state.rewardHistory.length > 0 && `(${state.rewardHistory.length})`}
          </button>
        </div>

        {tab === 'shop' ? (
          <>
            <div className="list">
              {shop.length === 0 && <div className="empty">보상을 추가해보세요.</div>}
              {shop.map((reward) => {
                const affordable = points >= reward.cost;
                return (
                  <div key={reward.id} className={'reward' + (affordable ? '' : ' reward--locked')}>
                    <span className="reward__emoji">{reward.emoji}</span>
                    <div className="reward__main">
                      <div className="reward__name">{reward.name}</div>
                      <div className="reward__desc">{reward.description}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="reward__cost">{reward.cost}P</div>
                      {!affordable && (
                        <div className="reward__need">{reward.cost - points}P 더 필요</div>
                      )}
                    </div>
                    <button
                      className="btn btn--sm"
                      style={{ background: affordable ? 'var(--gold)' : 'var(--surface-3)', color: affordable ? '#2a1f00' : 'var(--text-faint)' }}
                      disabled={!affordable}
                      onClick={() => handleRedeem(reward)}
                    >
                      교환
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setEditing('new')}>
                + 보상 추가
              </button>
            </div>

            {state.rewards.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card__label">보상 관리</div>
                <div className="list">
                  {state.rewards.map((r) => (
                    <button key={r.id} className="list-item" onClick={() => setEditing(r)}>
                      <span className="reward__emoji" style={{ fontSize: 20 }}>{r.emoji}</span>
                      <div className="list-item__main">
                        <div className="list-item__title">{r.name}</div>
                        <div className="list-item__sub">
                          {r.cost}P{!r.active && ' · 숨김'}
                        </div>
                      </div>
                      <div className="list-item__right">수정</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="list">
            {state.rewardHistory.length === 0 ? (
              <div className="empty">아직 사용한 보상이 없습니다.</div>
            ) : (
              [...state.rewardHistory].reverse().map((h) => (
                <div key={h.id} className="list-item">
                  <span className="reward__emoji" style={{ fontSize: 20 }}>{h.rewardEmoji}</span>
                  <div className="list-item__main">
                    <div className="list-item__title">{h.rewardName}</div>
                    <div className="list-item__sub">
                      {new Date(h.usedAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div className="reward__cost">−{h.cost}P</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {editing && (
        <RewardEditor
          reward={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function RewardEditor({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const [name, setName] = useState(reward?.name ?? '');
  const [emoji, setEmoji] = useState(reward?.emoji ?? '🎁');
  const [description, setDescription] = useState(reward?.description ?? '');
  const [cost, setCost] = useState(String(reward?.cost ?? 100));
  const [error, setError] = useState<string | null>(null);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError('보상 이름을 입력해주세요');
    const n = Number(cost);
    if (!Number.isFinite(n) || n < 1) return setError('필요 포인트는 1 이상의 숫자여야 해요');

    const payload = {
      name: trimmed,
      emoji: emoji.trim() || '🎁',
      description: description.trim(),
      cost: Math.round(n),
      category: reward?.category ?? '기타',
      active: reward?.active ?? true,
    };
    if (reward) updateReward(reward.id, payload);
    else addReward(payload);
    onClose();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__title">{reward ? '보상 수정' : '새 보상'}</div>

        <div className="stack">
          <div className="set-inputs" style={{ gridTemplateColumns: '80px 1fr' }}>
            <label className="field">
              <span className="field__label">아이콘</span>
              <input className="input" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
            </label>
            <label className="field">
              <span className="field__label">이름</span>
              <input
                className="input input--text" value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                placeholder="치킨 시켜먹기"
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">설명 (선택)</span>
            <input
              className="input input--text" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="주말에 한 번"
            />
          </label>

          <label className="field">
            <span className="field__label">필요 포인트</span>
            <input
              className="input" type="number" inputMode="numeric" min={1}
              value={cost} onChange={(e) => { setCost(e.target.value); setError(null); }}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              100P = 운동 1번 · 300P = 운동 2~3번 · 500P = 운동 3~4번
            </span>
          </label>

          {error && <div className="input-error">{error}</div>}

          {reward && (
            <div className="row">
              <span className="muted">상점에 표시</span>
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => { updateReward(reward.id, { active: !reward.active }); onClose(); }}
              >
                {reward.active ? '숨기기' : '다시 보이기'}
              </button>
            </div>
          )}

          <button className="btn btn--primary" onClick={save}>저장</button>
          <button className="btn btn--ghost btn--sm" style={{ width: '100%' }} onClick={onClose}>
            취소
          </button>
          {reward && (
            <button
              className="btn btn--danger btn--sm"
              style={{ width: '100%' }}
              onClick={() => {
                if (!window.confirm(`${reward.name} 보상을 삭제할까요?\n이미 사용한 내역은 그대로 남습니다.`)) return;
                removeReward(reward.id);
                onClose();
              }}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
