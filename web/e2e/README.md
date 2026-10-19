# Phone browser play-through

Install the Chromium browser once, then run the real-browser suite:

```sh
pnpm --dir web exec playwright install chromium
pnpm --dir web test:e2e
```

The suite uses a 390×844 Chromium mobile viewport. It captures light and dark reference screens in `screenshots/` and writes failure screenshots/video under `test-results/`.

If another local app already uses port 5173, choose a free port for the Vite server and Playwright base URL:

```sh
PLAYWRIGHT_PORT=5174 pnpm --dir web test:e2e
```
