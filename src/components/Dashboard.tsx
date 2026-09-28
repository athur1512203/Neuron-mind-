import { useState } from "react";
import { Plus } from "lucide-react";
import type { Subject } from "../types";
import { CreateSubjectModal } from "./CreateSubjectModal";
import { SubjectCard } from "./SubjectCard";

type DashboardProps = {
  subjects: Subject[];
  loading?: boolean;
  error?: string | null;
  onOpenSubject: (subjectId: string) => void;
  onCreateSubject: (payload: { name: string; description: string; color: string }) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
};

export function Dashboard({ subjects, loading, error, onOpenSubject, onCreateSubject, onDeleteSubject }: DashboardProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Subject | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

        {loading ? <p className="text-sm text-[#8b9a93]">Đang tải môn học...</p> : null}
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onOpen={onOpenSubject}
              onDelete={(item) => {
                setDeleteError("");
                setPendingDelete(item);
              }}
            />
          ))}
        </div>
      </div>

      {showCreate && (
        <CreateSubjectModal
          onClose={() => setShowCreate(false)}
          onCreate={async (payload) => {
            await onCreateSubject(payload);
            setShowCreate(false);
          }}
        />
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => !deleteBusy && setPendingDelete(null)}>
          <section
            className="w-full max-w-md rounded-xl border border-[#1f2a26] bg-[#0b1210] p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-fancy text-2xl text-white">Xóa môn học này?</h2>
            <p className="mt-3 text-sm leading-6 text-[#8b9a93]">Toàn bộ neuron và liên kết trong môn học này cũng sẽ bị xóa.</p>
            {deleteError ? <p className="mt-3 text-sm text-red-400">{deleteError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={deleteBusy} onClick={() => setPendingDelete(null)} className="action-3d-button secondary">
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front">Hủy</span>
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                className="action-3d-button dashboard-add-button"
                onClick={async () => {
                  setDeleteBusy(true);
                  setDeleteError("");
                  try {
                    await onDeleteSubject(pendingDelete.id);
                    setPendingDelete(null);
                  } catch (caught) {
                    setDeleteError(caught instanceof Error ? caught.message : "Không xóa được môn học.");
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
              >
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front">{deleteBusy ? "Đang xóa..." : "Xóa môn học"}</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
