import 'dotenv/config';
import { reviewWithApproval } from './prReviewFlow.ts';

async function main() {
  console.log('====================================================');
  console.log('🐙 Automated GitHub PR Reviewer (Human Approval Loop)');
  console.log('====================================================\n');

  // Target GitHub PR: CLI arg or PR_URL env, e.g. https://github.com/owner/repo/pull/1
  const prUrl = process.argv[2] || process.env.PR_URL;
  const match = prUrl?.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    console.error('❌ Provide a PR URL: npx tsx src/prIndex.ts https://github.com/<owner>/<repo>/pull/<n> (or set PR_URL)');
    process.exit(1);
  }
  const prTarget = {
    owner: match[1],
    repo: match[2],
    pullNumber: Number(match[3]),
  };

  await reviewWithApproval(prTarget);
}

main();
