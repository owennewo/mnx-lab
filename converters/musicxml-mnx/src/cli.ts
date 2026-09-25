#!/usr/bin/env node
import * as fs from 'fs/promises';
import { realpathSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { importMusicXML, exportMusicXML, importMxl, exportMxl } from './index.js';
import {
  MNX_EXTENSION,
  MNX_READ_EXTENSIONS,
  resolveMnxInputPath,
  defaultMnxOutputPath,
  defaultMusicXmlOutputPath,
  checkMnxOutputExtension
} from './common/mnxFile.js';

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
  const inputArg = {
    import: '<input.xml>',
    export: `<input${MNX_EXTENSION}>`
  };
  const width = Math.max(inputArg.import.length, inputArg.export.length);

  io.error('Usage:');
  io.error(`  musicxml-mnx --import ${inputArg.import.padEnd(width)} [--output <output${MNX_EXTENSION}>]`);
  io.error(`  musicxml-mnx --export ${inputArg.export.padEnd(width)} [--output <output.xml>]`);
  io.error('');
  io.error('  --encoding-date   stamp today into the encoding block on either direction');
  io.error('');
  io.error('--output is optional: it defaults to the input name with the target');
  io.error(`extension. MNX is written as "${MNX_EXTENSION}"; MNX input may also be`);
  io.error(`${MNX_READ_EXTENSIONS.slice(1).join(' or ')}.`);
}

/**
 * `--encoding-date` stamps today into the encoding block, in either direction.
 *
 * Opt-in because derived files are committed here (converters/fixtures/,
 * scenarios/): a timestamp in the output would make every regeneration a diff.
 * The export used to stamp one unconditionally, which is exactly the wart the
 * byte-for-byte fixture test had to mask.
 */
function encodingDateOption(args: string[]): { encodingDate?: string } {
  return args.includes('--encoding-date')
    ? { encodingDate: new Date().toISOString().slice(0, 10) }
    : {};
}

/**
 * Guards a *derived* output path against clobbering an existing file — without
 * this, `--export score${MNX_EXTENSION}` would default to `score.xml` and
 * silently overwrite the MusicXML the document was imported from. An explicit
 * `--output` is always obeyed; this only applies when we chose the name.
 * Returns false (having said why) when the write must not happen.
 */
async function derivedOutputIsSafe(outputPath: string, io: CliIo): Promise<boolean> {
  try {
    await fs.access(outputPath);
  } catch {
    return true; // does not exist — safe to write
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
    const inputPath = path.resolve(args[importIndex + 1]);
    const outputPath = path.resolve(explicitOutput ?? defaultMnxOutputPath(inputPath));
    if (!explicitOutput && !(await derivedOutputIsSafe(outputPath, io))) return 1;

    const extWarning = checkMnxOutputExtension(outputPath);
    if (extWarning) io.warn(`  warning: ${extWarning}`);

    io.log(`Importing MusicXML: ${inputPath}...`);
    // Read as BYTES and sniff: `.mxl` is a zip, and it is what most editors
    // export by default, so deciding from the extension alone would refuse
    // files that are perfectly readable (and accept ones that are not).
    const bytes = new Uint8Array(await fs.readFile(inputPath));
    const mnx = await importMxl(bytes, {
      onWarning: msg => io.warn(`  warning: ${msg}`),
      ...encodingDateOption(args)
    });
    // Trailing newline: the corpus police's canonical form (check-scenarios),
    // so CLI output can land in scenarios/ unmodified.
    await fs.writeFile(outputPath, JSON.stringify(mnx, null, 2) + '\n', 'utf-8');
    io.log(`Conversion complete. Written to MNX: ${outputPath}`);
  } else if (exportIndex !== -1 && args[exportIndex + 1]) {
    // Tolerates a missing or non-preferred extension on the way in.
    const inputPath = resolveMnxInputPath(path.resolve(args[exportIndex + 1]));
    const outputPath = path.resolve(explicitOutput ?? defaultMusicXmlOutputPath(inputPath));
    if (!explicitOutput && !(await derivedOutputIsSafe(outputPath, io))) return 1;

    io.log(`Exporting MNX: ${inputPath}...`);
    const mnxContent = await fs.readFile(inputPath, 'utf-8');
    const mnx = JSON.parse(mnxContent);
    const onWarning = (msg: string) => io.warn(`  warning: ${msg}`);
    // `--output something.mxl` asks for the container; anything else is plain.
    if (outputPath.toLowerCase().endsWith('.mxl')) {
      const name = `${path.basename(outputPath, path.extname(outputPath))}.musicxml`;
      await fs.writeFile(
        outputPath,
        exportMxl(mnx, { scoreName: name, onWarning, ...encodingDateOption(args) })
      );
    } else {
      await fs.writeFile(
        outputPath,
        exportMusicXML(mnx, { onWarning, ...encodingDateOption(args) }),
        'utf-8'
      );
    }
    io.log(`Conversion complete. Written to MusicXML: ${outputPath}`);
  } else {
    usage(io);
    return 1;
  }
  return 0;
}

/**
 * True when this module is the program being run (`musicxml-mnx`, a symlink
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
