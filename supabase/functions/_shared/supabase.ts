import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@^2";

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const createAdminClient = () =>
  createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });

export const createAuthClient = () => {
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() || requiredEnv("SUPABASE_ANON_KEY");
  return createClient(requiredEnv("SUPABASE_URL"), publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};

export type AuthorizedAdmin = {
  client: SupabaseClient;
  user: User;
  username: string;
};

export const requireAdmin = async (request: Request): Promise<AuthorizedAdmin | null> => {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const client = createAdminClient();
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: admin, error: adminError } = await client
    .from("admin_users")
    .select("username, active")
    .eq("auth_user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError || !admin) return null;
  return { client, user: userData.user, username: admin.username };
};

