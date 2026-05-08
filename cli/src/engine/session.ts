import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { execSync } from 'child_process';
import { MCPClient } from '../utils/mcp';
import { info, success, warn, error, step } from '../utils/logger';

export interface SessionInfo {
  sessionId: string;
  projectName: string;
  startedAt: string;
  preludeFile: string;
}

export interface Retrospective {
  content: string;
  filePath: string;
}

export function generateSessionId(): string {
  const date = new Date().toISOString().split('T')[0];
  const suffix = randomBytes(4).toString('hex');
  return `cortex-${date}-${suffix}`;
}

export async function openSession(projectDir: string, sessionId: string): Promise<boolean> {
  step('Opening Engram session via MCP');

  let projectName = 'unknown';
  const manifestPath = join(projectDir, '.cortex', 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      projectName = manifest.projectName || 'unknown';
    } catch {
    }
  }

  try {
    const client = new MCPClient('engram', ['mcp']);
    await client.initialize();
    await client.callTool('mem_session_start', { id: sessionId });
    await client.close();
    success('Engram session started');
  } catch (e: any) {
    warn(`Engram MCP not available: ${e.message || 'unknown error'}`);
    info('Continuing without session tracking');
  }

  step('Writing session metadata');
  const cortexDir = join(projectDir, '.cortex');
  if (!existsSync(cortexDir)) {
    mkdirSync(cortexDir, { recursive: true });
  }

  const sessionInfo: SessionInfo = {
    sessionId,
    projectName,
    startedAt: new Date().toISOString(),
    preludeFile: '.cortex/prelude.md',
  };

  writeFileSync(
    join(cortexDir, 'session.json'),
    JSON.stringify(sessionInfo, null, 2),
    'utf-8',
  );

  success(`Session ${sessionId} opened`);
  return true;
}

export async function closeSession(
  projectDir: string,
  sessionId: string,
  summary?: string,
): Promise<boolean> {
  step('Finalizing Engram session');

  try {
    const client = new MCPClient('engram', ['mcp']);
    await client.initialize();

    if (summary) {
      try {
        await client.callTool('mem_session_summary', {
          session_id: sessionId,
          content: summary,
        });
        success('Session summary saved');
      } catch (e: any) {
        warn(`Failed to save session summary: ${e.message}`);
      }
    }

    try {
      await client.callTool('mem_session_end', { id: sessionId });
      success('Session ended via Engram');
    } catch (e: any) {
      warn(`Failed to end session via Engram: ${e.message}`);
    }

    await client.close();
  } catch (e: any) {
    warn(`Engram MCP not available: ${e.message}`);
  }

  step('Exporting to wiki');
  try {
    const scriptPath = join(projectDir, 'scripts', 'engram-export-wiki.sh');
    if (existsSync(scriptPath)) {
      execSync(`bash "${scriptPath}"`, {
        cwd: projectDir,
        stdio: 'pipe',
        timeout: 30000,
      });
      success('Wiki export complete');
    } else {
      execSync('engram obsidian-export --vault wiki', {
        cwd: projectDir,
        stdio: 'pipe',
        timeout: 30000,
      });
      success('Wiki export complete');
    }
  } catch (e: any) {
    warn(`Wiki export skipped: ${e.message}`);
  }

  step('Cleaning up session files');
  const sessionPath = join(projectDir, '.cortex', 'session.json');
  try {
    if (existsSync(sessionPath)) {
      unlinkSync(sessionPath);
      success('Session file cleaned up');
    }
  } catch (e: any) {
    warn(`Failed to clean up session file: ${e.message}`);
  }

  return true;
}

export function getSessionInfo(projectDir: string): SessionInfo | null {
  const sessionPath = join(projectDir, '.cortex', 'session.json');
  if (!existsSync(sessionPath)) {
    return null;
  }

  try {
    const raw = readFileSync(sessionPath, 'utf-8');
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return null;
  }
}

export function generateRetrospective(
  projectDir: string,
  sessionInfo: SessionInfo,
  summary: string,
  warnings: string[],
): string {
  const startDate = new Date(sessionInfo.startedAt);
  const endDate = new Date();
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHours = Math.floor(durationMs / 3600000);
  const durationMinutes = Math.floor((durationMs % 3600000) / 60000);
  const durationStr = durationHours > 0
    ? `${durationHours}h ${durationMinutes}m`
    : `${durationMinutes}m`;

  const dateStr = startDate.toISOString().split('T')[0];

  const gaps: string[] = [];
  const suggestions: string[] = [];

  const warnText = warnings.join(' ').toLowerCase();
  if (warnText.includes('graphify') || !existsSync(join(projectDir, 'wiki', 'graph', 'graph.json'))) {
    gaps.push('Graphify report not found at session start');
    suggestions.push('Run `graphify . --update` to enable code structure awareness');
  }
  if (warnText.includes('speckit') || !existsSync(join(projectDir, '.specify'))) {
    gaps.push('Spec-Kit tasks or plans not found');
    suggestions.push('Use `/speckit.specify` before starting complex features');
  }
  if (warnText.includes('engram')) {
    gaps.push('Engram MCP unavailable during session');
    suggestions.push('Ensure Engram MCP is available for memory persistence');
  }

  if (gaps.length === 0) {
    gaps.push('None detected');
  }
  if (suggestions.length === 0) {
    suggestions.push('Continue with current workflow — no major gaps detected');
  }

  return `# Session Retrospective

**Session**: ${sessionInfo.sessionId}
**Project**: ${sessionInfo.projectName}
**Date**: ${dateStr}
**Duration**: ${durationStr}

## Summary
${summary || 'No summary provided'}

## What Went Well
- Session completed successfully
${summary ? `- Goal: ${summary}` : ''}

## What Could Be Improved
${gaps.map((g) => `- ${g}`).join('\n')}

## Context Gaps
${gaps.map((g) => `- ${g}`).join('\n')}

## Suggestions for Next Session
${suggestions.map((s) => `- ${s}`).join('\n')}
`;
}

export function saveRetrospective(projectDir: string, content: string): string {
  const retroDir = join(projectDir, '.cortex', 'retrospectives');
  mkdirSync(retroDir, { recursive: true });

  const match = content.match(/\*\*Session\*\*: (.+)/);
  const sessionId = match ? match[1].trim() : `session-${Date.now()}`;
  const dateStr = new Date().toISOString().split('T')[0];

  const fileName = `${dateStr}-${sessionId}.md`;
  const filePath = join(retroDir, fileName);
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}
