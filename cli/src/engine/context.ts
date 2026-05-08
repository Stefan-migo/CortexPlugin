import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { info, warn, step, success } from '../utils/logger';
import { MCPClient } from '../utils/mcp';

interface ContextItem {
  source: 'engram' | 'graphify' | 'speckit' | 'manifest';
  title: string;
  content: string;
  score: number;
  type: string;
  date: Date;
}

interface ManifestInfo {
  projectName: string;
  templateVersion: string;
  files?: Array<{ path: string; hash: string }>;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function getRecencyScore(date: Date): number {
  const diff = Date.now() - date.getTime();
  const day = 86400000;
  if (diff < day) return 1.0;
  if (diff < 7 * day) return 0.8;
  if (diff < 30 * day) return 0.5;
  return 0.2;
}

function getTypeScore(type: string): number {
  const scores: Record<string, number> = {
    architecture: 1.0,
    decision: 0.9,
    bugfix: 0.8,
    discovery: 0.6,
    learning: 0.5,
    general: 0.3,
  };
  return scores[type] ?? 0.3;
}

function calculateScore(date: Date, type: string, projectMatches: boolean): number {
  const recency = getRecencyScore(date);
  const typeScore = getTypeScore(type);
  const relevance = 0.5 + (projectMatches ? 0.5 : 0);
  return recency * 0.4 + typeScore * 0.3 + relevance * 0.3;
}

function readContextBudget(projectDir: string): number {
  const configPath = join(projectDir, '.cortex', 'config.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (typeof config.contextBudget === 'number' && config.contextBudget > 0) {
        return config.contextBudget;
      }
    } catch {}
  }
  return 4000;
}

async function fetchEngramContext(projectName: string): Promise<ContextItem[]> {
  try {
    const client = new MCPClient('engram', ['mcp']);
    await client.initialize();
    const result = await client.callTool('mem_context', { project: projectName });
    await client.close();
    if (result && result.content) {
      let text = '';
      if (Array.isArray(result.content)) {
        // MCP content array: [{ type: 'text', text: '...' }]
        text = result.content.map((c: any) => c.text || '').join('\n');
        // Try to unwrap if it's a JSON-stringified string or nested result
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed === 'string') {
            text = parsed;
          } else if (parsed && parsed.result) {
            text = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result, null, 2);
          } else if (parsed && parsed.content) {
            text = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content, null, 2);
          }
        } catch {
          // Not JSON — use raw text
        }
      } else if (typeof result.content === 'string') {
        text = result.content;
      } else {
        text = JSON.stringify(result.content, null, 2);
      }
      info('Engram context loaded via MCP');
      return [{
        source: 'engram',
        title: 'Previous Sessions Context',
        content: text,
        score: calculateScore(new Date(), 'general', true),
        type: 'general',
        date: new Date(),
      }];
    }
  } catch {
    warn('Engram MCP unavailable — trying CLI');
  }

  try {
    const result = execSync(`engram context "${projectName}"`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) {
      info('Engram context loaded');
      return [{
        source: 'engram',
        title: 'Previous Sessions Context',
        content: result.trim(),
        score: calculateScore(new Date(), 'general', true),
        type: 'general',
        date: new Date(),
      }];
    }
  } catch {
    warn('Engram context unavailable — skipping previous sessions');
  }

  return [];
}

async function fetchGraphifyContext(projectDir: string, projectName: string): Promise<ContextItem[]> {
  const graphJson = join(projectDir, 'wiki', 'graph', 'graph.json');

  if (!existsSync(graphJson)) {
    return fetchGraphifyContextStatic(projectDir);
  }

  try {
    const client = new MCPClient('python3', ['-m', 'graphify.serve', graphJson]);
    await client.initialize();

    const items: ContextItem[] = [];

    try {
      const queryResult = await client.callTool('query_graph', {
        question: projectName,
        depth: 2,
        token_budget: 1000,
      });
      const content = typeof queryResult === 'string' ? queryResult : JSON.stringify(queryResult, null, 2);
      if (content.trim()) {
        items.push({
          source: 'graphify',
          title: 'Codebase Graph Query',
          content,
          score: calculateScore(new Date(), 'architecture', true),
          type: 'architecture',
          date: new Date(),
        });
      }
    } catch {}

    try {
      const godResult = await client.callTool('god_nodes', { top_n: 5 });
      const content = typeof godResult === 'string' ? godResult : JSON.stringify(godResult, null, 2);
      if (content.trim()) {
        items.push({
          source: 'graphify',
          title: 'Key Concepts (God Nodes)',
          content,
          score: calculateScore(new Date(), 'architecture', true),
          type: 'architecture',
          date: new Date(),
        });
      }
    } catch {}

    await client.close();

    if (items.length > 0) {
      info('Graphify context loaded via MCP');
      return items;
    }
  } catch {
    warn('Graphify MCP unavailable — falling back to static report');
  }

  return fetchGraphifyContextStatic(projectDir);
}

