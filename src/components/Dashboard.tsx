import { useState } from "react";
import { Plus } from "lucide-react";
import type { Subject } from "../types";
import { CreateSubjectModal } from "./CreateSubjectModal";
import { SubjectCard } from "./SubjectCard";

type DashboardProps = {
  subjects: Subject[];
  onOpenSubject: (subjectId: string) => void;
  onCreateSubject: (payload: { name: string; description: string; color: string }) => void;
};

export function Dashboard({ subjects, onOpenSubject, onCreateSubject }: DashboardProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <main className="dashboard-main flex-1 overflow-auto">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-fancy text-[42px] leading-tight text-white">Bộ não của tôi</h1>
            <p className="mt-2 text-[#8b9a93]">Mỗi môn học là một mạng kiến thức do chính bạn xây dựng.</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="action-3d-button dashboard-add-button">
            <span className="btn-shadow" />
            <span className="btn-edge" />
            <span className="btn-front">
              <Plus />
              Thêm môn học
            </span>
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {subjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} onOpen={onOpenSubject} />
          ))}
        </div>
      </div>

      {showCreate && (
        <CreateSubjectModal
          onClose={() => setShowCreate(false)}
          onCreate={(payload) => {
            onCreateSubject(payload);
            setShowCreate(false);
          }}
        />
      )}
    </main>
  );
}
