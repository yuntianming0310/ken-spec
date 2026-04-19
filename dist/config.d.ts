export interface ToolToggle {
    enabled: boolean;
}
export interface KenSpecConfig {
    injectAgentsMd: boolean;
    injectClaudeMd: boolean;
    codex: ToolToggle;
    claude: ToolToggle;
}
export declare function loadConfig(projectRoot: string): Promise<KenSpecConfig>;
