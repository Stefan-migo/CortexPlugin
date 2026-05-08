import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface CortexConfig {
  lastProject?: string;
  projects?: string[];
}

const CONFIG_DIR = join(homedir(), '.cortex');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function readConfig(): CortexConfig {
  ensureConfigDir();
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as CortexConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: CortexConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function addProject(name: string): void {
  const config = readConfig();
  config.lastProject = name;
  if (!config.projects) config.projects = [];
  if (!config.projects.includes(name)) {
    config.projects.push(name);
  }
  writeConfig(config);
}
