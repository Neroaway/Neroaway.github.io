import { defineConfig, devices } from '@playwright/test';
const base=(process.env.SITE_BASE ?? '/').replace(/\/$/,'');
export default defineConfig({
  testDir:'./tests', fullyParallel:true, workers:2, retries:process.env.CI?1:0,
  use:{baseURL:`http://127.0.0.1:4321${base}/`,trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
  webServer:{command:'npm run preview -- --host 127.0.0.1 --ignore-lock',url:`http://127.0.0.1:4321${base}/`,reuseExistingServer:!process.env.CI},
});
