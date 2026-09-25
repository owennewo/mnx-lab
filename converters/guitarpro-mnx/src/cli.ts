#!/usr/bin/env node
import * as fs from 'fs/promises';
import { realpathSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { importGuitarPro, exportGuitarPro } from './index.js';
import {
  MNX_EXTENSION,
  MNX_READ_EXTENSIONS,
  GP_WRITE_EXTENSION,
  GP_READ_EXTENSIONS,
  resolveInputPath,
  defaultMnxOutputPath,
  defaultGuitarProOutputPath
} from './common/gpFile.js';

/**
 * Where the CLI writes. `console` satisfies it; tests pass a recorder so the
 * whole command runs in-process instead of paying a process spawn per case.
 */
export interface CliIo {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

function usage(io: CliIo) {
  const importArg = `<input${GP_WRITE_EXTENSION}>`;
  const exportArg = `<input${MNX_EXTENSION}>`;
  const width = Math.max(importArg.length, exportArg.length);

  io.error('Usage:');
  io.error(`  guitarpro-mnx --import ${importArg.padEnd(width)} [--output <output${MNX_EXTENSION}>]`);
  io.error(`  guitarpro-mnx --export ${exportArg.padEnd(width)} [--output <output${GP_WRITE_EXTENSION}>]`);
  io.error('');
  io.error('  --encoding-date   stamp today into _x.mnxLab.encoding.date on import');
  io.error('');
  io.error(`Reads ${GP_READ_EXTENSIONS.join(', ')}; writes ${GP_WRITE_EXTENSION} only`);
  io.error('(no maintained tool can write gp3/gp4/gp5).');
  io.error(`MNX is written as "${MNX_EXTENSION}"; ${MNX_READ_EXTENSIONS.slice(1).join(' and ')} are also read.`);
}

/**
 * Derived names must never silently overwrite an existing file. Returns false
 * (having said why) when the write must not happen.
 */
async function derivedOutputIsSafe(outputPath: string, io: CliIo): Promise<boolean> {
  try {
    await fs.access(outputPath);
  } catch {
    return true;
  }
  io.error(
    `Refusing to overwrite existing file: ${outputPath}\n` +
      `This name was derived from the input. Pass --output explicitly to overwrite it.`
  );
  return false;
}

/**
 * The whole command, minus the process: `args` is what follows the program
 * name, and the result is the exit status. A conversion failure throws — the
 * executable entry below reports it and exits 1.
 */
export async function main(args: string[], io: CliIo = console): Promise<number> {
  const importIndex = args.indexOf('--import');
  const exportIndex = args.indexOf('--export');
  const outputIndex = args.indexOf('--output');
  const explicitOutput = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

  if (importIndex !== -1 && args[importIndex + 1]) {
    const inputPath = resolveInputPath(
      path.resolve(args[importIndex + 1]),
      GP_READ_EXTENSIONS
    );
    const outputPath = path.resolve(explicitOutput ?? defaultMnxOutputPath(inputPath));
    if (!explicitOutput && !(await derivedOutputIsSafe(outputPath, io))) return 1;

    io.log(`Importing Guitar Pro: ${inputPath}...`);
    const data = await fs.readFile(inputPath);
    const mnx = importGuitarPro(new Uint8Array(data), {
      onWarning: msg => io.warn(`  warning: ${msg}`),
      // `_x.mnxLab.encoding` always names this converter and its version. The
      // DATE is opt-in: derived files are committed here (converters/fixtures,
      // scenarios/), and a timestamp would make every regeneration a diff.
      ...(args.includes('--encoding-date')
        ? { encodingDate: new Date().toISOString().slice(0, 10) }
        : {})
    });
    // Trailing newline: the corpus police's canonical form (check-scenarios),
    // so CLI output can land in scenarios/ unmodified.
    await fs.writeFile(outputPath, JSON.stringify(mnx, null, 2) + '\n', 'utf-8');
    io.log(`Conversion complete. Written to MNX: ${outputPath}`);
  } else if (exportIndex !== -1 && args[exportIndex + 1]) {
    const inputPath = resolveInputPath(
      path.resolve(args[exportIndex + 1]),
      MNX_READ_EXTENSIONS
    );
    const outputPath = path.resolve(
      explicitOutput ?? defaultGuitarProOutputPath(inputPath)
    );
    if (!explicitOutput && !(await derivedOutputIsSafe(outputPath, io))) return 1;

    io.log(`Exporting MNX: ${inputPath}...`);
    const mnx = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
    const bytes = exportGuitarPro(mnx, {
      onWarning: msg => io.warn(`  warning: ${msg}`)
    });
    await fs.writeFile(outputPath, bytes);
    io.log(`Conversion complete. Written to Guitar Pro: ${outputPath}`);
  } else {
    usage(io);
    return 1;
  }
  return 0;
}

/**
 * True when this module is the program being run (`guitarpro-mnx`, a symlink
 * to `dist/cli.js`, or a runner handed `src/cli.ts`) rather than imported.
 */
function isExecutableEntry(): boolean {
  const script = process.argv[1];
  if (!script) return false;
  try {
    return realpathSync(script) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isExecutableEntry()) {
  main(process.argv.slice(2)).then(
    status => {
      if (status !== 0) process.exit(status);
    },
    err => {
      console.error('Error during conversion:', err);
      process.exit(1);
    }
  );
}
