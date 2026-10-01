import { Plus } from "lucide-react";
import { Button } from "./ui/Button";

type WorkspaceEmptyProps = {
  loading?: boolean;
  error?: string | null;
  onCreateSpace: () => void;
};

export function WorkspaceEmpty({ loading, error, onCreateSpace }: WorkspaceEmptyProps) {
  return (
    <main className="nm-empty-workspace">
      {loading ? <p className="nm-empty-workspace-copy">Đang tải không gian...</p> : null}
      {error ? <p className="nm-empty-workspace-error">{error}</p> : null}
      {!loading ? (
        <>
          <h1>Chưa có không gian</h1>
          <p>Tạo không gian đầu tiên để bắt đầu.</p>
          <Button variant="primary" onClick={onCreateSpace}>
            <Plus size={16} />
            Tạo không gian
          </Button>
        </>
      ) : null}
    </main>
  );
}
