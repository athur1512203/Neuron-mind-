# NeuronMind trên Cloudflare Free

## Kiến trúc

```text
Cloudflare Pages (React/Vite)
          |
          v
Cloudflare Worker `neuromind-api` -- D1 `neuromind`
          |                         (users, spaces, neurons, notes,
          |                          connections, document metadata)
          v
R2 `neuromind-documents` (chỉ nội dung file)

Codex -- Bearer --> Worker `neuromind-mcp` -- cùng D1
```

`cloudflare-worker` thay thế Express/Prisma/PostgreSQL trong runtime mới. Thư mục `server` được giữ lại làm mã nguồn tham chiếu; không deploy thư mục này và không cần Railway hay PostgreSQL.

## 1. Tạo D1 và áp dụng schema

Chỉ thực hiện các lệnh dưới đây khi bạn sẵn sàng tạo tài nguyên Cloudflare:

```powershell
cd cloudflare-worker
npx wrangler login
npx wrangler d1 create neuromind
```

Chép `database_id` được trả về vào cả `cloudflare-worker/wrangler.jsonc` và `mcp-worker/wrangler.jsonc`. Sau đó áp dụng migration:

```powershell
npx wrangler d1 migrations apply neuromind --remote
```

Database bắt đầu trống. Không có migration từ PostgreSQL theo yêu cầu.

## 2. Tạo R2 cho tính năng Documents

Ứng dụng hiện có upload/download/xóa tài liệu, nên phải có object storage để không mất chức năng:

```powershell
npx wrangler r2 bucket create neuromind-documents
```

R2 có hạn mức miễn phí riêng nhưng cần bật R2 trong tài khoản Cloudflare; tùy tài khoản, Cloudflare có thể yêu cầu phương thức thanh toán. Nếu không bật R2, các API khác vẫn có code đầy đủ nhưng Worker sẽ thiếu binding và chức năng Documents không triển khai được. Không đặt bucket public.

## 3. Cấu hình và deploy API Worker

Sửa `FRONTEND_URL` trong `cloudflare-worker/wrangler.jsonc` thành origin Pages chính xác, không có dấu `/` cuối. Tạo secret JWT ngẫu nhiên tối thiểu 32 byte:

```powershell
cd cloudflare-worker
npx wrangler secret put JWT_SECRET
npx wrangler deploy
```

Các binding của API Worker:

- `DB`: D1 database `neuromind`.
- `DOCUMENTS`: R2 bucket `neuromind-documents`.
- `FRONTEND_URL`: origin Pages được phép qua CORS.

Secret duy nhất của API là `JWT_SECRET`. Mật khẩu được hash PBKDF2-HMAC-SHA-256 với salt riêng và 210.000 vòng; token đăng nhập là JWT HS256 hết hạn sau 7 ngày.

## 4. Kết nối Cloudflare Pages

Tạo Pages project từ repository với:

- Build command: `npm run build`
- Build output: `dist`
- Environment variable: `VITE_API_URL=https://neuromind-api.<subdomain>.workers.dev/api`

Không dùng URL Railway. Sau khi Pages có domain cuối cùng, cập nhật `FRONTEND_URL` và deploy lại API Worker.

## 5. Tạo tài khoản và lấy user ID cho MCP

Mở website, đăng ký tài khoản mới rồi lấy `id` từ response `GET /api/users/me` trong Network inspector. Có thể truy vấn D1 thủ công nếu cần:

```powershell
npx wrangler d1 execute neuromind --remote --command "SELECT id, email FROM users;"
```

Đặt ID đó vào `MCP_USER_ID` trong `mcp-worker/wrangler.jsonc`. Đây không phải mật khẩu; nó cố định phạm vi dữ liệu mà MCP được phép thao tác. MCP kiểm tra user, Space và neuron ownership trước mọi thao tác.

## 6. Deploy MCP Worker và kết nối Codex

Tạo bearer token ngẫu nhiên tối thiểu 32 byte và lưu dưới dạng secret:

