import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { onStorageFailure } from './data/localStore';
import { initSync } from './data/syncEngine';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { CompleteScreen } from './screens/CompleteScreen';
import { HistoryScreen, SessionDetailScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RewardShopScreen } from './screens/RewardShopScreen';
import { StatsScreen } from './screens/StatsScreen';
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
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/rewards" element={<RewardShopScreen />} />
        <Route path="/achievements" element={<AchievementsScreen />} />
        <Route path="/calendar" element={<Navigate to="/history" replace />} />
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
