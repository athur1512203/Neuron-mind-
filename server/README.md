# NeuroMind API

REST API độc lập cho NeuroMind, dùng Express, TypeScript, Prisma, PostgreSQL và JWT.

Knowledge foundation (MVP): xem [architecture, contract và validation](KNOWLEDGE_ARCHITECTURE.md).

## Cài đặt

```bash
cd server
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Trên PowerShell, có thể dùng `Copy-Item .env.example .env` thay cho `cp`.

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: chuỗi bí mật dài, ngẫu nhiên để ký JWT.
- `PORT`: cổng HTTP, Railway tự cung cấp khi deploy.
- `FRONTEND_URL`: origin frontend production, không có dấu `/` cuối.
- `NODE_ENV`: `development` hoặc `production`.
- `AI_PROVIDER`: `local` (mặc định, Neuro Chat V0), `mock` (test), hoặc `openai` (chưa bật; vẫn dùng local).
- `AI_MODEL`: dành cho OpenAI sau này; không bắt buộc.
- `AUTH_RATE_LIMIT_MAX`: số lần đăng nhập tối đa mỗi IP trong một cửa sổ (mặc định 20).
- `AUTH_RATE_LIMIT_WINDOW_MS`: cửa sổ rate limit đăng nhập, mili giây (mặc định 900000 = 15 phút).

## Scripts

```bash
npm run dev
npm run build
npm start
npm run prisma:generate
npm run prisma:migrate -- --name <migration-name>
npm run prisma:deploy
```

## API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`
- `GET|POST /api/subjects`
- `GET|PATCH|DELETE /api/subjects/:id`
- `GET /api/subjects/:subjectId/graph`
- `GET|POST /api/subjects/:subjectId/neurons`
- `GET|PATCH|DELETE /api/neurons/:id`
- `GET|POST /api/neurons/:neuronId/documents`
- `GET /api/documents/:documentId/download`
- `DELETE /api/documents/:documentId`
- `GET|POST /api/subjects/:subjectId/connections`
- `DELETE /api/connections/:id`

Các endpoint ngoài health/register/login yêu cầu `Authorization: Bearer <token>`.

## Railway

1. Tạo PostgreSQL service và backend service trỏ root directory tới `server`.
2. Khai báo `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`.
3. Railway chạy `npm run build`, sau đó `npm run prisma:deploy && npm start` theo `railway.json`.
4. Health check dùng `/api/health`.

Không cần PostgreSQL local để build. Migration production dùng `prisma migrate deploy`.

## Document storage

Document routes keep their existing URLs and response metadata. Controllers handle HTTP;
`documentService` handles ownership, validation, keys, checksums and database operations;
`StorageProvider` handles binary objects. PostgreSQL stores metadata only.

### Providers

- `STORAGE_PROVIDER=local` (default): files under `server/uploads/documents/`, resolved
  relative to the server module, independent of the shell working directory. Keep this
  directory private to the backend process; do not place symlinks or untrusted files in it.
- `STORAGE_PROVIDER=r2`: private Cloudflare R2 bucket via AWS SDK v3, region `auto`.
  Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
  Optional `R2_ENDPOINT` overrides the account endpoint (for example a jurisdiction endpoint).
  Invalid provider or missing R2 configuration fails before the server starts listening.
- The interface provides `upload`, `getStream`, `delete`, `exists`, and optional
  `getSignedUrl`. Signed URLs are not exposed by the Document API.

Create a private bucket and a bucket-scoped Object Read & Write API token in Cloudflare.
Put credentials in the server environment, never frontend code or Git. No public domain,
CDN or browser-to-R2 CORS configuration is needed: downloads stream through authenticated
backend routes. See https://developers.cloudflare.com/r2/get-started/s3/.

### Migration and existing files

Back up PostgreSQL and uploads, then run `npm run prisma:deploy` before starting the new
backend. Migration `20260928020000_document_storage_abstraction` adds `storageProvider`,
`storageKey`, and nullable SHA-256 `checksum`. Existing rows are marked `local`; keys are
backfilled from the basename of the old path, matching the previous local resolver.
No files or metadata are deleted. Legacy `storagePath` is retained for compatibility;
new code uses `storageProvider` + `storageKey` as the source of truth.

New keys use `users/{userId}/workspaces/{subjectId}/documents/{uuid}.{extension}`.
Changing the default provider affects new uploads only. Keep the existing local volume
mounted when using R2 if old documents are still local. This change does not copy old
files to R2 or compute checksums for existing files. Rolling back to the old backend
after new nested-key uploads is not supported without a separate data migration.

### Failure handling and validation

Storage upload finishes before metadata creation. If DB creation fails, the service tries
to delete the uploaded object and preserves the original error; cleanup failures log the
provider/key for manual reconciliation. A process crash between these operations can
still leave an orphan; there is no distributed transaction or background cleanup queue.

Delete removes the object before the DB row. A storage failure retains metadata for retry.
A missing object is treated as already deleted; if DB deletion fails, retry can finish it.
Download/delete check JWT and ownership before accessing storage. Internal keys, paths,
provider configuration and signed URLs are omitted from API metadata.

Uploads retain the 50MB MIME/extension allowlist, sanitize filenames, reject empty or
malformed buffers, and check basic PDF/Office container signatures and binary text content.
These checks are not antivirus scanning or full Office/PDF parsing. Files are downloaded
as attachments with `nosniff`, not executed or rendered by the backend.

### Tests

Run `npm test` in `server` (build + Node test runner). Tests use temporary local storage,
real Express HTTP routes, mocked Prisma delegates and a mocked R2 SDK client. They do not
connect to PostgreSQL or a real R2 bucket. Run an additional live smoke test after setting
credentials and deploying the migration: upload, download and delete in both providers,
including an existing local document after switching the default to R2.
