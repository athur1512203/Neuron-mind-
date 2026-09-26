import { Brain, LayoutDashboard, Link2, Settings, Share2 } from "lucide-react";
import type { ViewName } from "../types";

type SidebarProps = {
  activeView: ViewName;
  onNavigate: (view: ViewName) => void;
};

const items: Array<{ id: ViewName; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "map", label: "Sơ đồ học", icon: Share2 },
  { id: "connections", label: "Liên kết neuron", icon: Link2 },
  { id: "settings", label: "Cài đặt", icon: Settings },
];

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <aside className="app-sidebar flex w-full shrink-0 flex-col border-b px-4 py-4 md:h-screen md:w-64 md:border-b-0 md:border-r md:py-5">
      <div className="mb-3 flex items-center gap-3 px-2 md:mb-8">
        <div className="sidebar-brand-icon grid h-10 w-10 place-items-center rounded-lg text-white">
          <Brain size={21} />
        </div>
        <div>
          <div className="font-fancy text-2xl leading-none text-white">NeuroMind</div>
          <div className="text-xs font-medium text-white/55">Build Your Second Brain</div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto md:block md:space-y-1 md:overflow-visible">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-nav-item flex min-w-fit flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition md:w-full md:justify-start md:gap-3 ${active ? "is-active" : ""}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
