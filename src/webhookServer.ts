import * as http from 'http';
import * as crypto from 'crypto';
import 'dotenv/config';
import { mastra } from './mastra/index.ts';
import { postPRReviewTool } from './mastra/tools/postPRReviewTool.ts';

const PORT = process.env.PORT || 8080;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

/**
 * Verifies GitHub HMAC SHA-256 signature if GITHUB_WEBHOOK_SECRET is set.
 */
function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET) return true; // Skip if secret is not set
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

const REVIEW_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);
const inFlight = new Set<string>();

/**
 * Runs the PR review workflow and posts the result to GitHub as a COMMENT review.
 * Runs in the background so the webhook can answer GitHub within its 10s timeout.
 */
async function reviewAndPost(owner: string, repo: string, pullNumber: number) {
  const key = `${owner}/${repo}#${pullNumber}`;
  if (inFlight.has(key)) {
    console.log(`⏭️  [Auto Review] ${key} already being reviewed, skipping.`);
    return;
  }
  inFlight.add(key);

  try {
    console.log(`🤖 [Auto Review] Starting review for ${key}...`);
    const run = await mastra.getWorkflow('prReviewWorkflow').createRun();
    const result = await run.start({ inputData: { owner, repo, pullNumber } });

    if (result.status !== 'success' || !result.result) {
      console.error(`❌ [Auto Review] Workflow failed for ${key}:`, result.status);
      return;
    }

    const postResult = await postPRReviewTool.execute({
      owner,
      repo,
      pullNumber,
      reviewReport: result.result.prReviewReport,
      event: 'COMMENT',
    });
    console.log(`🎉 [Auto Review] ${postResult.message}${postResult.htmlUrl ? ` → ${postResult.htmlUrl}` : ''}`);
  } catch (err: any) {
    console.error(`❌ [Auto Review] Error reviewing ${key}:`, err.message);
  } finally {
    inFlight.delete(key);
  }
}

const server = http.createServer((req, res) => {
  // Only accept POST requests at /api/github/webhook
  if (req.method === 'POST' && req.url === '/api/github/webhook') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;

      if (!verifySignature(body, signature)) {
        console.error('❌ [Webhook Server] Invalid signature signature check failed.');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid HMAC signature' }));
        return;
      }

      try {
        const payload = JSON.parse(body);

        if (event === 'pull_request') {
          const action = payload.action;
          const pullNumber = payload.number;
          const prTitle = payload.pull_request?.title || 'Untitled PR';
          const author = payload.pull_request?.user?.login || 'unknown';
          const repo = payload.repository?.name;
          const owner = payload.repository?.owner?.login;

          console.log('\n====================================================');
          console.log(`🔔 [GITHUB WEBHOOK ALERT] Pull Request Event Received!`);
          console.log('====================================================');
          console.log(`📌 Repository : ${owner}/${repo}`);
          console.log(`🔀 PR #${pullNumber}   : "${prTitle}"`);
          console.log(`👤 Author     : @${author}`);
          console.log(`⚡ Action     : ${action}`);
          console.log('----------------------------------------------------');
          console.log('====================================================\n');

          if (REVIEW_ACTIONS.has(action) && !payload.pull_request?.draft && owner && repo) {
            void reviewAndPost(owner, repo, pullNumber);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'Webhook received successfully' }));
      } catch (err: any) {
        console.error('❌ Error parsing webhook payload:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', server: 'GitHub PR Webhook Listener' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🎧 GitHub Webhook Listener Server Running on Port ${PORT}`);
  console.log(`🌐 Endpoint URL : http://localhost:${PORT}/api/github/webhook`);
  console.log(`🏥 Health Check  : http://localhost:${PORT}/health`);
  console.log('====================================================');
});
