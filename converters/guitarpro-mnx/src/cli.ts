#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
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

function usage() {
  const importArg = `<input${GP_WRITE_EXTENSION}>`;
  const exportArg = `<input${MNX_EXTENSION}>`;
  const width = Math.max(importArg.length, exportArg.length);

  console.error('Usage:');
  console.error(`  guitarpro-mnx --import ${importArg.padEnd(width)} [--output <output${MNX_EXTENSION}>]`);
  console.error(`  guitarpro-mnx --export ${exportArg.padEnd(width)} [--output <output${GP_WRITE_EXTENSION}>]`);
  console.error('');
  console.error(`Reads ${GP_READ_EXTENSIONS.join(', ')}; writes ${GP_WRITE_EXTENSION} only`);
  console.error('(no maintained tool can write gp3/gp4/gp5).');
  console.error(`MNX is written as "${MNX_EXTENSION}"; ${MNX_READ_EXTENSIONS.slice(1).join(' and ')} are also read.`);
}

/** Derived names must never silently overwrite an existing file. */
async function assertDerivedOutputIsSafe(outputPath: string) {
  try {
    await fs.access(outputPath);
  } catch {
    return;
  }
  console.error(
    `Refusing to overwrite existing file: ${outputPath}\n` +
      `This name was derived from the input. Pass --output explicitly to overwrite it.`
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
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
    if (!explicitOutput) await assertDerivedOutputIsSafe(outputPath);

    console.log(`Importing Guitar Pro: ${inputPath}...`);
    const data = await fs.readFile(inputPath);
    const mnx = importGuitarPro(new Uint8Array(data), {
      onWarning: msg => console.warn(`  warning: ${msg}`)
    });
    // Trailing newline: the corpus police's canonical form (check-scenarios),
    // so CLI output can land in scenarios/ unmodified.
    await fs.writeFile(outputPath, JSON.stringify(mnx, null, 2) + '\n', 'utf-8');
    console.log(`Conversion complete. Written to MNX: ${outputPath}`);
  } else if (exportIndex !== -1 && args[exportIndex + 1]) {
    const inputPath = resolveInputPath(
      path.resolve(args[exportIndex + 1]),
      MNX_READ_EXTENSIONS
    );
    const outputPath = path.resolve(
      explicitOutput ?? defaultGuitarProOutputPath(inputPath)
    );
    if (!explicitOutput) await assertDerivedOutputIsSafe(outputPath);

    console.log(`Exporting MNX: ${inputPath}...`);
    const mnx = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
    const bytes = exportGuitarPro(mnx, {
      onWarning: msg => console.warn(`  warning: ${msg}`)
    });
    await fs.writeFile(outputPath, bytes);
    console.log(`Conversion complete. Written to Guitar Pro: ${outputPath}`);
  } else {
    usage();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error during conversion:', err);
  process.exit(1);
});
