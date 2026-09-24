import { ArrowRight, BrainCircuit } from "lucide-react";
import type { CSSProperties } from "react";
import type { Subject } from "../types";

type SubjectCardProps = {
  subject: Subject;
  onOpen: (subjectId: string) => void;
};

export function SubjectCard({ subject, onOpen }: SubjectCardProps) {
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

  return (
    <button
      onClick={() => onOpen(subject.id)}
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
    </button>
  );
}
