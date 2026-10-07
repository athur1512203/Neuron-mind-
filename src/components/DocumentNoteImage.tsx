import { useEffect, useState } from "react";
import { loadDocumentImage } from "../api/documents";

export function DocumentNoteImage({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let current = "";
    setUrl(""); setFailed(false);
    void loadDocumentImage(id, controller.signal).then((next) => { current = next; if (controller.signal.aborted) URL.revokeObjectURL(next); else setUrl(next); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (current) URL.revokeObjectURL(current); };
  }, [id]);
  return url ? <img className="nm-note-inline-image" src={url} alt={alt} /> : <span role="status">{failed ? "Không tải được ảnh." : "Đang tải ảnh..."}</span>;
}
