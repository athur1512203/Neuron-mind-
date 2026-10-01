import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SIGN_OPTIONS } from "../config/secrets";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

const userSelect = { id: true, email: true, createdAt: true, updatedAt: true } as const;

function createToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError(500, "SERVER_CONFIGURATION_ERROR", "Server is not configured");
  return jwt.sign({}, secret, { subject: userId, ...JWT_SIGN_OPTIONS });
}

export async function register(request: Request, response: Response) {
  const { email, password } = request.body;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({ data: { email, passwordHash }, select: userSelect });
    response.status(201).json({ token: createToken(user.id), user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered");
    }
    throw error;
  }
}

export async function login(request: Request, response: Response) {
  const { email, password } = request.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  response.json({
    token: createToken(user.id),
    user: { id: user.id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt },
  });
}

export async function me(request: Request, response: Response) {
  const user = await prisma.user.findUnique({ where: { id: request.userId }, select: userSelect });
  if (!user) throw new AppError(401, "USER_NOT_FOUND", "User no longer exists");
  response.json(user);
}
