import type { Request, Response } from "express";
import { getMarkdownNoteForUser, upsertMarkdownNoteForUser } from "../services/markdown-note.service";
import { routeParam } from "../utils/request";

export async function getMarkdownNote(request: Request, response: Response) {
  const note = await getMarkdownNoteForUser(routeParam(request, "neuronId"), request.userId);
  response.json(note);
}

export async function upsertMarkdownNote(request: Request, response: Response) {
  const note = await upsertMarkdownNoteForUser(routeParam(request, "neuronId"), request.userId, request.body.content);
  response.json(note);
}
