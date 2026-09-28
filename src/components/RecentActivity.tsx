import { ChevronRight } from "lucide-react";
import type { Neuron, Subject } from "../types";

type RecentActivityProps = {
  neurons: Neuron[];
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

export function RecentActivity({ neurons, subjects, onOpenSubject }: RecentActivityProps) {
  const recent = [...neurons]
    .filter((neuron) => neuron.updatedAt)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 5);

  return (
    <section className="nm-activity">
      <h2 className="nm-panel-title">Hoạt động gần đây</h2>
      {recent.length === 0 ? (
        <p className="nm-empty">Chưa có hoạt động gần đây.</p>
      ) : (
        <ul className="nm-activity-list">
          {recent.map((neuron) => {
            const workspace = subjects.find((subject) => subject.id === neuron.subjectId);
            return (
              <li key={neuron.id}>
                <button type="button" className="nm-activity-item" onClick={() => onOpenSubject(neuron.subjectId)}>
                  <span className="nm-activity-copy">
                    <strong>{neuron.name}</strong>
                    <small>
                      {workspace ? `${workspace.name} · ` : ""}
                      {formatUpdatedAt(neuron.updatedAt)}
                    </small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
