import { defineConfig } from "vite";

function normalizeBasePath(value) {
  if (!value) {
    return "/";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function resolveBasePath() {
  if (process.env.VITE_BASE_PATH) {
    return normalizeBasePath(process.env.VITE_BASE_PATH);
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (!repositoryName || process.env.GITHUB_ACTIONS !== "true") {
    return "/";
  }

  return repositoryName.endsWith(".github.io") ? "/" : `/${repositoryName}/`;
}

export default defineConfig({
  base: resolveBasePath(),
  build: {
    chunkSizeWarningLimit: 700,
  },
});
