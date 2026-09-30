import type { RequestHandler } from "express";
import { z } from "zod";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex value");
const finiteNumber = z.number().finite();
const nonEmptyName = z.string().trim().min(1).max(120);

export const authSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});

export const createSubjectSchema = z.object({
  name: nonEmptyName,
  color: color.optional(),
});

export const updateSubjectSchema = createSubjectSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

const neuronFields = {
  name: nonEmptyName,
  color,
  textContent: z.string().max(100_000).optional().default(""),
  keyPoints: z.string().max(100_000).optional().default(""),
  memoryMethod: z.string().max(100_000).optional().default(""),
  application: z.string().max(100_000).optional().default(""),
  positionX: finiteNumber.optional().default(0),
  positionY: finiteNumber.optional().default(0),
  positionZ: finiteNumber.optional().default(0),
};

export const createNeuronSchema = z.object(neuronFields);

export const updateNeuronSchema = z
  .object({
    name: nonEmptyName.optional(),
    color: color.optional(),
    textContent: z.string().max(100_000).optional(),
    note: z.string().max(100_000).nullable().optional(),
    keyPoints: z.string().max(100_000).optional(),
    memoryMethod: z.string().max(100_000).optional(),
    application: z.string().max(100_000).optional(),
    positionX: finiteNumber.optional(),
    positionY: finiteNumber.optional(),
    positionZ: finiteNumber.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const upsertMarkdownNoteSchema = z.object({
  content: z.string(),
});

export const createConnectionSchema = z.object({
  sourceNeuronId: z.string().min(1),
  targetNeuronId: z.string().min(1),
});

export function validateBody(schema: z.ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    request.body = result.data;
    next();
  };
}
