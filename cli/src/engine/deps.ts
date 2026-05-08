import { execSync } from 'child_process';

export interface DepStatus {
  name: string;
  installed: boolean;
  version?: string;
  required: boolean;
}

function exec(command: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { stdout: err.stdout || err.stderr || '', exitCode: err.status ?? 1 };
  }
}

export function checkDeps(): DepStatus[] {
  const results: DepStatus[] = [];

  const node = exec('node --version');
  results.push({
    name: 'Node.js',
    installed: node.exitCode === 0,
    version: node.stdout.replace(/^v/, ''),
    required: true,
  });

  if (node.exitCode === 0) {
    const nodeMajor = parseInt(node.stdout.replace(/^v/, '').split('.')[0], 10);
    if (nodeMajor < 18) {
      results[results.length - 1].installed = false;
    }
  }

  const engram = exec('which engram 2>/dev/null || command -v engram 2>/dev/null');
  results.push({
    name: 'Engram',
    installed: engram.exitCode === 0,
    version: engram.exitCode === 0 ? 'found' : undefined,
    required: true,
  });

  const graphify = exec('python3 -c "import graphify" 2>/dev/null');
  results.push({
    name: 'Graphify',
    installed: graphify.exitCode === 0,
    required: true,
  });

  const speckit = exec('which speckit 2>/dev/null || which specify 2>/dev/null || command -v speckit 2>/dev/null || command -v specify 2>/dev/null');
  results.push({
    name: 'Spec-Kit',
    installed: speckit.exitCode === 0,
    version: speckit.exitCode === 0 ? 'found' : undefined,
    required: true,
  });

  return results;
}
