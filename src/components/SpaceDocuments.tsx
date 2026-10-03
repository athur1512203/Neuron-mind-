import { FileText, Menu, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiMessage } from "../api/client";
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  uploadDocument,
  validateDocumentFile,
  type DocumentMeta,
} from "../api/documents";
import type { Subject } from "../types";
import { Button } from "./ui/Button";

export function SpaceDocuments({ subject, onToggleSidebar }: { subject: Subject; onToggleSidebar?: () => void }) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async (subjectId: string) => setDocuments(await listDocuments(subjectId));

  useEffect(() => {
    let active = true;
    setDocuments([]);
    setLoading(true);
    setNotice("");
    listDocuments(subject.id)
      .then((items) => { if (active) setDocuments(items); })
      .catch((error) => { if (active) setNotice(apiMessage(error, "Không tải được danh sách tài liệu.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [subject.id]);

  const upload = async (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    if (!selected.length || uploading) return;
    const invalid = selected.map((file) => ({ file, message: validateDocumentFile(file) })).find((item) => item.message);
    if (invalid) { setNotice(`${invalid.file.name}: ${invalid.message}`); return; }
    setUploading(true);
    setNotice("");
    try {
      for (const file of selected) await uploadDocument(subject.id, file);
      await refresh(subject.id);
      setNotice("Tải tài liệu thành công");
    } catch (error) {
      setNotice(apiMessage(error, "Không tải được tài liệu."));
    } finally { setUploading(false); }
  };

  const remove = async (document: DocumentMeta) => {
    if (deletingId || !window.confirm("Bạn có chắc muốn xóa tài liệu này?")) return;
    setDeletingId(document.id);
    setNotice("");
    try { await deleteDocument(document.id); await refresh(subject.id); }
    catch (error) { setNotice(apiMessage(error, "Không xóa được tài liệu.")); }
    finally { setDeletingId(null); }
  };

  const download = async (document: DocumentMeta) => {
    if (downloadingId) return;
    setDownloadingId(document.id);
    setNotice("");
    try { await downloadDocument(document); }
    catch (error) { setNotice(apiMessage(error, "Không tải xuống được tài liệu.")); }
    finally { setDownloadingId(null); }
  };

  return (
    <main className="space-documents-page">
      <header className="space-documents-header">
        <div className="space-documents-title">
          {onToggleSidebar ? <Button variant="icon" className="nm-toolbar-menu" aria-label="Menu" onClick={onToggleSidebar}><Menu size={18} /></Button> : null}
          <div><h1>Tài liệu</h1><p>Tài liệu trong không gian {subject.name}</p></div>
        </div>
        <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Plus size={16} /> {uploading ? "Đang tải..." : "Tải tài liệu"}
        </Button>
      </header>
      <section className="nm-docs space-documents-content" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files); }}>
        {notice ? <p className="nm-docs-status">{notice}</p> : null}
        {loading ? <p className="nm-docs-status">Đang tải tài liệu...</p> : null}
        {!loading && !documents.length ? (
          <div className="nm-docs-empty"><p>Chưa có tài liệu</p><p>Tải tài liệu dùng chung cho không gian này.</p>
            <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}><Plus size={15} /> Tải tài liệu</Button>
          </div>
        ) : null}
        {!loading && documents.length ? <div className="nm-docs-list">
          {documents.map((document) => <div key={document.id} className="nm-doc-row">
            <FileText size={18} />
            <span className="min-w-0 flex-1"><strong className="block truncate">{document.originalName}</strong>
              <small>{formatType(document)} • {formatFileSize(document.size)} • {formatDate(document.createdAt)}</small></span>
            <Button variant="secondary" size="sm" onClick={() => void download(document)} disabled={Boolean(downloadingId)}>
              {downloadingId === document.id ? "Đang tải..." : "Tải xuống"}</Button>
            <Button variant="danger" size="sm" onClick={() => void remove(document)} disabled={Boolean(deletingId)}>
              {deletingId === document.id ? "Đang xóa..." : "Xóa"}</Button>
          </div>)}
        </div> : null}
      </section>
      <input ref={inputRef} className="hidden" type="file" multiple
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.zip"
        onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
    </main>
  );
}

function formatType(document: DocumentMeta) {
  return document.extension.replace(/^\./, "").toUpperCase() || document.mimeType;
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không xác định" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(date);
}
function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
