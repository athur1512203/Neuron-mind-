import { ChevronRight } from "lucide-react";
import type { Subject } from "../types";

type RecentActivityProps = {
  subjects: Subject[];
  onOpenSubject: (subjectId: string) => void;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const day = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `Cập nhật ${time} ${day}`;
}

export function RecentActivity({ subjects, onOpenSubject }: RecentActivityProps) {
  const recent = [...subjects]
    .filter((subject) => subject.updatedAt)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 5);

  return (
    <section className="nm-activity">
      <h2 className="nm-panel-title">Không gian cập nhật gần đây</h2>
      {recent.length === 0 ? (
        <p className="nm-empty">Chưa có không gian nào.</p>
      ) : (
        <ul className="nm-activity-list">
          {recent.map((subject) => (
            <li key={subject.id}>
              <button type="button" className="nm-activity-item" onClick={() => onOpenSubject(subject.id)}>
                <span className="nm-activity-copy">
                  <strong>{subject.name}</strong>
                  <small>
                    {subject.neuronCount} neuron · {formatUpdatedAt(subject.updatedAt)}
                  </small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
