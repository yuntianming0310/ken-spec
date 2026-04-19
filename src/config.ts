import path from 'node:path';
import { parse } from 'yaml';
import { readTextOrEmpty } from './fs.js';
import { getDefaultConfig } from './templates.js';

export interface ToolToggle {
  enabled: boolean;
}

export interface KenSpecConfig {
  injectAgentsMd: boolean;
  injectClaudeMd: boolean;
  codex: ToolToggle;
  claude: ToolToggle;
}

export async function loadConfig(projectRoot: string): Promise<KenSpecConfig> {
  const configPath = path.join(projectRoot, '.ken_spec', 'config.yaml');
  const content = await readTextOrEmpty(configPath);

  if (!content.trim()) {
    return getDefaultConfig();
  }

  const parsed = parse(content) as Partial<KenSpecConfig> | null;
  const defaults = getDefaultConfig();

  return {
    injectAgentsMd: parsed?.injectAgentsMd ?? defaults.injectAgentsMd,
    injectClaudeMd: parsed?.injectClaudeMd ?? defaults.injectClaudeMd,
    codex: {
      enabled: parsed?.codex?.enabled ?? defaults.codex.enabled,
    },
    claude: {
      enabled: parsed?.claude?.enabled ?? defaults.claude.enabled,
    },
  };
}
