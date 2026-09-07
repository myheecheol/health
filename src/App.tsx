import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { onStorageFailure } from './data/localStore';
import { initSync } from './data/syncEngine';
import { ComingSoonScreen } from './screens/ComingSoonScreen';
import { CompleteScreen } from './screens/CompleteScreen';
import { HistoryScreen, SessionDetailScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RunningScreen } from './screens/RunningScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StrengthActiveScreen } from './screens/StrengthActiveScreen';
import { StrengthPreviewScreen } from './screens/StrengthPreviewScreen';
import { WorkoutSelectScreen } from './screens/WorkoutSelectScreen';
import './styles/app.css';

/** 운동 진행 중에는 하단 탭을 숨겨 오조작을 막습니다 (요구사항 23절). */
const FULLSCREEN = ['/workout/strength/go', '/workout/running'];

function Shell() {
  const location = useLocation();
  const isFullscreen =
    FULLSCREEN.includes(location.pathname) || location.pathname.startsWith('/complete/');

  return (
    <div className="app">
      <StorageAlert />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/workout" element={<WorkoutSelectScreen />} />
        <Route path="/workout/strength" element={<StrengthPreviewScreen />} />
        <Route path="/workout/strength/go" element={<StrengthActiveScreen />} />
        <Route path="/workout/running" element={<RunningScreen />} />
        <Route path="/complete/:sessionId" element={<CompleteScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:sessionId" element={<SessionDetailScreen />} />
        <Route
          path="/calendar"
          element={
            <ComingSoonScreen
              title="캘린더" emoji="📅" stage="2단계"
              items={['운동한 날 표시', '웨이트/러닝 아이콘 구분', '날짜별 기록 열람']}
            />
          }
        />
        <Route
          path="/stats"
          element={
            <ComingSoonScreen
              title="통계" emoji="📊" stage="5단계"
              items={['총 운동 횟수/시간', '웨이트 볼륨 추이', '러닝 누적 거리', '종목별 최고 중량', '월간·연간 러닝']}
            />
          }
        />
        <Route
          path="/rewards"
          element={
            <ComingSoonScreen
              title="보상 상점" emoji="🎁" stage="4단계"
              items={['보상 직접 등록/수정/삭제', '포인트로 교환', '보상 사용 내역']}
            />
          }
        />
        <Route
          path="/achievements"
          element={
            <ComingSoonScreen
              title="업적" emoji="🏅" stage="3단계"
              items={['첫 운동 / 첫 러닝', '누적 운동 10·50·100회', '누적 러닝 5·10·50·100·500km', '연속 운동 10회', '첫 PR']}
            />
          }
        />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isFullscreen && <BottomNav />}
    </div>
  );
}

/** 로컬 저장 실패는 조용히 넘기지 않고 반드시 사용자에게 보여줍니다. */
function StorageAlert() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onStorageFailure(setError), []);
  if (!error) return null;
  return (
    <div className="banner banner--danger" style={{ margin: 12, marginBottom: 0 }}>
      ⚠️ {error}
      <button className="btn btn--sm btn--ghost" style={{ marginLeft: 'auto' }} onClick={() => setError(null)}>
        닫기
      </button>
    </div>
  );
}

export function App() {
  useEffect(() => {
    initSync();
  }, []);

  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
