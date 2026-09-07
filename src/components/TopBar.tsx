import { useNavigate } from 'react-router-dom';
import { SyncBadge } from './SyncBadge';

export function TopBar({ title, back }: { title: string; back?: string | true }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button
          className="topbar__back"
          onClick={() => (back === true ? nav(-1) : nav(back))}
          aria-label="뒤로"
        >
          ←
        </button>
      )}
      <span className="topbar__title">{title}</span>
      <SyncBadge />
    </header>
  );
}