```powershell
cd mcp-worker
npx wrangler secret put MCP_BEARER_TOKEN
npx wrangler deploy
```

Không còn secrets `NEURONMIND_API_URL`, `NEURONMIND_EMAIL` hoặc `NEURONMIND_PASSWORD`.

Trên máy chạy Codex:

```powershell
$env:NEUROMIND_MCP_TOKEN = "your-token"
```

Thêm vào `~/.codex/config.toml`:

```toml
[mcp_servers.neuromind]
url = "https://neuromind-mcp.<subdomain>.workers.dev/mcp"
bearer_token_env_var = "NEUROMIND_MCP_TOKEN"
```

Khởi động lại Codex rồi gọi `neuromind.list_spaces`.

## API đã chuyển

- `GET /api/health`
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `GET /api/users/me`
- `GET|POST /api/subjects`
- `GET|PATCH|DELETE /api/subjects/:id`
- `GET /api/subjects/:id/graph`
- `GET|POST /api/subjects/:id/neurons`
- `GET|PATCH|DELETE /api/neurons/:id`
- `GET|PUT /api/neurons/:id/note`
- `GET|POST /api/subjects/:id/connections`
- `DELETE /api/connections/:id`
- `GET|POST /api/subjects/:id/documents`
- `GET /api/documents/:id/download`
- `DELETE /api/documents/:id`
- `GET /api/search`
- `POST /api/search/debug` (công cụ chẩn đoán Search Core hiện có)

Endpoint debug giới hạn tối đa 20 truy vấn con/request và 50 kết quả/truy vấn để nằm dưới giới hạn subrequest của Workers Free.

## D1 schema

Migration `cloudflare-worker/migrations/0001_initial.sql` tạo `users`, `spaces`, `neurons`, `notes`, `neuron_connections`, `neuron_images`, `neuron_audio` và `documents`, cùng foreign keys, unique constraints và indexes cho ownership/list/graph. UUID được tạo bằng `crypto.randomUUID()` và lưu dạng `TEXT`; thời gian là ISO-8601 `TEXT`; JSON rich text là `TEXT` và được giữ nguyên byte-for-byte.

## Hạn mức và chi phí

Tại ngày 12/10/2026, tài liệu Cloudflare công bố các ngưỡng Free liên quan trực tiếp:

- Workers: 100.000 request/ngày, 10 ms CPU/request, 128 MB RAM và 50 subrequest/request.
- D1: 5 triệu row read/ngày, 100.000 row write/ngày, tối đa 500 MB cho một database Free và 5 GB tổng tài khoản. Khi vượt ngưỡng ngày, query bị từ chối đến 00:00 UTC.
- Pages: 500 build/tháng, 20.000 file/site và 25 MiB cho mỗi static asset.
- R2 Standard: 10 GB-month storage, 1 triệu Class A và 10 triệu Class B operation/tháng miễn phí; vượt mức sẽ tính phí. Egress Internet hiện được ghi là miễn phí.

Thiết kế dùng Workers Free, Pages Free và D1 Free, nhưng không thể đảm bảo chi phí luôn bằng 0. Documents là phần dễ phát sinh dung lượng nhất; giới hạn ứng dụng là 50 MB/file và upload được stream sang R2 thay vì buffer trong RAM. PBKDF2 khi đăng nhập/đăng ký là đường xử lý có CPU cao nhất và cần quan sát Workers CPU Metrics sau triển khai. Theo dõi Usage trong Cloudflare Dashboard và đặt cảnh báo. Nếu R2 không được bật miễn phí trên tài khoản, phương án miễn phí an toàn là tạm không deploy chức năng Documents, không thay bằng dịch vụ trả phí tự động.

Nguồn: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Phạm vi kiểm chứng

Theo yêu cầu của nhiệm vụ, không chạy `npm install`, build, test, lint, typecheck, deploy hoặc migration. Mã chỉ được rà soát tĩnh; cần chạy các bước kiểm chứng trong môi trường Cloudflare trước khi chuyển traffic production.
