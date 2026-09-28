import { ArrowRight, BrainCircuit, MoreVertical } from "lucide-react";
import { useState, type MouseEvent } from "react";
import type { Subject } from "../types";

const workspacePalette = ["#ADD8E6", "#FFF2C7", "#DDF8E8", "#EDE2FF", "#FFE1E7"];

function workspaceColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return workspacePalette[Math.abs(hash) % workspacePalette.length];
}

type SubjectCardProps = {
  subject: Subject;
  onOpen: (subjectId: string) => void;
  onDelete: (subject: Subject) => void;
};

export function SubjectCard({ subject, onOpen, onDelete }: SubjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const stopCardOpen = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(subject.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(subject.id);
      }}
      className="nm-workspace-card"
      style={{ background: workspaceColor(subject.id) }}
    >
      <BrainCircuit className="nm-workspace-brain" strokeWidth={1.8} aria-hidden="true" />
      <h3 className="nm-workspace-title">{subject.name}</h3>
      <div className="nm-workspace-meta">
        <span>
          <strong>{subject.neuronCount}</strong> neuron
        </span>
        <span>
          <strong>{subject.connectionCount}</strong> kết nối
        </span>
        <ArrowRight className="nm-workspace-arrow" size={18} aria-hidden="true" />
      </div>

      <div className="nm-workspace-menu" onClick={stopCardOpen} onKeyDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          aria-label="Tùy chọn không gian"
          className="nm-workspace-menu-button"
          onClick={(event) => {
            stopCardOpen(event);
            setMenuOpen((open) => !open);
          }}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen ? (
          <div className="nm-workspace-menu-list">
            <button
              type="button"
              onClick={(event) => {
                stopCardOpen(event);
                setMenuOpen(false);
                onDelete(subject);
              }}
            >
              Xóa không gian
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
