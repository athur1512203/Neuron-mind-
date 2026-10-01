import { Brain, MoreHorizontal, PanelLeft, Plus, Search, Settings, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  onOpen?: () => void;
  onNavigate: (view: ViewName) => void;
  onSearch: () => void;
  onSelectSpace: (subjectId: string) => void;
  onCreateSubject: (payload: { name: string; color: string }) => Promise<void>;
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
  onOpen,
  onNavigate,
  onSearch,
  onSelectSpace,
  onCreateSubject,
  onLogout,
}: SidebarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const initials = userLabel.trim().slice(0, 1).toUpperCase() || "N";
  const overlayOpen = layoutMode !== "desktop" && open;
  const rail = layoutMode === "tablet";

  useEffect(() => {
    if (!overlayOpen) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (layoutMode === "mobile") document.body.style.overflow = "hidden";
    const closeButton = asideRef.current?.querySelector<HTMLButtonElement>("[data-sidebar-close]");
    closeButton?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || layoutMode !== "mobile") return;
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
  }, [overlayOpen, layoutMode, onClose]);

  const afterChoose = () => {
    if (layoutMode !== "desktop") onClose?.();
  };

  return (
    <aside
      ref={asideRef}
      className={`app-sidebar${open ? " is-open" : ""}${rail ? " is-rail" : ""}`}
      role={layoutMode === "mobile" && open ? "dialog" : undefined}
      aria-modal={layoutMode === "mobile" && open ? true : undefined}
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
          className={`sidebar-nav-item ${activeView === "settings" ? "is-active" : ""}`}
          onClick={() => { onNavigate("settings"); afterChoose(); }}
        >
          <Settings size={18} />
          <span className="sidebar-nav-label">Cài đặt</span>
          <span className="sidebar-tooltip">Cài đặt</span>
        </button>
      </nav>

      <div className="sidebar-divider" />

      <div className="sidebar-spaces" data-onboarding="spaces">
        <div className="sidebar-spaces-head">
          <span>Không gian</span>
          <Button variant="icon" className="sidebar-add" aria-label="Tạo không gian" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
          </Button>
        </div>
        <ul className="sidebar-space-list">
          {subjects.map((subject) => {
            const active = subject.id === selectedSubjectId && (activeView === "map" || activeView === "connections");
            return (
              <li key={subject.id}>
                <button
                  type="button"
                  className={`sidebar-space ${active ? "is-active" : ""}`}
                  title={subject.name}
                  aria-label={subject.name}
                  onClick={() => { onSelectSpace(subject.id); afterChoose(); }}
                >
                  <span className="sidebar-space-dot" style={{ backgroundColor: subject.color }} />
                  <span className="sidebar-space-name">{subject.name}</span>
                  <span className="sidebar-tooltip">{subject.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidebar-user">
        <span className="sidebar-avatar" aria-hidden="true">{initials}</span>
        <span className="sidebar-user-name">{userLabel}</span>
        <div className="sidebar-user-menu">
          {layoutMode === "tablet" && !open ? (
            <Button variant="icon" className="sidebar-expand" aria-label="Mở rộng menu" onClick={onOpen}>
              <PanelLeft size={16} />
            </Button>
          ) : (
            <Button variant="icon" className="sidebar-more" aria-label="Tài khoản" onClick={() => setMenuOpen((openMenu) => !openMenu)}>
              <MoreHorizontal size={16} />
            </Button>
          )}
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
    </aside>
  );
}
