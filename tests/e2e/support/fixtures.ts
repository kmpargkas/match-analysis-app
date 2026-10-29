import { test as base, type BrowserContext } from '@playwright/test';

interface Fixtures {
  /** Another empty browser profile, like a second computer. */
  newProfile: () => Promise<BrowserContext>;
}

export const test = base.extend<Fixtures>({
  newProfile: async ({ browser, baseURL, viewport }, use) => {
    const opened: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({ baseURL, viewport });
      opened.push(context);
      return context;
    });
    await Promise.all(opened.map((c) => c.close()));
  },
});

export { expect } from '@playwright/test';
