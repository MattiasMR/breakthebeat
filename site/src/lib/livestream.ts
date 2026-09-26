const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export const isYouTubeVideoId = (value: unknown): value is string =>
  typeof value === "string" && videoIdPattern.test(value);

/** Accept video links only; never insert administrator-provided HTML or iframe URLs. */
export const parseYouTubeVideoId = (input: string): string | null => {
  const value = input.trim();
  if (isYouTubeVideoId(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (host === "youtu.be" && parts.length === 1) id = parts[0];
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (parts.length === 2 && ["live", "embed", "shorts"].includes(parts[0])) id = parts[1];
    }
    if (host === "www.youtube-nocookie.com" && parts.length === 2 && parts[0] === "embed") id = parts[1];
    return isYouTubeVideoId(id) ? id : null;
  } catch {
    return null;
  }
};

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const createYouTubePlayer = (id: string, title: string) => {
  if (!isYouTubeVideoId(id)) throw new Error("INVALID_VIDEO_ID");
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`;
  iframe.title = title;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  // YouTube requires a Referer to identify the embedding site (error 153 otherwise).
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  return iframe;
};
