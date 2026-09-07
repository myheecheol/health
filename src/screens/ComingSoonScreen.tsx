import { TopBar } from '../components/TopBar';

/** 아직 개발 단계가 오지 않은 화면. 어느 단계에서 열리는지 명시합니다. */
export function ComingSoonScreen({ title, emoji, stage, items }: {
  title: string; emoji: string; stage: string; items: string[];
}) {
  return (
    <>
      <TopBar title={title} />
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>{emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{title}</div>
          <div className="badge badge--warn" style={{ marginTop: 10 }}>{stage}에서 열립니다</div>
        </div>
        <div className="card">
          <div className="card__label">예정된 기능</div>
          <div className="list">
            {items.map((item) => (
              <div key={item} className="list-item">
                <span className="muted">·</span>
                <div className="list-item__main">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
