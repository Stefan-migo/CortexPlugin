import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, basename, extname } from 'path';
import { createHash } from 'crypto';

export interface TemplateOptions {
  projectName: string;
  projectType: 'default' | 'api' | 'web' | 'cli' | 'lib';
  date: string;
  year: string;
}

const TEMPLATE_DIR = join(__dirname, '..', 'template');

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.db', '.sqlite',
]);

function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return !BINARY_EXTENSIONS.has(ext) && !filePath.endsWith('.gitkeep');
}

function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function substituteVariables(content: string, options: TemplateOptions): string {
  return content
    .replace(/\{PROJECT_NAME\}/g, options.projectName)
    .replace(/\{PROJECT_NAME_KEBAB\}/g, kebabCase(options.projectName))
    .replace(/\{DATE\}/g, options.date)
    .replace(/\{YEAR\}/g, options.year);
}

export function collectFiles(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }
  return files;
}

export function copyTemplate(targetDir: string, options: TemplateOptions): string[] {
  const copiedFiles: string[] = [];
  const allFiles = collectFiles(TEMPLATE_DIR, TEMPLATE_DIR);

  for (const file of allFiles) {
    const sourcePath = join(TEMPLATE_DIR, file);
    const targetPath = join(targetDir, file);
    const targetParent = join(targetPath, '..');

    mkdirSync(targetParent, { recursive: true });

    if (isTextFile(sourcePath)) {
      let content = readFileSync(sourcePath, 'utf-8');
      content = substituteVariables(content, options);
      writeFileSync(targetPath, content, 'utf-8');
    } else {
      writeFileSync(targetPath, readFileSync(sourcePath));
    }

    copiedFiles.push(file);
  }

  return copiedFiles;
}

export function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export function hashDirectory(dir: string): string[] {
  const allFiles: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.name === '.cortex' || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      allFiles.push(...hashDirectory(fullPath));
    } else {
      allFiles.push(fullPath);
    }
  }
  return allFiles;
}
