import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { hashFile, hashDirectory, collectFiles, TemplateOptions } from './template';

export interface ManifestFile {
  path: string;
  hash: string;
}

export interface Manifest {
  templateVersion: string;
  createdAt: string;
  projectName: string;
  files: ManifestFile[];
}

export function generateManifest(targetDir: string, options: TemplateOptions): Manifest {
  const cortexDir = join(targetDir, '.cortex');
  if (!existsSync(cortexDir)) {
    mkdirSync(cortexDir, { recursive: true });
  }

  const filePaths = hashDirectory(targetDir);
  const files: ManifestFile[] = filePaths.map((fp) => ({
    path: fp.replace(targetDir + '/', ''),
    hash: hashFile(fp),
  })).filter((f) => !f.path.startsWith('.cortex/') && !f.path.startsWith('.git/'));

  const manifest: Manifest = {
    templateVersion: '1.0.0',
    createdAt: options.date,
    projectName: options.projectName,
    files,
  };

  writeFileSync(
    join(cortexDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  return manifest;
}

export function detectChanges(
  projectDir: string,
  templateDir: string,
  manifest: Manifest,
): { added: string[]; modified: string[]; userModified: string[]; deleted: string[] } {
  const templateFiles = collectFiles(templateDir, templateDir);

  const added: string[] = [];
  const modified: string[] = [];
  const userModified: string[] = [];
  const deleted: string[] = [];

  const manifestFileMap = new Map<string, string>();
  for (const f of manifest.files) {
    manifestFileMap.set(f.path, f.hash);
  }

  const templateSet = new Set(templateFiles);

  for (const file of templateFiles) {
    const templatePath = join(templateDir, file);
    const templateHash = hashFile(templatePath);
    const projectPath = join(projectDir, file);

    const manifestHash = manifestFileMap.get(file);

    if (!manifestHash) {
      added.push(file);
    } else if (templateHash !== manifestHash) {
      if (existsSync(projectPath)) {
        const currentHash = hashFile(projectPath);
        if (currentHash === manifestHash) {
          modified.push(file);
        } else {
          userModified.push(file);
        }
      } else {
        userModified.push(file);
      }
    }
  }

  for (const f of manifest.files) {
    if (!templateSet.has(f.path)) {
      deleted.push(f.path);
    }
  }

  return { added, modified, userModified, deleted };
}
