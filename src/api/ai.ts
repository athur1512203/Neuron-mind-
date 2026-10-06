import { apiRequest, ApiError } from "./client";

export async function chatWithAI(message: string, signal: AbortSignal): Promise<string> {
  const result = await apiRequest<{ answer: string }>("/ai/chat", {
    method: "POST", body: JSON.stringify({ message }), signal,
  });
  if (!result || typeof result.answer !== "string" || !result.answer.trim()) throw new Error("Invalid answer");
  return result.answer;
}

export function aiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Bạn chưa có quyền sử dụng AI. Vui lòng thử lại sau.";
    if (error.status === 429) return "Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ một chút rồi thử lại.";
  }
  return "Không thể kết nối với AI. Vui lòng thử lại sau.";
}
