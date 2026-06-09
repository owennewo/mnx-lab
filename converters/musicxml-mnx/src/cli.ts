#!/usr/bin/env ts-node
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from './index.js';

async function main() {
  const args = process.argv.slice(2);
  const importIndex = args.indexOf('--import');
  const exportIndex = args.indexOf('--export');
  const outputIndex = args.indexOf('--output');

  if (importIndex !== -1 && outputIndex !== -1) {
    const inputPath = path.resolve(args[importIndex + 1]);
    const outputPath = path.resolve(args[outputIndex + 1]);
    
    console.log(`Importing MusicXML: ${inputPath}...`);
    const xmlContent = await fs.readFile(inputPath, 'utf-8');
    const mnx = importMusicXML(xmlContent);
    await fs.writeFile(outputPath, JSON.stringify(mnx, null, 2), 'utf-8');
    console.log(`Conversion complete. Written to MNX: ${outputPath}`);
  } else if (exportIndex !== -1 && outputIndex !== -1) {
    const inputPath = path.resolve(args[exportIndex + 1]);
    const outputPath = path.resolve(args[outputIndex + 1]);
    
    console.log(`Exporting MNX: ${inputPath}...`);
    const mnxContent = await fs.readFile(inputPath, 'utf-8');
    const mnx = JSON.parse(mnxContent);
    const xml = exportMusicXML(mnx);
    await fs.writeFile(outputPath, xml, 'utf-8');
    console.log(`Conversion complete. Written to MusicXML: ${outputPath}`);
  } else {
    console.error('Usage:');
    console.error('  musicxml-mnx --import <input.xml> --output <output.json>');
    console.error('  musicxml-mnx --export <input.json> --output <output.xml>');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error during conversion:', err);
  process.exit(1);
});
