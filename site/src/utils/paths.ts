const rawBase = import.meta.env.BASE_URL || "/";
const base = rawBase === "/" ? "" : rawBase.replace(/\/$/, "");

export const withBase = (path: string) => {
  if (!path) return path;
  if (/^(https?:|mailto:|tel:)/.test(path) || path.startsWith("#")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};
