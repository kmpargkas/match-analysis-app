import type { Locator, Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

const TEAM = 'Lions U14';
const OPPONENT = 'Atromitos';

/** A 4-3-3 in slot order (shirt numbers 1–11), plus one sub as #12. */
const SQUAD: [name: string, position: RegExp][] = [
  ['Kostas Keeper', /^Goalkeeper/],
  ['Rafa Right', /^Right back/],
  ['Chris Centre', /^Centre back/],
  ['Leo Centre', /^Centre back/],
  ['Lefteris Left', /^Left back/],
  ['Dimitris Holder', /^Defensive midfielder/],
  ['Manos Mid', /^Central midfielder/],
  ['Giorgos Papadopoulos', /^Central midfielder/],
  ['Ronaldo Wing', /^Right winger/],
  ['Stelios Striker', /^Striker/],
  ['Lampros Wing', /^Left winger/],
  ['Spare Mid', /^Central midfielder/],
];

type Point = { x: number; y: number };

async function createTeamWithSquad(page: Page) {
  await page.goto('/squads');
  await page.getByRole('button', { name: 'Create team' }).first().click();
  const teamDialog = page.getByRole('dialog');
  await teamDialog.getByLabel('Team name').fill(TEAM);
  await teamDialog.getByRole('button', { name: 'Create team' }).click();
  await expect(page.getByRole('heading', { name: TEAM })).toBeVisible();

  for (const [name, position] of SQUAD) {
    await page.getByRole('button', { name: 'Add player' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add player' });
    await dialog.getByLabel('Player name').fill(name);
    await dialog.getByRole('checkbox', { name: position }).click();
    await dialog.getByRole('button', { name: 'Add player' }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByText(`${SQUAD.length} players`)).toBeVisible();
}

async function setUpMatch(page: Page) {
  await page.goto('/matches/new');
  await page.getByRole('button', { name: `Pick ${TEAM}` }).click();
  await page.getByLabel('Opponent').fill(OPPONENT);
  await page.getByLabel('Date').fill('2026-10-04');
  for (const [i, [name]] of SQUAD.entries()) {
    await page.getByRole('checkbox', { name, exact: true }).click();
    await page.getByLabel(`Shirt number for ${name}`).fill(String(i + 1));
  }
  await page.getByLabel('Formation', { exact: true }).selectOption('4-3-3');
  // The widget moves to the next empty slot after each pick.
  await page.getByRole('button', { name: 'GK', exact: true }).click();
  for (const [name] of SQUAD.slice(0, 11)) {
    await page.getByRole('region', { name: /^[A-Z]+ · / }).getByRole('button', { name: new RegExp(name) }).click();
  }
  await expect(page.getByText('11 / 11 placed')).toBeVisible();
  await page.getByRole('button', { name: 'Start collecting' }).click();
  await expect(page).toHaveURL(/\/matches\/[0-9a-f-]{36}\/collect$/);
}

/** Presses on the collector minimap at one pitch point (0–100) and releases at another; one point is a click. */
async function pressMinimap(page: Page, from: Point, to: Point = from) {
  const box = (await page.getByTestId('minimap-surface').boundingBox())!;
  // The surface spans the 105 × 68 pitch plus 3 units of padding on every side.
  const client = (p: Point) => ({ x: box.x + ((3 + (p.x / 100) * 105) / 111) * box.width, y: box.y + ((3 + (p.y / 100) * 68) / 74) * box.height });
  const a = client(from);
  const b = client(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
}

const eventLog = (page: Page) => page.getByRole('region', { name: 'Events' });
const newestCard = (page: Page) => eventLog(page).getByRole('article').first();

/** Clicks an action button, maps it, picks the player by shirt number, and checks the card is complete. */
async function logEvent(page: Page, action: string, location: { from: Point; to?: Point }, shirt: number, attribute?: { group: string; option: string }) {
  await page.getByRole('button', { name: action, exact: true }).click();
  const card = newestCard(page);
  await expect(card).toHaveAccessibleName(new RegExp(` ${action}$`));
  await expect(card.getByLabel(/^Missing:/)).toBeVisible();
  await expect(page.getByText('Map the event')).toBeVisible();

  await pressMinimap(page, location.from, location.to);
  await page.getByRole('textbox', { name: 'Number or name' }).fill(String(shirt));
  await page.keyboard.press('Enter');
  await expect(card.getByRole('button', { name: new RegExp(`^Player: #${shirt} `) })).toBeVisible();

  if (attribute) await card.getByRole('group', { name: attribute.group }).getByRole('button', { name: attribute.option, exact: true }).click();
  await expect(card.getByLabel(/^Missing:/)).toHaveCount(0);
}

// The page's Date.now() only moves when the test moves it (timers keep running), so every time is exact.
let fakeNowMs = Date.now();

/** Moves the page's time on 10 s, so the collector timeline and the running clock move with it. */
async function forward(page: Page) {
  fakeNowMs += 10_000;
  await page.clock.setFixedTime(fakeNowMs);
}

const possessionButton = (page: Page) => page.getByRole('button', { name: /^Change possession\./ });

async function openReportFromHome(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(`Match actions: ${TEAM} vs ${OPPONENT}`, 'i') }).click();
  await page.getByRole('menuitem', { name: 'Match report' }).click();
  await expect(page).toHaveURL(/\/matches\/[0-9a-f-]{36}\/report$/);
  await expect(page.getByRole('region', { name: 'Formation' })).toBeVisible();
}

const reportText = (page: Page) => page.getByRole('main').innerText();

const scoreButton = (scope: Locator | Page, side: 'Our goals' | 'Opponent goals') => scope.getByRole('button', { name: side, exact: true });

test('a match from squad to report survives a JSON backup round trip', async ({ page, newProfile }) => {
  await page.clock.setFixedTime(fakeNowMs);

  await test.step('create a team and its squad', () => createTeamWithSquad(page));
  await test.step('set up a 4-3-3 match', () => setUpMatch(page));

  await test.step('K starts and pauses the clock', async () => {
    await page.keyboard.press('k');
    await expect(page.getByRole('button', { name: 'Pause the clock' })).toBeVisible();
    await page.keyboard.press('k');
    await expect(page.getByRole('button', { name: 'Start the clock' })).toBeVisible();
  });

  await test.step('start the clock with us in possession', async () => {
    await page.getByRole('button', { name: 'Start the clock' }).click();
    await possessionButton(page).click();
    await expect(possessionButton(page)).toHaveAccessibleName(`Change possession. Possession: ${TEAM}`);
  });

  await test.step('log five events with location, player and attributes', async () => {
    await forward(page);
    await logEvent(page, 'Pass ✓', { from: { x: 30, y: 40 }, to: { x: 70, y: 20 } }, 8);
    await forward(page);
    await logEvent(page, 'Pass ✗', { from: { x: 50, y: 50 }, to: { x: 75, y: 80 } }, 6);
    await forward(page);
    await logEvent(page, 'Goal', { from: { x: 90, y: 50 } }, 10, { group: 'Body part', option: 'Right' });

    await forward(page);
    await possessionButton(page).click();
    await expect(possessionButton(page)).toHaveAccessibleName('Change possession. Possession: Opponent');

    await logEvent(page, 'Tackle ✓', { from: { x: 25, y: 60 } }, 4);
    await forward(page);
    await logEvent(page, 'Interception', { from: { x: 40, y: 30 } }, 3);
    await expect(eventLog(page).getByRole('article')).toHaveCount(5);
  });

  await test.step('edit an event: the failed pass was completed', async () => {
    const card = eventLog(page).getByRole('article', { name: /Pass ✗/ });
    await card.getByRole('combobox', { name: 'Outcome' }).selectOption('complete');
    await expect(eventLog(page).getByRole('article', { name: /Pass ✓/ })).toHaveCount(2);
  });

  await test.step('delete an event after confirming', async () => {
    await eventLog(page).getByRole('article', { name: /Interception/ }).getByRole('button', { name: 'Delete event' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(eventLog(page).getByRole('article')).toHaveCount(4);
  });

  await test.step('stop the clock at the end of the match', async () => {
    await forward(page);
    await page.getByRole('button', { name: 'Pause the clock' }).click();
    await expect(page.getByRole('button', { name: 'Start the clock' })).toBeVisible();
  });

  await test.step('set the score and finish the match', async () => {
    await page.getByRole('button', { name: 'Add a goal: Our goals' }).click();
    await expect(scoreButton(page, 'Our goals')).toHaveText('1');
    await page.getByRole('button', { name: 'Finish match' }).click();
    const dialog = page.getByRole('dialog', { name: 'Finish this match?' });
    await expect(dialog.getByText('All 4 events are complete.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Finish match' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  let original = '';
  await test.step('the report shows what was logged', async () => {
    await openReportFromHome(page);

    const header = page.getByRole('region', { name: 'Match' });
    await expect(header.getByLabel('Our goals', { exact: true })).toHaveText('1');
    await expect(header.getByLabel('Opponent goals', { exact: true })).toHaveText('0');
    // Us from 0 s to 40 s, the opponent until the clock stopped at 60 s.
    await expect(header.getByRole('meter', { name: 'Possession' })).toHaveAttribute('aria-valuenow', '67');

    const passing = page.getByRole('region', { name: 'Passing' });
    await expect(passing.getByRole('row', { name: /^Passes/ })).toContainText('2/2');
    await expect(page.getByRole('region', { name: 'Shooting' }).getByRole('row', { name: /^Goals/ })).toContainText('1');
    await expect(page.getByRole('status', { name: 'Incomplete events' })).toHaveCount(0);

    const formation = page.getByRole('region', { name: 'Formation' });
    await expect(formation.getByRole('button', { name: '#10 Stelios Striker' }).getByLabel(/^Goal \d+'$/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Shot map' }).getByRole('img', { name: 'Shot map: 1 on target, 0 off target, 0 blocked' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Pass map' }).getByRole('img', { name: 'Pass map: 2 accurate, 0 inaccurate' })).toBeVisible();

    original = await reportText(page);
  });

  const backup = await test.step('export everything as JSON', async () => {
    await page.goto('/');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export all' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^match-analysis-backup-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(page.getByText('Last backup: today')).toBeVisible();
    return file.path();
  });

  await test.step('import into an empty browser gives the same report', async () => {
    const other = await (await newProfile()).newPage();
    await other.goto('/');
    await other.getByLabel('Backup file').setInputFiles(backup);
    await expect(other.getByText('Imported 1 match')).toBeVisible();

    await openReportFromHome(other);
    expect(await reportText(other)).toBe(original);
  });
});
