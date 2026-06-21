export function ScopeButton({ active, detail, label, onClick, stats }) {
  return (
    <button
      className={`range-item ${active ? 'is-active' : ''}`.trim()}
      type="button"
      onClick={onClick}
    >
      <span className="range-label">
        {label}
        {detail ? <small>{detail}</small> : null}
      </span>
      <span className="range-progress">
        已学 {stats.learned}/{stats.total}
        <small>掌握 {stats.known}</small>
      </span>
    </button>
  );
}
