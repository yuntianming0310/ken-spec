import path from 'node:path';
import { Command } from 'commander';
import { initProject } from './commands/init.js';
import { syncProject } from './commands/sync.js';
import { cleanProject } from './commands/clean.js';
import { runDoctor, summarizeReport } from './commands/doctor.js';
export function createProgram() {
    const program = new Command();
    program
        .name('ken-spec')
        .description('Minimal personal AI spec sync tool for Codex and Claude');
    program
        .command('init')
        .description('Initialize .ken_spec in the current project')
        .action(async () => {
        await initProject(process.cwd());
    });
    program
        .command('sync')
        .description('Sync .ken_spec into Codex/Claude entrypoints')
        .action(async () => {
        await syncProject(process.cwd());
    });
    program
        .command('doctor')
        .description('Validate .ken_spec state and detect drift')
        .action(async () => {
        const report = await runDoctor(process.cwd());
        printDoctorReport(report);
        if (!report.ok) {
            process.exit(1);
        }
    });
    program
        .command('clean')
        .description('Remove files synced from .ken_spec (managed blocks + generated skills)')
        .option('--dry-run', 'Show what would be removed without deleting', false)
        .action(async (opts) => {
        const dryRun = opts.dryRun === true;
        const plan = await cleanProject(process.cwd(), { dryRun });
        printCleanPlan(plan, { dryRun, projectRoot: process.cwd() });
    });
    return program;
}
function printDoctorReport(report) {
    if (report.findings.length === 0) {
        console.log('ken-spec doctor: no issues found.');
        return;
    }
    for (const finding of report.findings) {
        const tag = `[${finding.severity}]`.padEnd(8);
        console.log(`${tag}${finding.message}`);
    }
    console.log(`\n${summarizeReport(report)}`);
}
function printCleanPlan(plan, context) {
    const verb = context.dryRun ? 'would remove' : 'removed';
    const header = context.dryRun ? 'ken-spec clean (dry-run)' : 'ken-spec clean';
    console.log(header);
    if (plan.skillDirs.length === 0 && plan.rootFiles.length === 0) {
        console.log('  nothing to remove');
        return;
    }
    for (const dir of plan.skillDirs) {
        console.log(`  ${verb} ${path.relative(context.projectRoot, dir)}`);
    }
    for (const file of plan.rootFiles) {
        const rel = path.relative(context.projectRoot, file);
        const deleted = plan.removedRootFiles.includes(file);
        const what = deleted ? `${rel} (file deleted — was empty after block removal)` : `managed block in ${rel}`;
        console.log(`  ${verb} ${what}`);
    }
}
export async function runCli(argv = process.argv) {
    await createProgram().parseAsync(argv);
}
