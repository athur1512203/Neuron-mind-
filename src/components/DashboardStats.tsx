import { Layers, Link2, Network } from "lucide-react";
import type { Subject } from "../types";

type DashboardStatsProps = {
  subjects: Subject[];
};

export function DashboardStats({ subjects }: DashboardStatsProps) {
  const spaceCount = subjects.length;
  const neuronCount = subjects.reduce((sum, subject) => sum + subject.neuronCount, 0);
  const connectionCount = subjects.reduce((sum, subject) => sum + subject.connectionCount, 0);

  const items = [
    { label: "Không gian", value: spaceCount, icon: Layers, tone: "blue" },
    { label: "Neuron", value: neuronCount, icon: Network, tone: "beige" },
    { label: "Kết nối", value: connectionCount, icon: Link2, tone: "green" },
  ] as const;

  return (
    <section className="nm-stats" aria-label="Tổng quan">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.label} className={`nm-stat nm-stat-${item.tone}`}>
            <Icon className="nm-stat-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
            <div className="nm-stat-value">{item.value}</div>
            <div className="nm-stat-label">{item.label}</div>
          </article>
        );
      })}
    </section>
  );
}
