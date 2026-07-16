import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim() ?? "";
const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

let client: SupabaseClient | undefined;

export const backendConfiguration = {
  supabaseUrl,
  publishableKey,
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "",
  testMode: import.meta.env.PUBLIC_ENABLE_TEST_MODE === "true"
};

export const isBackendConfigured = () => Boolean(supabaseUrl && publishableKey);

export const getSupabase = () => {
  if (!isBackendConfigured()) {
    throw new Error("Supabase todavía no está configurado para este despliegue.");
  }

  if (!client) {
    client = createClient(supabaseUrl, publishableKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  }

  return client;
};

export const withClientBase = (path: string) => {
  const base = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
};

