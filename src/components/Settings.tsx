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
        <button type="button" onClick={onLogout} className="nm-btn nm-btn-secondary">Đăng xuất</button>
      </section>
    </main>
  );
}
