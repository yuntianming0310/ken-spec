import path from 'node:path';
import { parse } from 'yaml';
import { readTextOrEmpty } from './fs.js';
import { getDefaultConfig } from './templates.js';
export async function loadConfig(projectRoot) {
    const configPath = path.join(projectRoot, '.ken_spec', 'config.yaml');
    const content = await readTextOrEmpty(configPath);
    if (!content.trim()) {
        return getDefaultConfig();
    }
    const parsed = parse(content);
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
