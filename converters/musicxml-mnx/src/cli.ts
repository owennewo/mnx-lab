#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML, importMxl, exportMxl } from './index.js';
import {
  MNX_EXTENSION,
  MNX_READ_EXTENSIONS,
  resolveMnxInputPath,
  defaultMnxOutputPath,
  defaultMusicXmlOutputPath,
  checkMnxOutputExtension
} from './common/mnxFile.js';

function usage() {
  const inputArg = {
    import: '<input.xml>',
    export: `<input${MNX_EXTENSION}>`
  };
  const width = Math.max(inputArg.import.length, inputArg.export.length);

  console.error('Usage:');
  console.error(`  musicxml-mnx --import ${inputArg.import.padEnd(width)} [--output <output${MNX_EXTENSION}>]`);
  console.error(`  musicxml-mnx --export ${inputArg.export.padEnd(width)} [--output <output.xml>]`);
  console.error('');
  console.error('--output is optional: it defaults to the input name with the target');
  console.error(`extension. MNX is written as "${MNX_EXTENSION}"; MNX input may also be`);
  console.error(`${MNX_READ_EXTENSIONS.slice(1).join(' or ')}.`);
}

/**
 * Guards a *derived* output path against clobbering an existing file — without
 * this, `--export score${MNX_EXTENSION}` would default to `score.xml` and
 * silently overwrite the MusicXML the document was imported from. An explicit
 * `--output` is always obeyed; this only applies when we chose the name.
 */
async function assertDerivedOutputIsSafe(outputPath: string) {
  try {
    await fs.access(outputPath);
  } catch {
    return; // does not exist — safe to write
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
    const inputPath = path.resolve(args[importIndex + 1]);
    const outputPath = path.resolve(explicitOutput ?? defaultMnxOutputPath(inputPath));
    if (!explicitOutput) await assertDerivedOutputIsSafe(outputPath);

    const extWarning = checkMnxOutputExtension(outputPath);
    if (extWarning) console.warn(`  warning: ${extWarning}`);

    console.log(`Importing MusicXML: ${inputPath}...`);
    // Read as BYTES and sniff: `.mxl` is a zip, and it is what most editors
    // export by default, so deciding from the extension alone would refuse
    // files that are perfectly readable (and accept ones that are not).
    const bytes = new Uint8Array(await fs.readFile(inputPath));
    const mnx = await importMxl(bytes, {
      onWarning: msg => console.warn(`  warning: ${msg}`)
    });
    // Trailing newline: the corpus police's canonical form (check-scenarios),
    // so CLI output can land in scenarios/ unmodified.
    await fs.writeFile(outputPath, JSON.stringify(mnx, null, 2) + '\n', 'utf-8');
    console.log(`Conversion complete. Written to MNX: ${outputPath}`);
  } else if (exportIndex !== -1 && args[exportIndex + 1]) {
    // Tolerates a missing or non-preferred extension on the way in.
    const inputPath = resolveMnxInputPath(path.resolve(args[exportIndex + 1]));
    const outputPath = path.resolve(explicitOutput ?? defaultMusicXmlOutputPath(inputPath));
    if (!explicitOutput) await assertDerivedOutputIsSafe(outputPath);

    console.log(`Exporting MNX: ${inputPath}...`);
    const mnxContent = await fs.readFile(inputPath, 'utf-8');
    const mnx = JSON.parse(mnxContent);
    // `--output something.mxl` asks for the container; anything else is plain.
    if (outputPath.toLowerCase().endsWith('.mxl')) {
      const name = `${path.basename(outputPath, path.extname(outputPath))}.musicxml`;
      await fs.writeFile(outputPath, exportMxl(mnx, { scoreName: name }));
    } else {
      await fs.writeFile(outputPath, exportMusicXML(mnx), 'utf-8');
    }
    console.log(`Conversion complete. Written to MusicXML: ${outputPath}`);
  } else {
    usage();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error during conversion:', err);
  process.exit(1);
});