function fetchGraphifyContextStatic(projectDir: string): ContextItem[] {
  const graphReport = join(projectDir, 'wiki', 'graph', 'GRAPH_REPORT.md');
  if (!existsSync(graphReport)) {
    warn('Graphify report not found');
    return [];
  }

  try {
    const content = readFileSync(graphReport, 'utf-8');
    const extracted: string[] = [];
    const lines = content.split('\n');
    let inSection = false;
    let sectionCounter = 0;

    for (const line of lines) {
      if (line.startsWith('## God Nodes')) {
        inSection = true;
        sectionCounter = 0;
      } else if (line.startsWith('## Community Summary')) {
        if (inSection) inSection = false;
        inSection = true;
        sectionCounter = 0;
      } else if (line.startsWith('## ') && inSection) {
        if (sectionCounter >= 3) {
          inSection = false;
          continue;
        }
        sectionCounter++;
      }
      if (inSection) extracted.push(line);
    }

    const section = extracted.join('\n').trim();
    if (section) {
      info('Graphify report loaded');
      return [{
        source: 'graphify',
        title: 'Codebase Structure (Static Report)',
        content: section,
        score: calculateScore(new Date(), 'architecture', true),
        type: 'architecture',
        date: new Date(),
      }];
    }
  } catch {
    warn('Failed to parse Graphify report');
  }

  return [];
}

function fetchSpeckitContext(projectDir: string): ContextItem[] {
  const items: ContextItem[] = [];
  const tasksDir = join(projectDir, '.specify', 'tasks');
  const plansDir = join(projectDir, '.specify', 'plans');

  if (existsSync(tasksDir)) {
    try {
      const entries = readdirSync(tasksDir);
      for (const entry of entries) {
        const fullPath = join(tasksDir, entry);
        const st = statSync(fullPath);
        if (!st.isFile()) continue;
        const content = readFileSync(fullPath, 'utf-8');
        items.push({
          source: 'speckit',
          title: `Task: ${entry}`,
          content: `**File**: \`${fullPath.replace(projectDir + '/', '')}\`\n\n${content.substring(0, 2000)}`,
          score: calculateScore(st.mtime, 'learning', true),
          type: 'learning',
          date: st.mtime,
        });
      }
    } catch {}
  }

  if (existsSync(plansDir)) {
    try {
      const entries = readdirSync(plansDir);
      for (const entry of entries) {
        const fullPath = join(plansDir, entry);
        const st = statSync(fullPath);
        if (!st.isFile()) continue;
        const content = readFileSync(fullPath, 'utf-8');
        items.push({
          source: 'speckit',
          title: `Plan: ${entry}`,
          content: `**File**: \`${fullPath.replace(projectDir + '/', '')}\`\n\n${content.substring(0, 2000)}`,
          score: calculateScore(st.mtime, 'architecture', true),
          type: 'architecture',
          date: st.mtime,
        });
      }
    } catch {}
  }

  if (items.length > 0) {
    info(`Spec-Kit context loaded (${items.length} items)`);
  } else {
    warn('No Spec-Kit tasks or plans found');
  }

  return items;
}

function fetchManifestContext(projectDir: string, projectName: string): ContextItem[] {
  const manifestPath = join(projectDir, '.cortex', 'manifest.json');
  if (!existsSync(manifestPath)) return [];

  try {
    const manifest: ManifestInfo = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const content = [
      `- **Template Version**: ${manifest.templateVersion}`,
      `- **Tracked Files**: ${manifest.files?.length || 0}`,
      `- **Project Name**: ${manifest.projectName}`,
    ].join('\n');

    info('Project manifest loaded');
    return [{
      source: 'manifest',
      title: 'Project Info',
      content,
      score: calculateScore(new Date(), 'general', true),
      type: 'general',
      date: new Date(),
    }];
  } catch {
    return [];
  }
}

export async function buildPrelude(projectDir: string, projectName: string): Promise<string> {
  step('Building context prelude');

  const sections: string[] = [];

  sections.push('# Cortex Session Prelude');
  sections.push('');
  sections.push(`**Project**: ${projectName}`);
  sections.push(`**Date**: ${new Date().toISOString().split('T')[0]}`);
  sections.push(`**Generated**: ${new Date().toISOString()}`);
  sections.push('');

  const [engramItems, graphifyItems, speckitItems, manifestItems] = await Promise.all([
    fetchEngramContext(projectName),
    fetchGraphifyContext(projectDir, projectName),
    fetchSpeckitContext(projectDir),
    fetchManifestContext(projectDir, projectName),
  ]);

  const allItems = [...engramItems, ...graphifyItems, ...speckitItems, ...manifestItems];
  allItems.sort((a, b) => b.score - a.score);

  const budget = readContextBudget(projectDir);
  let usedTokens = estimateTokens(sections.join('\n'));
  const included: ContextItem[] = [];
  const truncated: string[] = [];

  for (const item of allItems) {
    const itemTokens = estimateTokens(item.content);
    if (usedTokens + itemTokens <= budget) {
      included.push(item);
      usedTokens += itemTokens;
    } else {
      truncated.push(item.title);
    }
  }

  for (const item of included) {
    sections.push(`## ${item.title}`);
    sections.push('');
    sections.push(`**Source**: ${item.source} | **Score**: ${item.score.toFixed(2)} | **Type**: ${item.type}`);
    sections.push('');
    sections.push(item.content);
    sections.push('');
  }

  if (truncated.length > 0) {
    sections.push(`_${truncated.length} more items truncated (budget: ${budget} tokens)_`);
    sections.push('');
  }

  const cortexDir = join(projectDir, '.cortex');
  if (!existsSync(cortexDir)) {
    mkdirSync(cortexDir, { recursive: true });
  }

  const preludePath = join(cortexDir, 'prelude.md');
  writeFileSync(preludePath, sections.join('\n'), 'utf-8');
  success(`Prelude written to ${preludePath}`);
  return preludePath;
}
