export interface CleanOptions {
    dryRun?: boolean;
}
export interface CleanPlan {
    /** Skill directories (e.g. .codex/skills/postmortem) that will be removed. */
    skillDirs: string[];
    /** Root markdown files whose managed block will be stripped. */
    rootFiles: string[];
    /** Root files that were deleted because the managed block was their only content. */
    removedRootFiles: string[];
}
export declare function planClean(projectRoot: string): Promise<CleanPlan>;
export declare function cleanProject(projectRoot: string, options?: CleanOptions): Promise<CleanPlan>;
