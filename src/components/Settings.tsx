export function Settings() {
  return (
    <main className="flex-1 bg-slate-50 px-8 py-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold text-slate-950">Cài đặt</h1>
        <div className="app-card mt-6 p-5 text-sm leading-6 text-slate-300">
          Prototype này đang dùng mock data và local state. Các tùy chọn đồng bộ, tài khoản, lưu trữ và phân quyền sẽ thuộc giai đoạn backend tiếp theo.
        </div>
      </div>
    </main>
  );
}
