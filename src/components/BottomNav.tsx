import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/', icon: '🏠', label: '홈', end: true },
  { to: '/workout', icon: '🏋️', label: '운동', end: false },
  { to: '/history', icon: '📖', label: '기록', end: false },
  { to: '/rewards', icon: '🎁', label: '보상', end: false },
  { to: '/settings', icon: '⚙️', label: '더보기', end: false },
];

export function BottomNav() {
  return (
    <nav className="nav">
      {ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="nav__item">
          <span className="nav__icon">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
