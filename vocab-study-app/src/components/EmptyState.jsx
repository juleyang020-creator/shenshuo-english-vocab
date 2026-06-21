import { BookOpen } from 'lucide-react';

export function EmptyState({ title, detail }) {
  return (
    <div className="empty-state">
      <BookOpen size={30} />
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}
