import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { connectionRouter } from "./routes/connection.routes";
import { aiRouter } from "./routes/ai.routes";
import { authRouter } from "./routes/auth.routes";
import { documentRouter } from "./routes/document.routes";
import { neuronRouter } from "./routes/neuron.routes";
import { searchRouter } from "./routes/search.routes";
import { subjectRouter } from "./routes/subject.routes";
import { userRouter } from "./routes/user.routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { AppError } from "./utils/app-error";

export const app = express();

const developmentOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed =
        process.env.NODE_ENV === "production"
          ? Boolean(process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
          : developmentOrigins.has(origin) || origin === process.env.FRONTEND_URL;
      callback(allowed ? null : new AppError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed"), allowed);
    },
    credentials: false,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) =>
  response.json({ status: "ok", searchDebug: process.env.ENABLE_SEARCH_DEBUG === "true" }),
);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/subjects", subjectRouter);
app.use("/api/neurons", neuronRouter);
app.use("/api/documents", documentRouter);
app.use("/api/connections", connectionRouter);
app.use("/api/search", searchRouter);
app.use("/api/ai", aiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
