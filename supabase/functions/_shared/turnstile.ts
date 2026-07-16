type TurnstileResult = {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export const verifyTurnstile = async (request: Request, token: string, expectedAction: string) => {
  if (Deno.env.get("ALLOW_TEST_TURNSTILE") === "true" && token === "test-ok") return true;

  const secret = Deno.env.get("TURNSTILE_SECRET_KEY")?.trim();
  if (!secret || !token) return false;

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) form.set("remoteip", ip);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return false;
    const result = (await response.json()) as TurnstileResult;
    if (result.success !== true || result.action !== expectedAction) return false;

    const origin = request.headers.get("origin");
    if (origin && result.hostname) {
      try {
        if (new URL(origin).hostname !== result.hostname) return false;
      } catch {
        return false;
      }
    }
    return Boolean(result.hostname);
  } catch {
    return false;
  }
};
