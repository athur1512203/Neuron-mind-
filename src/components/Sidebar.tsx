import { Brain, FileText, MoreHorizontal, Plus, Search, Settings, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LayoutMode } from "../hooks/useMediaQuery";
import type { Subject, ViewName } from "../types";
import { CreateSubjectModal } from "./CreateSubjectModal";
import { Button } from "./ui/Button";

type SidebarProps = {
  activeView: ViewName;
  subjects: Subject[];
  selectedSubjectId: string | null;
  userLabel: string;
  layoutMode: LayoutMode;
  open?: boolean;
  onClose?: () => void;
  onNavigate: (view: ViewName) => void;
  onSearch: () => void;
  onSelectSpace: (subjectId: string) => void;
  onCreateSubject: (payload: { name: string; color: string }) => Promise<void>;
  onRenameSubject: (subjectId: string, name: string) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
  onLogout: () => void;
};

export function Sidebar({
  activeView,
  subjects,
  selectedSubjectId,
  userLabel,
  layoutMode,
  open = true,
  onClose,
  onNavigate,
  onSearch,
  onSelectSpace,
  onCreateSubject,
  onRenameSubject,
  onDeleteSubject,
  onLogout,
}: SidebarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [spaceMenuId, setSpaceMenuId] = useState<string | null>(null);
  const [spaceMenuUp, setSpaceMenuUp] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Subject | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Subject | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const asideRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const initials = userLabel.trim().slice(0, 1).toUpperCase() || "N";
  const overlayOpen = layoutMode !== "desktop" && open;

  useEffect(() => {
    if (!overlayOpen) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeButton = asideRef.current?.querySelector<HTMLButtonElement>("[data-sidebar-close]");
    closeButton?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (renameTarget || pendingDelete) return;
        if (spaceMenuId) {
          setSpaceMenuId(null);
          return;
        }
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || renameTarget || pendingDelete) return;
      const items = Array.from(asideRef.current?.querySelectorAll<HTMLElement>("button, [href], input") ?? []);
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length;
      items[next]?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [overlayOpen, layoutMode, onClose, spaceMenuId, renameTarget, pendingDelete]);

  useEffect(() => {
    if (!spaceMenuId) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (asideRef.current?.querySelector(`[data-space-row="${spaceMenuId}"]`)?.contains(target)) return;
      setSpaceMenuId(null);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [spaceMenuId]);

  useEffect(() => {
    if (!renameTarget) return;
    renameRef.current?.focus();
    renameRef.current?.select();
  }, [renameTarget]);

  const afterChoose = () => {
    if (layoutMode !== "desktop") onClose?.();
  };

  const openSpaceMenu = (subjectId: string, button: HTMLButtonElement) => {
    const list = asideRef.current?.querySelector(".sidebar-space-list");
    const rect = button.getBoundingClientRect();
    const listRect = list?.getBoundingClientRect();
    setSpaceMenuUp(Boolean(listRect && rect.bottom + 120 > listRect.bottom));
    setSpaceMenuId((current) => (current === subjectId ? null : subjectId));
  };

  return (
    <aside
      ref={asideRef}
      className={`app-sidebar${open ? " is-open" : ""}${spaceMenuId ? " is-space-menu" : ""}`}
      role={overlayOpen ? "dialog" : undefined}
      aria-modal={overlayOpen ? true : undefined}
      aria-label="Điều hướng"
    >
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon" aria-hidden="true">
          <Brain size={18} />
        </span>
        <span className="sidebar-brand-name">NeuroMind</span>
        {layoutMode !== "desktop" && open ? (
          <Button variant="icon" data-sidebar-close className="sidebar-close" aria-label="Đóng menu" onClick={onClose}>
            <X size={18} />
          </Button>
        ) : null}
      </div>

      <nav className="sidebar-navigation" aria-label="Điều hướng chính">
        <button type="button" className="sidebar-nav-item" data-onboarding="search" onClick={() => { onSearch(); afterChoose(); }}>
          <Search size={18} />
          <span className="sidebar-nav-label">Search</span>
          <span className="sidebar-tooltip">Search</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === "map" || activeView === "connections" ? "is-active" : ""}`}
          onClick={() => { onNavigate("map"); afterChoose(); }}
        >
          <Share2 size={18} />
          <span className="sidebar-nav-label">Sơ đồ</span>
          <span className="sidebar-tooltip">Sơ đồ</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === "documents" ? "is-active" : ""}`}
          disabled={!selectedSubjectId}
          onClick={() => { onNavigate("documents"); afterChoose(); }}
        >
          <FileText size={18} />
          <span className="sidebar-nav-label">Tài liệu</span>
          <span className="sidebar-tooltip">Tài liệu không gian</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === "settings" ? "is-active" : ""}`}
          onClick={() => { onNavigate("settings"); afterChoose(); }}
        >
          <Settings size={18} />
          <span className="sidebar-nav-label">Cài đặt</span>
          <span className="sidebar-tooltip">Cài đặt</span>
        </button>
      </nav>

      <div className="sidebar-divider" />

      <div className={`sidebar-spaces${spaceMenuId ? " is-menu-open" : ""}`} data-onboarding="spaces">
        <div className="sidebar-spaces-head">
          <span>Không gian</span>
          <Button variant="primary" className="sidebar-add" title="Tạo không gian" aria-label="Tạo không gian" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
          </Button>
        </div>
        <ul className="sidebar-space-list">
          {subjects.map((subject) => {
            const active = subject.id === selectedSubjectId && (activeView === "map" || activeView === "documents" || activeView === "connections");
            const menuOpenForSpace = spaceMenuId === subject.id;
            return (
              <li key={subject.id} className={`sidebar-space-row${menuOpenForSpace ? " is-menu-open" : ""}`} data-space-row={subject.id}>
                <button
                  type="button"
                  className={`sidebar-space ${active ? "is-active" : ""}`}
                  title={subject.name}
                  aria-label={subject.name}
                  onClick={() => { setSpaceMenuId(null); onSelectSpace(subject.id); afterChoose(); }}
                >
                  <span className="sidebar-space-dot" style={{ backgroundColor: subject.color }} />
                  <span className="sidebar-space-name">{subject.name}</span>
                  <span className="sidebar-tooltip">{subject.name}</span>
                </button>
                <Button
                  variant="icon"
                  className="sidebar-space-more"
                  aria-label={`Tùy chọn ${subject.name}`}
                  aria-expanded={menuOpenForSpace}
                  title="Tùy chọn không gian"
                  onClick={(event) => {
                    event.stopPropagation();
                    openSpaceMenu(subject.id, event.currentTarget);
                  }}
                >
                  <MoreHorizontal size={14} />
                </Button>
                {menuOpenForSpace ? (
                  <div className={`sidebar-space-menu${spaceMenuUp ? " is-up" : ""}`} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSpaceMenuId(null);
                        setRenameError("");
                        setRenameValue(subject.name);
                        setRenameTarget(subject);
                      }}
                    >
                      Đổi tên
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="is-danger"
                      onClick={() => {
                        setSpaceMenuId(null);
                        setDeleteError("");
                        setPendingDelete(subject);
                      }}
                    >
                      Xóa không gian
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidebar-user">
        <span className="sidebar-avatar" aria-hidden="true">{initials}</span>
        <span className="sidebar-user-name">{userLabel}</span>
        <div className="sidebar-user-menu">
          <Button variant="icon" className="sidebar-more" aria-label="Tài khoản" onClick={() => setMenuOpen((openMenu) => !openMenu)}>
            <MoreHorizontal size={16} />
          </Button>
          {menuOpen ? (
            <div className="sidebar-popover">
              <button type="button" onClick={() => { setMenuOpen(false); onNavigate("settings"); afterChoose(); }}>Cài đặt</button>
              <Button variant="ghost" size="sm" type="button" onClick={() => { setMenuOpen(false); onLogout(); }}>Đăng xuất</Button>
            </div>
          ) : null}
        </div>
      </div>

      {showCreate ? (
        <CreateSubjectModal
          onClose={() => setShowCreate(false)}
          onCreate={async (payload) => {
            await onCreateSubject(payload);
            setShowCreate(false);
          }}
        />
      ) : null}

      {renameTarget
        ? createPortal(
            <div className="nm-modal-overlay" onClick={() => !renameBusy && setRenameTarget(null)}>
              <section className="nm-modal nm-modal-sm" onClick={(event) => event.stopPropagation()}>
                <header className="nm-modal-head">
                  <div>
                    <h2>Đổi tên không gian</h2>
                    <p>Tên mới sẽ hiện trong danh sách Không gian.</p>
                  </div>
                  <Button variant="icon" onClick={() => setRenameTarget(null)} aria-label="Đóng" disabled={renameBusy}>
                    <X size={18} />
                  </Button>
                </header>
                <div className="nm-modal-body">
                  <label className="nm-field">
                    <span>Tên không gian</span>
                    <input
                      ref={renameRef}
                      className="nm-input"
                      value={renameValue}
                      onChange={(event) => {
                        setRenameValue(event.target.value);
                        if (renameError) setRenameError("");
                      }}
                    />
                    {renameError ? <p className="nm-modal-error">{renameError}</p> : null}
                  </label>
                </div>
                <footer className="nm-modal-foot">
                  <Button variant="secondary" disabled={renameBusy} onClick={() => setRenameTarget(null)}>Hủy</Button>
                  <Button
                    variant="primary"
                    disabled={renameBusy}
                    onClick={async () => {
                      const trimmed = renameValue.trim();
                      if (!trimmed) {
                        setRenameError("Tên không gian không được để trống.");
                        return;
                      }
                      setRenameBusy(true);
                      try {
                        await onRenameSubject(renameTarget.id, trimmed);
                        setRenameTarget(null);
                      } catch (caught) {
                        setRenameError(caught instanceof Error ? caught.message : "Không đổi tên được không gian.");
                      } finally {
                        setRenameBusy(false);
                      }
                    }}
                  >
                    {renameBusy ? "Đang lưu..." : "Lưu"}
                  </Button>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}

      {pendingDelete
        ? createPortal(
            <div className="nm-modal-overlay" onClick={() => !deleteBusy && setPendingDelete(null)}>
              <section className="nm-modal nm-modal-sm" onClick={(event) => event.stopPropagation()}>
                <header className="nm-modal-head">
                  <div>
                    <h2>Xóa không gian?</h2>
                    <p>Toàn bộ neuron, ghi chú, liên kết và tài liệu trong không gian này sẽ bị xóa. Hành động này không thể hoàn tác.</p>
                  </div>
                </header>
                {deleteError ? <p className="nm-modal-error" style={{ margin: "0 20px 8px" }}>{deleteError}</p> : null}
                <footer className="nm-modal-foot">
                  <Button variant="secondary" disabled={deleteBusy} onClick={() => setPendingDelete(null)}>Hủy</Button>
                  <Button
                    variant="danger"
                    disabled={deleteBusy}
                    onClick={async () => {
                      setDeleteBusy(true);
                      setDeleteError("");
                      try {
                        await onDeleteSubject(pendingDelete.id);
                        setPendingDelete(null);
                        if (layoutMode !== "desktop") onClose?.();
                      } catch (caught) {
                        setDeleteError(caught instanceof Error ? caught.message : "Không xóa được không gian.");
                      } finally {
                        setDeleteBusy(false);
                      }
                    }}
                  >
                    {deleteBusy ? "Đang xóa..." : "Xóa không gian"}
                  </Button>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}
