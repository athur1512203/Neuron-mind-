import jwt from "jsonwebtoken";

export function assertJwtConfiguration() {
  const secret = process.env.JWT_SECRET?.trim() ?? "";
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  if (process.env.NODE_ENV !== "production") return;
  if (secret.length < 32) {
    throw new Error("JWT_SECRET is too short for production");
  }
  const placeholder = "replace-with-a-long-random-secret";
  if (secret === placeholder) {
    throw new Error("JWT_SECRET must be replaced in production");
  }
}

export const JWT_SIGN_OPTIONS: jwt.SignOptions = { expiresIn: "7d", algorithm: "HS256" };
export const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = { algorithms: ["HS256"] };
