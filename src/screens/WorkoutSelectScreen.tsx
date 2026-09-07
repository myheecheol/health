import { Link } from 'react-router-dom';
import { getRoutine } from '../config/routines';
import { getNextStrengthRoutine } from '../domain/progression';
import { useAppState } from '../state/useStore';
import { TopBar } from '../components/TopBar';

export function WorkoutSelectScreen() {
  const state = useAppState();
  const next = getNextStrengthRoutine(state.sessions, state.user.nextRoutineOverride);
  const routine = getRoutine(next);

  return (
    <>
      <TopBar title="운동 선택" />
      <div className="page">
        <h1 className="page-title">오늘 어떤 운동을 할까요?</h1>

        <Link to="/workout/strength" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div className="row">
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>🏋️ 근력 운동</div>
              <div className="muted" style={{ marginTop: 4 }}>
                다음은 {routine.name} · {routine.summary}
              </div>
            </div>
            <span className="badge badge--strength">→</span>
          </div>
        </Link>

        <Link to="/workout/running" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div className="row">
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>🏃 러닝</div>
              <div className="muted" style={{ marginTop: 4 }}>
                거리는 달린 뒤에 입력합니다
              </div>
            </div>
            <span className="badge badge--running">→</span>
          </div>
        </Link>

        <div className="banner banner--info" style={{ marginTop: 8 }}>
          러닝은 A/B 순서에 영향을 주지 않습니다. 원하는 만큼 자유롭게 추가하세요.
        </div>
      </div>
    </>
  );
}
