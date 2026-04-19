import { Command } from 'commander';
import { initProject } from './commands/init.js';
import { syncProject } from './commands/sync.js';
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
    return program;
}
export async function runCli(argv = process.argv) {
    await createProgram().parseAsync(argv);
}
