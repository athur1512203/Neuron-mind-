import type { Request, Response } from "express";
import { askNeuron } from "../services/neuro.service";
import { routeParam } from "../utils/request";

export async function chatNeuron(request: Request, response: Response) {
  const result = await askNeuron({
    neuronId: routeParam(request, "neuronId"),
    userId: request.userId,
    message: request.body.message,
    history: request.body.history,
  });
  response.json(result);
}
