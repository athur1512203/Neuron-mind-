import { useState } from "react";
import { apiMessage } from "../api/client";
import { login, register } from "../api/auth";
import type { ApiUser } from "../api/mappers";

type AuthScreenProps = {
  onAuthenticated: (user: ApiUser) => void;
};

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email và mật khẩu không được để trống.");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const user = mode === "login" ? await login(trimmedEmail, password) : await register(trimmedEmail, password);
      onAuthenticated(user);
    } catch (caught) {
      setError(apiMessage(caught, "Không đăng nhập được. Thử lại."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="dashboard-main flex min-h-screen flex-1 items-center justify-center px-4">
      <section className="w-full max-w-md rounded-xl border border-[#1f2a26] bg-[#0b1210] p-6 text-white shadow-2xl">
        <h1 className="font-fancy text-3xl text-white">NeuroMind</h1>
        <p className="mt-2 text-sm text-[#8b9a93]">{mode === "login" ? "Đăng nhập để mở bộ não của bạn." : "Tạo tài khoản mới."}</p>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-[#2a3a34] bg-[#07110e] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            autoComplete="email"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">Mật khẩu</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-[#2a3a34] bg-[#07110e] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <button type="button" onClick={handleSubmit} disabled={busy} className="action-3d-button dashboard-add-button mt-6 w-full">
          <span className="btn-shadow" />
          <span className="btn-edge" />
          <span className="btn-front">{busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký"}</span>
        </button>

        <button
          type="button"
          className="mt-4 w-full text-sm text-[#8b9a93] hover:text-white"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
        </button>
      </section>
    </main>
  );
}
