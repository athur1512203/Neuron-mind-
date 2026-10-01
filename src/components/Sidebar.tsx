import { Brain, MoreHorizontal, Plus, Search, Settings, Share2 } from "lucide-react";
import { useState } from "react";
import type { Subject, ViewName } from "../types";
import { CreateSubjectModal } from "./CreateSubjectModal";
import { Button } from "./ui/Button";

type SidebarProps = {
  activeView: ViewName;
  subjects: Subject[];
  selectedSubjectId: string | null;
  userLabel: string;
  open?: boolean;
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
  open = true,
  onNavigate,
  onSearch,
  onSelectSpace,
  onCreateSubject,
  onLogout,
}: SidebarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = userLabel.trim().slice(0, 1).toUpperCase() || "N";

  return (
    <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon" aria-hidden="true">
          <Brain size={18} />
        </span>
        <span className="sidebar-brand-name">NeuroMind</span>
      </div>

      <nav className="sidebar-navigation" aria-label="Điều hướng chính">
        <button type="button" className="sidebar-nav-item" onClick={onSearch}>
          <Search size={18} />
          Search
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === "map" || activeView === "connections" ? "is-active" : ""}`}
          onClick={() => onNavigate("map")}
        >
          <Share2 size={18} />
          Sơ đồ
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === "settings" ? "is-active" : ""}`}
          onClick={() => onNavigate("settings")}
        >
          <Settings size={18} />
          Cài đặt
        </button>
      </nav>

      <div className="sidebar-divider" />

      <div className="sidebar-spaces">
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
                  onClick={() => onSelectSpace(subject.id)}
                >
                  <span className="sidebar-space-dot" style={{ backgroundColor: subject.color }} />
                  <span className="sidebar-space-name">{subject.name}</span>
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
          <Button variant="icon" className="sidebar-more" aria-label="Tài khoản" onClick={() => setMenuOpen((openMenu) => !openMenu)}>
            <MoreHorizontal size={16} />
          </Button>
          {menuOpen ? (
            <div className="sidebar-popover">
              <button type="button" onClick={() => { setMenuOpen(false); onNavigate("settings"); }}>Cài đặt</button>
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
