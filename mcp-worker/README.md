# NeuronMind Remote MCP trên Cloudflare D1

Worker cung cấp Streamable HTTP tại `/mcp`. Các tool truy cập trực tiếp cùng D1 với API Worker, không gọi Railway và không lưu email/mật khẩu.

## Tools giữ nguyên

- `list_spaces`
- `create_space`
- `list_neurons`
- `create_neuron`
- `get_neuron`
- `update_neuron`
- `search_neurons`
- `create_neuron_link`

Mỗi thao tác được giới hạn bởi `MCP_USER_ID`; Worker kiểm tra user tồn tại và xác minh ownership của Space/neuron trước khi đọc hoặc ghi. Endpoint `/mcp` yêu cầu `Authorization: Bearer ...` khớp secret `MCP_BEARER_TOKEN`.

Xem [hướng dẫn triển khai tổng thể](../CLOUDFLARE_DEPLOYMENT.md) để tạo D1, cấu hình binding, deploy và kết nối Codex.

## Kết nối Codex CLI

Endpoint hiện tại: `https://neuromind-mcp.annhoangg6.workers.dev/mcp`.

Token được cấp riêng trong biến môi trường người dùng `NEURONMIND_MCP_TOKEN`; không ghi giá trị vào repository hoặc `config.toml`. Mở terminal mới sau khi thiết lập biến môi trường để Codex kế thừa credential.

```powershell
codex mcp add neuromind --url https://neuromind-mcp.annhoangg6.workers.dev/mcp --bearer-token-env-var NEURONMIND_MCP_TOKEN
```

Để chỉ cho phép đọc, thêm vào bảng `[mcp_servers.neuromind]` trong cấu hình Codex cá nhân:

```toml
enabled_tools = ["list_spaces", "list_neurons", "get_neuron", "search_neurons"]
```

Worker vẫn công bố đủ 8 tools. Chỉ bật và thử các tools ghi sau khi chủ tài khoản xác nhận. Chọn `MCP_USER_ID` từ D1 bằng truy vấn chỉ đọc và xác nhận tài khoản trước khi deploy.
