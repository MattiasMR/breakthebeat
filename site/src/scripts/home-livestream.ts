import { createYouTubePlayer, isYouTubeVideoId, youtubeWatchUrl } from "../lib/livestream";
import { EVENT_SLUG } from "../lib/registration";

const hero = document.querySelector<HTMLElement>(".home-hero");
const section = document.querySelector<HTMLElement>("[data-home-livestream]");
const player = document.querySelector<HTMLElement>("[data-live-player]");
const link = document.querySelector<HTMLAnchorElement>("[data-live-youtube]");
const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
let currentVideo: string | null = null;
let loading = false;

const refresh = async () => {
  if (!hero || !section || !player || !link || !url || !key || loading || document.hidden) return;
  loading = true;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_public_livestream`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_event_slug: EVENT_SLUG }),
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data) || data.length > 1) return;
    const state = data[0];
    const id = state?.enabled === true && isYouTubeVideoId(state.video_id) ? state.video_id : null;
    if (id !== currentVideo) {
      player.replaceChildren(...(id ? [createYouTubePlayer(id, "Break The Beat · transmisión de YouTube")] : []));
      currentVideo = id;
    }
    if (id) link.href = youtubeWatchUrl(id);
    else link.removeAttribute("href");
    section.hidden = !id;
    hero.classList.toggle("has-livestream", Boolean(id));
  } catch {
    // A temporary connection failure must not interrupt a video already playing.
  } finally {
    loading = false;
  }
};

void refresh();
window.setInterval(() => void refresh(), 30_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) void refresh(); });
