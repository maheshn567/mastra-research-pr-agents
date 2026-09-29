import * as readline from 'readline';
import { mastra } from './mastra/index.ts';
import { postPRReviewTool } from './mastra/tools/postPRReviewTool.ts';
import { prReviewerAgent } from './mastra/agents/pr/prReviewerAgent.ts';

export interface PRTarget {
  owner: string;
  repo: string;
  pullNumber: number;
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

/**
 * Creates a clean, concise terminal preview snippet of the report
 */
function getShortPreview(fullReport: string): string {
  const lines = fullReport.split('\n');
  const previewLines: string[] = [];
  let lineCount = 0;

  for (const line of lines) {
    previewLines.push(line);
    lineCount++;
    if (lineCount >= 25) {
      previewLines.push('\n... [Full detailed report with line-by-line diff suggestions ready to post] ...');
      break;
    }
  }

  return previewLines.join('\n');
}

async function reviseReport(previousReport: string): Promise<string> {
  const feedback = await askQuestion('📝 What feedback or changes should be made to the PR review comment?\n> ');
  console.log('\n⏳ Regenerating revised PR Review comment based on your feedback...');

  const revisionPrompt = `The human reviewer rejected the previous PR review comment with the following feedback:
  "${feedback}"

  ### Previous PR Review Comment:
  ${previousReport}

  Please generate a revised, updated PR Review Report addressing all user feedback.`;

  const revisionResponse = await prReviewerAgent.generateLegacy(revisionPrompt, { maxSteps: 3 });
  return revisionResponse.text;
}

/**
 * Runs the PR review workflow, shows the report, and posts it to GitHub only after human approval.
 */
export async function reviewWithApproval(prTarget: PRTarget): Promise<void> {
  console.log(`📌 Target PR: https://github.com/${prTarget.owner}/${prTarget.repo}/pull/${prTarget.pullNumber}`);

  try {
    // 1. Run PR Review Workflow
    const run = await mastra.getWorkflow('prReviewWorkflow').createRun();
    const result = await run.start({ inputData: prTarget });

    if (result.status !== 'success' || !result.result) {
      console.error('❌ Workflow execution failed:', result);
      return;
    }

    let currentReport = result.result.prReviewReport;

    // 2. Interactive Human-in-the-Loop Approval & Refinement Loop
    while (true) {
      console.log('\n====================================================');
      console.log('📄 PROPOSED GITHUB PR REVIEW PREVIEW');
      console.log('====================================================\n');
      console.log(getShortPreview(currentReport));
      console.log('\n====================================================');

      const answer = (await askQuestion('\n❓ Approve and post to GitHub? Options: (yes / no / view full comment): ')).toLowerCase();

      if (answer === 'view' || answer === 'v' || answer === 'full') {
        console.log('\n====================================================');
        console.log('📜 FULL PR REVIEW COMMENT (EXACT MARKDOWN TO BE POSTED)');
        console.log('====================================================\n');
        console.log(currentReport);
        console.log('\n====================================================');

        const confirm = (await askQuestion('\n❓ Do you approve posting this full comment to GitHub now? (yes / no): ')).toLowerCase();
        if (confirm === 'yes' || confirm === 'y') break;
        currentReport = await reviseReport(currentReport);
      } else if (answer === 'yes' || answer === 'y') {
        break;
      } else {
        console.log('\n✋ Review rejected by user.');
        currentReport = await reviseReport(currentReport);
      }
    }

    console.log('\n🚀 Approval granted! Publishing review comment to GitHub...');
    const postResult = await postPRReviewTool.execute({
      ...prTarget,
      reviewReport: currentReport,
      event: 'COMMENT',
    });

    console.log(`\n🎉 ${postResult.message}`);
    if (postResult.htmlUrl) {
      console.log(`🔗 Review Link: ${postResult.htmlUrl}`);
    }
  } catch (error) {
    console.error('❌ Error during PR Review loop:', error);
  }
}
