# NeuronMind Remote MCP

Cloudflare Worker stateless cung cấp endpoint Streamable HTTP tại `/mcp`. Worker không có database riêng: mọi tool gọi REST API NeuronMind hiện có, vì vậy website và MCP dùng chung PostgreSQL/Prisma và cùng cơ chế kiểm tra quyền sở hữu.

## Kiến trúc

```text
Codex --Bearer token--> Cloudflare Worker /mcp
                              |
                              | JWT của tài khoản cá nhân
                              v
                    NeuronMind REST API /api
                              |
                              v
                      PostgreSQL (Prisma)
```

Worker đăng nhập bằng tài khoản NeuronMind lưu trong Cloudflare Secrets, cache JWT trong isolate và tự đăng nhập lại một lần khi backend trả `401`. Token MCP và mật khẩu không được ghi log hoặc trả về tool result. Backend tiếp tục xác minh ownership cho mọi Space, neuron, note và connection.

## Tool

- `list_spaces`
- `create_space`
- `list_neurons`
- `create_neuron`
- `get_neuron`
- `update_neuron`
- `search_neurons`
- `create_neuron_link`

Không có tool xóa hoặc xóa hàng loạt trong phiên bản này.

## Triển khai thủ công

Yêu cầu backend NeuronMind đã được deploy qua HTTPS và `NEURONMIND_API_URL` trỏ tới base URL có `/api`, ví dụ `https://api.example.com/api`.

1. Vào thư mục `mcp-worker` và cài dependency khi bạn sẵn sàng triển khai:

   ```powershell
   npm install
   ```

2. Đăng nhập Cloudflare và tạo một bearer token ngẫu nhiên tối thiểu 32 byte. Không lưu token thật vào repository. Ví dụ PowerShell tạo 48 byte:

   ```powershell
   $bytes = New-Object byte[] 48
   [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
   [Convert]::ToBase64String($bytes)
   ```

3. Lưu toàn bộ giá trị nhạy cảm dưới dạng Cloudflare Secrets:

   ```powershell
   npx wrangler secret put MCP_BEARER_TOKEN
   npx wrangler secret put NEURONMIND_API_URL
   npx wrangler secret put NEURONMIND_EMAIL
   npx wrangler secret put NEURONMIND_PASSWORD
   ```

4. Deploy khi đã sẵn sàng:

   ```powershell
   npx wrangler deploy
   ```

Endpoint sẽ có dạng `https://neuromind-mcp.<account>.workers.dev/mcp`. `/health` chỉ trả trạng thái dịch vụ và không truy cập dữ liệu.

## Cấu hình Codex

Đặt token vào biến môi trường trên máy chạy Codex, không ghi token thật vào TOML:

```powershell
$env:NEUROMIND_MCP_TOKEN = "paste-token-locally"
```

Thêm vào `~/.codex/config.toml`:

```toml
[mcp_servers.neuromind]
url = "https://neuromind-mcp.<account>.workers.dev/mcp"
bearer_token_env_var = "NEUROMIND_MCP_TOKEN"
```

Khởi động lại Codex rồi kiểm tra bằng `codex mcp list`. Theo tài liệu OpenAI, Codex CLI và IDE dùng chung cấu hình MCP; `bearer_token_env_var` đọc token từ môi trường thay vì lưu secret trong file.

Ví dụ yêu cầu:

```text
Dùng NeuronMind để tạo Space “Distributed Systems”, sau đó tạo neuron “Consensus” màu #3B82F6 với ghi chú giới thiệu ngắn.
```

```text
Liệt kê các Space trong NeuronMind, tìm Space “Distributed Systems”, rồi tạo neuron “Raft” và liên kết nó với neuron “Consensus”.
```

## Dữ liệu và migration

Không cần migration sang D1/KV/R2. Ứng dụng hiện tại đọc/ghi dữ liệu người dùng qua PostgreSQL và backend Prisma; `localStorage` đang hoạt động chỉ giữ JWT và tùy chọn UI. Repository vẫn còn module `src/utils/storage.ts` dành cho graph mock/local đời cũ nhưng không được `App` import. Worker gọi đúng API hiện hữu, nên không sao chép, xóa hoặc ghi đè dữ liệu cũ. Nội dung note được chuyển nguyên văn, bao gồm payload `neuromind-rich-text` JSON.

Nếu trước đây có một bản NeuronMind chạy hoàn toàn bằng dữ liệu mock/local khác repository hiện tại, hãy xuất và nhập dữ liệu đó qua backend trước khi bật MCP; không trộn hai nguồn dữ liệu tự động.

## Tài liệu tham khảo

- Cloudflare: https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/
- OpenAI Codex MCP: https://developers.openai.com/learn/docs-mcp
- OpenAI MCP server guidance: https://developers.openai.com/plugins/build/mcp-server
