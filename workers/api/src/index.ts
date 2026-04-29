import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  GITHUB_TOKEN: string; // Used for writing to moderation queue
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', cors());

/**
 * HELPER: Fetch from the GitHub Raw content URL
 * This allows the worker to read the Source of Truth directly from the public repo.
 */
async function fetchFromGitHub(repo: string, branch: string, path: string) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GitHub raw fetch failed: ${response.status}`);
  }
  return response.json();
}

/**
 * HELPER: Submit to Moderation Queue via GitHub API
 * Creates a PR or commits directly to pending-review.json
 */
async function submitToModerationQueue(env: Bindings, payload: any, type: string) {
  // Mocked out for demonstration: 
  // In production, this uses Octokit or raw fetch to GitHub REST API 
  // to append to /submissions/pending-review.json and trigger a Github Action.
  console.log(`[MODERATION] Writing ${type} to pending-review.json:`, payload);
  return { status: "submitted_for_review", trackingId: crypto.randomUUID() };
}

// ============================================================================
// READ ROUTES - Pulling from GitHub Source of Truth
// ============================================================================

app.get('/api/rooms', async (c) => {
  try {
    const data = await fetchFromGitHub(c.env.GITHUB_REPO, c.env.GITHUB_BRANCH, 'rooms/verified-index.json');
    // Implement caching logic here before returning
    return c.json(data);
  } catch (e) {
    return c.json({ error: "Failed to fetch rooms index" }, 500);
  }
});

app.get('/api/rooms/:state', async (c) => {
  const state = c.req.param('state').toLowerCase();
  try {
    const data = await fetchFromGitHub(c.env.GITHUB_REPO, c.env.GITHUB_BRANCH, `rooms/states/${state}.json`);
    return c.json(data);
  } catch (e) {
    return c.json({ error: `No data found for state: ${state}` }, 404);
  }
});

app.get('/api/rooms/slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  // Worker Logic: Fetch state index or full index, then find by slug.
  // In production, might query D1 or KV cache.
  return c.json({ info: "Slug resolution logic pending caching layer" });
});

app.get('/api/tournaments', async (c) => {
  try {
    const data = await fetchFromGitHub(c.env.GITHUB_REPO, c.env.GITHUB_BRANCH, 'tournaments/verified-index.json');
    return c.json(data);
  } catch (e) {
    return c.json({ error: "Failed to fetch tournaments index" }, 500);
  }
});

app.get('/api/tournaments/today', async (c) => {
  return c.json({ info: "Filtering logic for today's tournaments based on verified-index.json" });
});

app.get('/api/tournaments/weekly', async (c) => {
  // Fetch from /tournaments/weekly/{day}.json
  return c.json({ info: "Weekly recurring tournament data" });
});

app.get('/api/directors', async (c) => {
  try {
    const data = await fetchFromGitHub(c.env.GITHUB_REPO, c.env.GITHUB_BRANCH, 'directors/verified-directors.json');
    return c.json(data);
  } catch (e) {
    return c.json({ error: "Failed to fetch directors index" }, 500);
  }
});

app.get('/api/pricing', async (c) => {
  try {
    const data = await fetchFromGitHub(c.env.GITHUB_REPO, c.env.GITHUB_BRANCH, 'pricing/venue-pricing.json');
    return c.json(data);
  } catch (e) {
    return c.json({ error: "Failed to fetch pricing logic" }, 500);
  }
});

// ============================================================================
// WRITE ROUTES - Submitting to Moderation Queues
// ============================================================================

app.post('/api/claim-room', async (c) => {
  const payload = await c.req.json();
  // 1. Validate payload structure
  // 2. Perform duplicate/fraud detection
  // 3. Submit to moderation queue
  const result = await submitToModerationQueue(c.env, payload, 'room_claim');
  return c.json(result, 201);
});

app.post('/api/submit-tournament', async (c) => {
  const payload = await c.req.json();
  const result = await submitToModerationQueue(c.env, payload, 'tournament_submission');
  return c.json(result, 201);
});

app.post('/api/report-issue', async (c) => {
  const payload = await c.req.json();
  const result = await submitToModerationQueue(c.env, payload, 'issue_report');
  return c.json(result, 201);
});

export default app;
