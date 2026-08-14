/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
  readonly PUBLIC_META_PIXEL_ID?: string;
  readonly PUBLIC_ENABLE_TEST_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
