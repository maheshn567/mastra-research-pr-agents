import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Context, Service } from 'cordis';

/**
 * DeepSeek Harness (DSH) Cordis Framework Integration.
 * Registers Cordis Services onto the `ctx` Context object,
 * so all plugin executions run directly through `ctx.securityScanner`, `ctx.astAnalyzer`, and `ctx.webCleaner`.
 */

// 1. Register DSH Service types on Cordis Context
declare module 'cordis' {
  interface Context {
    securityScanner: SecurityScannerService;
    astAnalyzer: ASTAnalyzerService;
    webCleaner: WebCleanerService;
  }
}

// 2. Define Cordis Security Scanner Service
export class SecurityScannerService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'securityScanner', true);
  }

  scan(inputData: string) {
    const secretsFound: Array<{ type: string; match: string; severity: 'CRITICAL'; rec: string }> = [];
    const patterns = [
      { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}/g, rec: 'Revoke token immediately' },
      { name: 'Groq API Key', regex: /gsk_[a-zA-Z0-9]{48}/g, rec: 'Move to environment variables' },
      { name: 'NVIDIA API Key', regex: /nvapi-[a-zA-Z0-9_-]{50,}/g, rec: 'Move to environment variables' },
    ];

    for (const p of patterns) {
      const matches = inputData.match(p.regex);
      if (matches) {
        for (const m of matches) {
          secretsFound.push({
            type: p.name,
            match: m.length > 10 ? `${m.substring(0, 4)}***${m.substring(m.length - 4)}` : '***',
            severity: 'CRITICAL',
            rec: p.rec,
          });
        }
      }
    }

    const hasSecrets = secretsFound.length > 0;
    const summary = hasSecrets
      ? `🔴 CRITICAL: DSH Security Service detected ${secretsFound.length} hardcoded secret(s)!`
      : '🟢 CLEAN: DSH Security Service detected no hardcoded secrets or API keys.';

    return { summary, details: { hasSecrets, secretsFound } };
  }
}

// 3. Define Cordis AST Analyzer Service
export class ASTAnalyzerService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'astAnalyzer', true);
  }

  analyze(inputData: string) {
    const issues: Array<{ category: string; issue: string; snippet: string }> = [];
    const lines = inputData.split('\n');

    lines.forEach((line) => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const added = line.substring(1).trim();
        if (/console\.(log|debug)\s*\(/.test(added)) {
          issues.push({ category: 'Clean Code', issue: 'Leftover console statement', snippet: added });
        }
        if (/:[\s]*any\b|as[\s]+any\b/.test(added)) {
          issues.push({ category: 'Type Safety', issue: 'Unsafe "any" type', snippet: added });
        }
      }
    });

    const score = Math.max(0, 100 - issues.length * 15);
    const summary = `AST Score: ${score}/100, DSH Static Issues: ${issues.length}`;
    return { summary, details: { score, issuesCount: issues.length, issues } };
  }
}

// 4. Define Cordis Web Cleaner Service
export class WebCleanerService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'webCleaner', true);
  }

  clean(inputData: string) {
    let cleaned = inputData
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length > 3000) cleaned = cleaned.substring(0, 3000) + '...';
    const summary = `Cleaned markdown (${cleaned.length} chars)`;
    return { summary, details: { cleanedMarkdown: cleaned } };
  }
}

// 5. Tool Adapter definition
export const deepseekHarnessTool = createTool({
  id: 'deepseek-harness-adapter',
  description: 'Executes DeepSeek Harness (DSH) Cordis Services registered on the `ctx` context object.',
  inputSchema: z.object({
    pluginName: z.enum(['dsh-security-scanner', 'dsh-ast-analyzer', 'dsh-web-cleaner']).describe('DeepSeek Harness plugin/service name'),
    inputData: z.string().describe('Input payload string'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    plugin: z.string(),
    summary: z.string(),
    details: z.any(),
    dshExecutionLog: z.string(),
  }),
  execute: async ({ pluginName, inputData }) => {
    // Initialize Cordis Context Engine
    const ctx = new Context();

    // Instantiate Cordis Services directly onto Context object `ctx`
    const securityScanner = new SecurityScannerService(ctx);
    const astAnalyzer = new ASTAnalyzerService(ctx);
    const webCleaner = new WebCleanerService(ctx);

    const startTime = Date.now();
    let result: { summary: string; details: any };

    // EXECUTION CALLS CORDIS `ctx` SERVICE METHODS DIRECTLY!
    if (pluginName === 'dsh-security-scanner') {
      result = securityScanner.scan(inputData);
    } else if (pluginName === 'dsh-ast-analyzer') {
      result = astAnalyzer.analyze(inputData);
    } else {
      result = webCleaner.clean(inputData);
    }

    const durationMs = Date.now() - startTime;
    const dshExecutionLog = `[DSH Service Log] Plugin '${pluginName}' executed via ctx.${pluginName} service in ${durationMs}ms.`;

    return {
      success: true,
      plugin: pluginName,
      summary: result.summary,
      details: result.details,
      dshExecutionLog,
    };
  },
});

export default deepseekHarnessTool;
