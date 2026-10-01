import { Button } from "./ui/Button";

type SettingsProps = {
  email?: string;
  onLogout: () => void;
};

export function Settings({ email, onLogout }: SettingsProps) {
  return (
    <main className="nm-settings">
      <h1>Cài đặt</h1>
      <section className="nm-settings-card">
        <p>Tài khoản: {email ?? "—"}</p>
        <Button variant="secondary" onClick={onLogout}>Đăng xuất</Button>
      </section>
    </main>
  );
}
