import { corsHeaders } from "./cors.ts";

export const jsonResponse = (request: Request, body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders(request) });

export const errorResponse = (request: Request, code: string, status = 400) =>
  jsonResponse(request, { error: code }, status);

