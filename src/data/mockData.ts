import type { Neuron, NeuronConnection, Subject } from "../types";

const now = new Date("2026-09-23T09:00:00.000Z").toISOString();

export const subjects: Subject[] = [
  { id: "microeconomics", name: "Kinh tế vi mô", color: "#22c55e", neuronCount: 35, connectionCount: 72 },
  { id: "english", name: "English", color: "#3b82f6", neuronCount: 42, connectionCount: 86 },
  { id: "javascript", name: "JavaScript", color: "#a855f7", neuronCount: 28, connectionCount: 51 },
  { id: "research", name: "Nghiên cứu khoa học", color: "#f59e0b", neuronCount: 18, connectionCount: 25 },
];

const neuronSeed: Array<[string, string, string, [number, number, number]]> = [
  ["price", "Giá", "#3b82f6", [0, 0.4, 0]],
  ["supply", "Cung", "#22c55e", [-2.8, 1.1, -1.4]],
  ["demand", "Cầu", "#f59e0b", [2.7, 0.8, 1.6]],
  ["equilibrium", "Cân bằng thị trường", "#a855f7", [0.6, 2.9, -2.2]],
  ["elasticity", "Độ co giãn", "#ef4444", [3.4, -1.3, -1.1]],
  ["tax", "Thuế", "#f97316", [-3.1, -1.7, 1.8]],
  ["production-cost", "Chi phí sản xuất", "#14b8a6", [-4.6, 0.4, -3.2]],
  ["revenue", "Doanh thu", "#8b5cf6", [2.2, -3.1, 2.8]],
  ["profit", "Lợi nhuận", "#06b6d4", [-0.6, -3.6, -2.9]],
  ["income", "Thu nhập", "#84cc16", [4.8, 2.1, -0.4]],
  ["substitutes", "Hàng hóa thay thế", "#eab308", [5.2, -0.6, 3.7]],
  ["complements", "Hàng hóa bổ sung", "#ec4899", [1.1, 4.7, 2.5]],
  ["opportunity-cost", "Chi phí cơ hội", "#64748b", [-5.1, 3.2, 0.8]],
  ["perfect-competition", "Cạnh tranh hoàn hảo", "#38bdf8", [-1.8, 5.0, -3.7]],
  ["monopoly", "Độc quyền", "#dc2626", [3.6, 3.9, -4.4]],
  ["taste", "Thị hiếu", "#c084fc", [5.6, 1.1, 4.8]],
];

export const initialNeurons: Neuron[] = neuronSeed.map(([id, name, color, [x, y, z]]) => ({
  id,
  subjectId: "microeconomics",
  name,
  color,
  position: { x, y, z },
  textContent: `${name} là một khái niệm nền tảng trong Kinh tế vi mô, dùng để mô tả cách cá nhân và thị trường ra quyết định.`,
  images: [],
  audio: [],
  keyPoints: `Tập trung vào định nghĩa, yếu tố tác động, và cách ${name.toLowerCase()} thay đổi khi bối cảnh thị trường thay đổi.`,
  memoryMethod: `Tự đặt một ví dụ đời thường rồi giải thích lại ${name.toLowerCase()} bằng lời của mình.`,
  application: `Dùng ${name.toLowerCase()} để phân tích một tình huống mua bán hoặc quyết định kinh tế cụ thể.`,
  createdAt: now,
  updatedAt: now,
}));

const connectionSeed: Array<[string, string, string, string]> = [
  ["supply-price", "supply", "price", "Cung thay đổi làm dịch chuyển lượng hàng trên thị trường và tạo áp lực lên mức giá."],
  ["demand-price", "demand", "price", "Cầu phản ánh mức sẵn sàng mua, nên khi cầu thay đổi thì giá có xu hướng phản ứng."],
  ["supply-equilibrium", "supply", "equilibrium", "Cung là một phía của điểm cân bằng nơi lượng mua và lượng bán gặp nhau."],
  ["demand-equilibrium", "demand", "equilibrium", "Cầu là phía còn lại xác định trạng thái cân bằng thị trường."],
  ["price-equilibrium", "price", "equilibrium", "Giá cân bằng xuất hiện khi thị trường không còn áp lực dư cung hoặc dư cầu."],
  ["price-elasticity", "price", "elasticity", "Độ co giãn đo phản ứng của lượng cầu hoặc cung khi giá thay đổi."],
  ["demand-elasticity", "demand", "elasticity", "Độ co giãn của cầu cho biết người mua nhạy với biến động giá đến mức nào."],
  ["tax-price", "tax", "price", "Thuế có thể làm thay đổi chi phí và ảnh hưởng đến mức giá trên thị trường."],
  ["tax-supply", "tax", "supply", "Thuế làm tăng chi phí người bán chịu, thường khiến đường cung dịch chuyển."],
  ["tax-elasticity", "tax", "elasticity", "Gánh nặng thuế phụ thuộc vào bên nào kém co giãn hơn."],
  ["production-cost-supply", "production-cost", "supply", "Chi phí sản xuất quyết định khả năng và mức sẵn sàng cung ứng của doanh nghiệp."],
  ["revenue-price", "revenue", "price", "Doanh thu thay đổi theo giá bán và lượng hàng bán được."],
  ["revenue-elasticity", "revenue", "elasticity", "Độ co giãn giúp dự đoán doanh thu tăng hay giảm khi giá thay đổi."],
  ["revenue-profit", "revenue", "profit", "Lợi nhuận phụ thuộc vào doanh thu sau khi trừ các chi phí."],
  ["production-cost-profit", "production-cost", "profit", "Chi phí sản xuất tăng sẽ làm giảm lợi nhuận nếu doanh thu không đổi."],
  ["income-demand", "income", "demand", "Thu nhập ảnh hưởng đến khả năng và xu hướng mua hàng của người tiêu dùng."],
  ["substitutes-demand", "substitutes", "demand", "Hàng hóa thay thế làm cầu của một sản phẩm thay đổi khi giá sản phẩm liên quan thay đổi."],
  ["complements-demand", "complements", "demand", "Hàng hóa bổ sung thường được dùng cùng nhau nên cầu của chúng có quan hệ liên kết."],
  ["perfect-competition-price", "perfect-competition", "price", "Trong cạnh tranh hoàn hảo, doanh nghiệp thường là người chấp nhận giá thị trường."],
  ["monopoly-price", "monopoly", "price", "Độc quyền có quyền lực thị trường lớn hơn nên có thể ảnh hưởng đến giá."],
];

export const initialConnections: NeuronConnection[] = connectionSeed.map(
  ([id, sourceNeuronId, targetNeuronId, explanation]) => ({
    id,
    subjectId: "microeconomics",
    sourceNeuronId,
    targetNeuronId,
    explanation,
    createdAt: now,
    updatedAt: now,
  }),
);
