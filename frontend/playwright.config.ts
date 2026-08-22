import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a disposable local stack, never against the
 * shared Supabase project that backs staging and production.
 *
 * Playwright starts both servers itself on ports that do not collide with a
 * developer's own `npm run dev` / uvicorn session, and points the backend at
 * the local Supabase started by `npm run supabase -- start` in the repo root.
 *
 * Prerequisites:
 *   npm run supabase -- start        (repo root)
 *   npm run db:reset                 (repo root)
 *   python tests/e2e_seed.py         (backend, with its venv)
 */

const BACKEND_PORT = 8001;
const FRONTEND_PORT = 3001;

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
// Well-known demo key printed by `supabase start`; identical on every machine
// and worthless outside a local container.
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.' +
  'EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: './e2e',
  // The suite shares one database; parallel workers would race on sequences
  // and on the enterprise list every test reads.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*\.mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: '.venv\\Scripts\\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001',
      cwd: '../backend',
      url: `${BACKEND_URL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        SUPABASE_URL: LOCAL_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY,
        JWT_SECRET_KEY: 'e2e-local-jwt-signing-key-with-enough-length-0123456789',
        GEMINI_API_KEY: 'e2e-local-gemini-key-not-real',
        FRONTEND_URL,
        DEBUG: 'true',
      },
    },
    {
      // Production build rather than `next dev`: the dev server compiles routes
      // on first request, which made the first test to reach a cold route time
      // out while later runs of the same test passed. It is also the artifact
      // that actually ships. NEXT_PUBLIC_* is inlined at build time, so the
      // build and the server must share this env block.
      command: `npm run build && npm run start -- --port ${FRONTEND_PORT}`,
      cwd: '.',
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_API_URL: BACKEND_URL,
      },
    },
  ],
});
