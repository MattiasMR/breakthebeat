import { z } from "npm:zod@4";
import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAdminClient, createAuthClient } from "../_shared/supabase.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(12).max(128),
  turnstileToken: z.string().min(1).max(2048)
});

const hashKey = async (value: string) => {
  const salt = Deno.env.get("LOGIN_RATE_LIMIT_SALT")?.trim();
  if (!salt) throw new Error("Missing LOGIN_RATE_LIMIT_SALT");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${value}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const rateLimitKeys = async (request: Request, username: string) => {
  const address = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  return Promise.all([hashKey(`address:${address}`), hashKey(`username:${username}`)]);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return errorResponse(request, "METHOD_NOT_ALLOWED", 405);
  if (!isAllowedOrigin(request)) return errorResponse(request, "ORIGIN_NOT_ALLOWED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, "INVALID_CREDENTIALS", 401);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return errorResponse(request, "INVALID_CREDENTIALS", 401);
  if (!(await verifyTurnstile(request, parsed.data.turnstileToken, "admin_login"))) {
    return errorResponse(request, "TURNSTILE_FAILED", 403);
  }

  const adminClient = createAdminClient();
  const attemptKeys = await rateLimitKeys(request, parsed.data.username);
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await adminClient.from("admin_login_attempts").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const attemptCounts = await Promise.all(attemptKeys.map((key) => adminClient
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("key_hash", key)
    .gte("created_at", windowStart)));

  if (attemptCounts.some(({ count, error }) => error || (count ?? 0) >= 5)) {
    return errorResponse(request, "INVALID_CREDENTIALS", 401);
  }

  const recordFailure = async () => {
    await adminClient.from("admin_login_attempts").insert(attemptKeys.map((key_hash) => ({ key_hash })));
  };

  const { data: admin } = await adminClient
    .from("admin_users")
    .select("auth_user_id, username, auth_email")
    .eq("username", parsed.data.username)
    .eq("active", true)
    .maybeSingle();

  if (!admin) {
    await recordFailure();
    return errorResponse(request, "INVALID_CREDENTIALS", 401);
  }

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: admin.auth_email,
    password: parsed.data.password
  });

  if (error || !data.session || data.user.id !== admin.auth_user_id) {
    await recordFailure();
    return errorResponse(request, "INVALID_CREDENTIALS", 401);
  }

  await adminClient.from("admin_login_attempts").delete().in("key_hash", attemptKeys);

  await adminClient.from("admin_audit_log").insert({
    auth_user_id: data.user.id,
    action: "admin_login",
    target_type: "session",
    metadata: { username: admin.username }
  });

  return jsonResponse(request, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    username: admin.username
  });
});
