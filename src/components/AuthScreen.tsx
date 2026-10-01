import { Brain } from "lucide-react";
import { useState } from "react";
import { apiMessage } from "../api/client";
import { login, register } from "../api/auth";
import type { ApiUser } from "../api/mappers";
import { Button } from "./ui/Button";

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

  const isLogin = mode === "login";

  return (
    <main className="nm-auth-page">
      <section className="nm-auth-card" aria-labelledby="nm-auth-title">
        <header className="nm-auth-brand">
          <span className="nm-auth-logo" aria-hidden="true">
            <Brain size={22} />
          </span>
          <div>
            <p className="nm-auth-product">NeuroMind</p>
            <p className="nm-auth-tagline">Siêu trợ lý AI hỗ trợ các tác vụ của bạn.</p>
          </div>
        </header>

        <h1 id="nm-auth-title" className="nm-auth-title">{isLogin ? "Chào mừng trở lại" : "Tạo tài khoản"}</h1>
        <p className="nm-auth-subtitle">
          {isLogin ? "Đăng nhập để tiếp tục với NeuroMind." : "Bắt đầu xây dựng bộ não thứ hai của bạn."}
        </p>

        <form
          className="nm-auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void handleSubmit();
          }}
        >
          <label className="nm-auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={busy}
            />
          </label>

          <label className="nm-auth-field">
            <span>Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
              disabled={busy}
            />
          </label>

          {error ? <p className="nm-auth-error" role="alert">{error}</p> : null}

          <Button type="submit" variant="primary" size="lg" disabled={busy} className="nm-auth-submit">
            {busy ? "Đang xử lý..." : isLogin ? "Đăng nhập" : "Tạo tài khoản"}
          </Button>
        </form>

        <p className="nm-auth-switch">
          {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              setMode(isLogin ? "register" : "login");
              setError("");
            }}
          >
            {isLogin ? "Đăng ký" : "Đăng nhập"}
          </Button>
        </p>
      </section>
    </main>
  );
}
