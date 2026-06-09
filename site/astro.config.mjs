import { defineConfig } from "astro/config";

const [githubOwner, githubRepo] = (process.env.GITHUB_REPOSITORY || "").split("/");
const defaultGithubBase = githubRepo ? `/${githubRepo}` : "/";
const configuredBase = process.env.BASE_PATH;
const base = configuredBase === "" ? "/" : configuredBase || (process.env.GITHUB_ACTIONS ? defaultGithubBase : "/");
const site =
  process.env.SITE_URL ||
  (githubOwner ? `https://${githubOwner.toLowerCase()}.github.io` : "https://breakthebeat.pages.dev");

export default defineConfig({
  output: "static",
  site,
  base
});
