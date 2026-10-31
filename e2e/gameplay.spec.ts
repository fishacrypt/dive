import { expect, test, type Page } from '@playwright/test'
import { solveOptimally } from '../src/lib/challenges/solvers'
import type { ChallengePayload } from '../src/lib/challenges/types'

interface ChallengesResponse {
  ok: true
  data: { open: Array<{ id: string; payload: ChallengePayload; definition: { slug: string } }> }
}

const balance = (page: Page, name: 'credits' | 'quanta' | 'energy') => page.getByTestId(`balance-${name}`)

async function buy(page: Page, slug: string) {
  const card = page.locator(`[data-testid="market-item"][data-slug="${slug}"]`)
  await card.getByRole('button', { name: 'Buy' }).click()
  await page.getByRole('button', { name: 'Confirm purchase' }).click()
  await expect(page.getByText(/^Bought /).last()).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test.describe.configure({ mode: 'serial' })

test('full loop: buy, build, solve, mine, claim, verify ledger', async ({ page, request }) => {
  // Start from a clean demo player.
  const reset = await request.post('/api/demo/reset')
  expect(reset.ok()).toBeTruthy()

  // 1. Start a game: branding, tagline and starting balances.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'DIVE' })).toBeVisible()
  await expect(page.getByText('Build Your Rig. Solve Useful Work. Earn Quanta.')).toBeVisible()
  await expect(balance(page, 'credits')).toHaveText('1,500')
  await expect(balance(page, 'energy')).toContainText('400')
  await expect(page.getByText(/not a real QMS reward/i).first()).toBeVisible()

  // 2. Purchase the parts for a second rig.
  await page.goto('/market')
  for (const slug of ['chassis-starter', 'cpu-pulse', 'ram-8', 'cool-fan', 'psu-300']) await buy(page, slug)
  // 450 credits spent, plus 25 for the first-purchase achievement.
  await expect(balance(page, 'credits')).toHaveText('1,075')

  // 3. Build a rig from them.
  await page.goto('/rigs')
  await page.getByLabel('New rig name').fill('E2E Rig')
  await page.getByRole('button', { name: 'Create rig' }).click()
  await expect(page.getByTestId('rig-editor').getByRole('heading', { name: 'E2E Rig' })).toBeVisible()
  for (const slug of ['chassis-starter', 'cpu-pulse', 'ram-8', 'cool-fan', 'psu-300']) {
    await page.locator(`[data-testid="storage-part"][data-slug="${slug}"]`).first().getByRole('button', { name: 'Install' }).click()
    await expect(page.getByTestId('installed-part')).toHaveCount(['chassis-starter', 'cpu-pulse', 'ram-8', 'cool-fan', 'psu-300'].indexOf(slug) + 1)
  }
  await expect(page.getByTestId('rig-editor').getByText('Ready to mine')).toBeVisible()
  await expect(page.getByTestId('stat-compute')).toHaveText('10')

  // 4. Select a challenge.
  await page.goto('/challenges')
  await page.locator('[data-testid="challenge-def"][data-slug="route-basic"]').getByRole('button', { name: 'Generate' }).click()
  await expect(page.getByTestId('solver')).toBeVisible()

  // Solve it. The test computes the optimal route with the same algorithm the server uses, then plays it on the board.
  const challenges = (await (await request.get('/api/challenges')).json()) as ChallengesResponse
  const instance = challenges.data.open[0]
  expect(instance?.definition.slug).toBe('route-basic')
  const solution = solveOptimally(instance?.payload as ChallengePayload)
  if (solution.type !== 'PATH') throw new Error('expected a path solution')

  // A wrong move first: the server must reject an invalid answer.
  await page.getByRole('button', { name: 'Check solution' }).click()
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-valid', 'false')

  for (const id of solution.path.slice(1)) await page.getByTestId(`node-${id}`).click()
  await page.getByRole('button', { name: 'Check solution' }).click()
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-valid', 'true')

  // 5. Start the job on the new rig.
  await page.getByTestId('rig-option').filter({ hasText: 'E2E Rig' }).click()
  await expect(page.getByText('Job preview')).toBeVisible()
  await page.getByRole('button', { name: 'Start job' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start job' }).click()

  // 6. Watch progress on the jobs page, which survives a reload.
  await expect(page).toHaveURL(/\/jobs$/)
  const card = page.getByTestId('job-card').first()
  await expect(card).toHaveAttribute('data-status', 'RUNNING')
  await page.reload()
  await expect(page.getByTestId('job-card').first()).toHaveAttribute('data-status', 'RUNNING')
  await expect(page.getByTestId('balance-energy')).toContainText('340')

  // Premature claim is impossible from the UI and rejected by the server.
  await expect(page.getByRole('button', { name: 'Claim reward' })).toHaveCount(0)
  const jobId = ((await (await request.get('/api/jobs')).json()) as { data: Array<{ id: string }> }).data[0]?.id
  const early = await request.post(`/api/jobs/${jobId}/claim`)
  expect(early.status()).toBe(409)

  // 7. Complete it (about 20 seconds) and claim the reward.
  await expect(page.getByTestId('job-card').first()).toHaveAttribute('data-status', 'COMPLETED', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Claim reward' }).click()
  await expect(page.getByTestId('job-card').first()).toHaveAttribute('data-status', 'CLAIMED')

  // Duplicate claim is rejected.
  const dup = await request.post(`/api/jobs/${jobId}/claim`)
  expect(dup.status()).toBe(409)

  // 8. Balances and ledger agree: optimal route = 0.800 Q base + 25% bonus = 1.000 Q.
  await expect(balance(page, 'quanta')).toHaveText('1.000 Q')
  await page.goto('/ledger')
  await expect(page.getByTestId('recon-credits')).toContainText('Reconciled')
  await expect(page.getByTestId('recon-quanta')).toContainText('Reconciled')
  await expect(page.getByTestId('recon-energy')).toContainText('Reconciled')
  await expect(page.locator('[data-testid="ledger-row"][data-type="REWARD_CLAIM"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="ledger-row"][data-type="PURCHASE"]')).toHaveCount(5)
  await expect(page.locator('[data-testid="ledger-row"][data-type="JOB_ENERGY"]')).toHaveCount(1)

  // Progression moved too.
  await page.goto('/progress')
  await expect(page.getByTestId('xp-badge')).toContainText('75 XP')
  await expect(page.locator('[data-testid="achievement"][data-unlocked="true"]').first()).toBeVisible()
})
