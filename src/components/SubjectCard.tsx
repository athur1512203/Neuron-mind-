import { ArrowRight, BrainCircuit, MoreVertical } from "lucide-react";
import { useState, type CSSProperties, type MouseEvent } from "react";
import type { Subject } from "../types";

type SubjectCardProps = {
  subject: Subject;
  onOpen: (subjectId: string) => void;
  onDelete: (subject: Subject) => void;
};

export function SubjectCard({ subject, onOpen, onDelete }: SubjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fallbackBySubject: Record<string, string> = {
    microeconomics: "#22c55e",
    english: "#3b82f6",
    javascript: "#a855f7",
    research: "#f59e0b",
  };
  const color = subject.color || fallbackBySubject[subject.id] || "#22c55e";
  const glow = `${color}40`;
  const style = {
    "--subject-color": color,
    "--subject-glow": glow,
  } as CSSProperties;

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
      style={style}
    >
      <div className="subject-card-middle">
        <div className="subject-card-inner">
          <BrainCircuit className="subject-card-brain" strokeWidth={1.8} />

          <h3 className="app-name relative z-10 max-w-[75%] text-base text-white">{subject.name}</h3>
          <div className="relative z-10 mt-auto flex items-end justify-between gap-3">
            <div className="app-metadata flex items-center gap-2 text-slate-300">
              <span className="whitespace-nowrap">
                <strong className="subject-card-accent font-semibold">{subject.neuronCount}</strong> neuron
              </span>
              <span className="text-slate-600">|</span>
              <span className="whitespace-nowrap">
                <strong className="subject-card-accent font-semibold">{subject.connectionCount}</strong> kết nối
              </span>
            </div>
            <ArrowRight className="subject-arrow subject-card-accent shrink-0" size={20} />
          </div>
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
          className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          onClick={(event) => {
            stopCardOpen(event);
            setMenuOpen((open) => !open);
          }}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-8 min-w-[140px] rounded-md border border-[#1f2a26] bg-[#0b1210] py-1 shadow-xl">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5"
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
