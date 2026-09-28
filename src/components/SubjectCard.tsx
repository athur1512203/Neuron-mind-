import { ArrowRight, BrainCircuit, MoreVertical } from "lucide-react";
import { useState, type MouseEvent } from "react";
import type { Subject } from "../types";

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
      className="subject-card group text-left"
    >
        <div className="subject-card-inner">
          <BrainCircuit className="subject-card-brain" strokeWidth={1.8} />

          <h3 className="subject-card-title">{subject.name}</h3>
          <div className="relative z-10 mt-auto flex items-end justify-between gap-3">
            <div className="subject-card-metadata">
              <span className="whitespace-nowrap">
                <strong className="subject-card-accent font-semibold">{subject.neuronCount}</strong> neuron
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                <strong className="subject-card-accent font-semibold">{subject.connectionCount}</strong> kết nối
              </span>
            </div>
            <ArrowRight className="subject-arrow subject-card-accent shrink-0" size={20} />
          </div>
        </div>

      <div
        className="absolute right-3 top-3 z-20"
        onClick={stopCardOpen}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Tùy chọn môn học"
          className="subject-card-menu-button rounded-md p-1"
          onClick={(event) => {
            stopCardOpen(event);
            setMenuOpen((open) => !open);
          }}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-8 min-w-[140px] rounded-md border-2 border-[#111111] bg-[#F5F0DC] py-1 shadow-[2px_2px_0_#111111]">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-red-800 hover:bg-black/5"
              onClick={(event) => {
                stopCardOpen(event);
                setMenuOpen(false);
                onDelete(subject);
              }}
            >
              Xóa môn học
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
