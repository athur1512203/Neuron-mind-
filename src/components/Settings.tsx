import { Button } from "./ui/Button";

type SettingsProps = {
  email?: string;
  onLogout: () => void;
  onReplayOnboarding: () => void;
};

export function Settings({ email, onLogout, onReplayOnboarding }: SettingsProps) {
  return (
    <main className="nm-settings">
      <h1>Cài đặt</h1>
      <section className="nm-settings-card">
        <p>Tài khoản: {email ?? "—"}</p>
        <div className="nm-settings-actions">
          <Button variant="secondary" onClick={onReplayOnboarding}>Xem lại hướng dẫn</Button>
          <Button variant="secondary" onClick={onLogout}>Đăng xuất</Button>
        </div>
      </section>
    </main>
  );
}
