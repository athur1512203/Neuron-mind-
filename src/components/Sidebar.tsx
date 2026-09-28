import { Brain, Home, Search, Settings, Share2 } from "lucide-react";
import type { ViewName } from "../types";

type SidebarProps = {
  activeView: ViewName;
  onNavigate: (view: ViewName) => void;
  onSearch: () => void;
};

const items: Array<{ id: ViewName; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "map", label: "Sơ đồ", icon: Share2 },
  { id: "settings", label: "Cài đặt", icon: Settings },
];

export function Sidebar({ activeView, onNavigate, onSearch }: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand-icon" role="img" aria-label="NeuroMind">
        <Brain size={22} aria-hidden="true" />
      </div>

      <nav className="sidebar-navigation" aria-label="Điều hướng chính">
        <button
          type="button"
          aria-label="Tìm kiếm"
          onClick={onSearch}
          className="sidebar-nav-item"
        >
          <Search size={22} aria-hidden="true" />
          <span className="sidebar-tooltip" aria-hidden="true">Tìm kiếm</span>
        </button>
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-nav-item ${active ? "is-active" : ""}`}
            >
              <Icon size={22} aria-hidden="true" />
              <span className="sidebar-tooltip" aria-hidden="true">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-divider" aria-hidden="true" />
    </aside>
  );
}
