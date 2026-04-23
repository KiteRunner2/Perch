/// <reference types="vitest" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function readBuildInfo() {
  const inCI = Boolean(process.env.GITHUB_SHA);
  const sha =
    process.env.GITHUB_SHA ||
    tryGit(() => execSync('git rev-parse HEAD').toString().trim()) ||
    'unknown';
  const branch =
    process.env.GITHUB_REF_NAME ||
    tryGit(() => execSync('git rev-parse --abbrev-ref HEAD').toString().trim()) ||
    'unknown';
  // In CI the checkout is clean by construction — skip the probe, which
  // otherwise fires false positives from side effects of the build steps
  // that run before vite reads the config.
  const dirty = inCI
    ? false
    : (tryGit(() => execSync('git status --porcelain').toString().length > 0) ?? false);
  return {
    sha,
    shortSha: sha.slice(0, 7),
    branch,
    dirty,
    builtAt: new Date().toISOString(),
  };
}

function tryGit<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

const buildInfo = readBuildInfo();

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // Emit /version.json so the running app can poll it and prompt the
      // user to reload when the deployed SHA differs from the bundled one.
      name: 'perch-emit-version-manifest',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({
            sha: buildInfo.sha,
            shortSha: buildInfo.shortSha,
            branch: buildInfo.branch,
            builtAt: buildInfo.builtAt,
          }),
        });
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(buildInfo),
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
