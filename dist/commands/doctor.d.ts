export type DoctorSeverity = 'error' | 'warn' | 'info';
export interface DoctorFinding {
    severity: DoctorSeverity;
    message: string;
}
export interface DoctorReport {
    findings: DoctorFinding[];
    /** true if there are no errors (warnings and info are allowed). */
    ok: boolean;
}
export declare function runDoctor(projectRoot: string): Promise<DoctorReport>;
export declare function summarizeReport(report: DoctorReport): string;
