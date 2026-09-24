# NeuroMind API

REST API độc lập cho NeuroMind, dùng Express, TypeScript, Prisma, PostgreSQL và JWT.

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
- `GET|POST /api/subjects/:subjectId/connections`
- `DELETE /api/connections/:id`

Các endpoint ngoài health/register/login yêu cầu `Authorization: Bearer <token>`.

## Railway

1. Tạo PostgreSQL service và backend service trỏ root directory tới `server`.
2. Khai báo `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`.
3. Railway chạy `npm run build`, sau đó `npm run prisma:deploy && npm start` theo `railway.json`.
4. Health check dùng `/api/health`.

Không cần PostgreSQL local để build. Migration production dùng `prisma migrate deploy`.
