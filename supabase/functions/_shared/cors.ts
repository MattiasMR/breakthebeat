const defaultOrigins = [
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  "https://mattiasmr.github.io"
];

const allowedOrigins = () => {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...defaultOrigins, ...configured]);
};

export const isAllowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins().has(origin);
};

export const corsHeaders = (request: Request) => {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};

export const optionsResponse = (request: Request) =>
  new Response(null, { status: 204, headers: corsHeaders(request) });

