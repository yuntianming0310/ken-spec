export interface SkillSource {
    name: string;
    content: string;
}
export declare function loadSkills(projectRoot: string): Promise<SkillSource[]>;
export declare function renderSkillFile(skill: SkillSource): string;
export declare function renderRootManagedBlock(): string;
