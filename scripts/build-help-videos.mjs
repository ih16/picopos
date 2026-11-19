import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP_EXAMPLES } from '../src/features/help/help-examples.ts';

// Run with: node --experimental-strip-types scripts/build-help-videos.mjs
// Set FFMPEG_BIN when ffmpeg is not on PATH. No encoder is needed to serve the app.
const encoder = process.env.FFMPEG_BIN || 'ffmpeg';
const directory = fileURLToPath(new URL('../public/help/examples/', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'picopos-help-'));
const secondsPerStep = 6;
const timestamp = (seconds) => new Date(seconds * 1000).toISOString().slice(11, 23);

try {
  for (const example of HELP_EXAMPLES) {
    const lines = [];
    const captions = ['WEBVTT', ''];
    for (const [index, frame] of example.frames.entries()) {
      const path = join(directory, `${frame.image}.jpg`);
      await readFile(path);
      lines.push(`file '${path.replaceAll("'", "'\\''")}'`, `duration ${secondsPerStep}`);
      captions.push(
        `${index + 1}`,
        `${timestamp(index * secondsPerStep)} --> ${timestamp((index + 1) * secondsPerStep)}`,
        frame.caption,
        '',
      );
    }
    lines.push(lines[lines.length - 2]);
    const input = join(temporary, `${example.id}.txt`);
    await writeFile(input, `${lines.join('\n')}\n`);
    const result = spawnSync(
      encoder,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        input,
        '-vf',
        'scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2,setsar=1',
        '-r',
        '10',
        '-t',
        `${example.frames.length * secondsPerStep}`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '24',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        join(directory, `${example.id}.mp4`),
      ],
      { stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Video encoding failed: ${example.id}`);
    await writeFile(join(directory, `${example.id}.vtt`), `${captions.join('\n')}\n`);
    console.log(`Built ${example.id}: ${example.frames.length} steps`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
