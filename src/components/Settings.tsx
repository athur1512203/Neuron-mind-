type SettingsProps = {
  email?: string;
  onLogout: () => void;
};

export function Settings({ email, onLogout }: SettingsProps) {
  return (
    <main className="flex-1 bg-slate-50 px-8 py-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold text-slate-950">Cài đặt</h1>
        <div className="app-card mt-6 space-y-3 p-5 text-sm leading-6 text-slate-300">
          <p>Tài khoản: {email ?? "—"}</p>
          <button type="button" onClick={onLogout} className="action-3d-button secondary">
            <span className="btn-shadow" />
            <span className="btn-edge" />
            <span className="btn-front">Đăng xuất</span>
          </button>
        </div>
      </div>
    </main>
  );
}
