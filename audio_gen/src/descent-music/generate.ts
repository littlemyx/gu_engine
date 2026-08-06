// DESCENT dynamic-ambient stem generation (W2 of the music plan).
// Generates per-role instrumental candidates with key/BPM pinned hard in the
// style prompt, downloads every variant to result_audio/descent/<role>/.
// Curation + slicing happen downstream (see the game repo's music plan).
//
// Run from audio_gen/:  npx tsx src/descent-music/generate.ts
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { generateTrack, pollUntilComplete, downloadAudio } from '../suno-client.js';

const OUT_ROOT = path.resolve('result_audio', 'descent');

const PIN = 'strictly 96 BPM, D minor, instrumental, no vocals, no voice, studio quality, seamless ambient texture';

const SPECS: Array<{ role: string; style: string }> = [
  {
    role: 'base',
    style: `dark ambient drone, deep sustained low pad, warm analog strings, ${PIN}, no percussion, no melody, meditative, mountain forest atmosphere, very slow evolution`,
  },
  {
    role: 'harm',
    style: `ambient harmonic pad layer, warm evolving minor chords, soft string and choir textures, ${PIN}, no drums, no lead melody, spacious, cinematic, gentle swells`,
  },
  {
    role: 'rhythm',
    style: `minimal downtempo percussion groove, organic hand percussion, soft muted electronic pulse, tight steady beat, ${PIN}, no melody, no pads, dry close mix`,
  },
  {
    role: 'high',
    style: `driving ambient arpeggio layer, hypnotic synth arpeggios, shimmering plucks, rising tension, energetic but atmospheric, ${PIN}, minimal percussion`,
  },
  {
    role: 'melody',
    style: `sparse solo melodic phrases over a very quiet ambient bed, expressive minimal lead, soft flute and warm synth lead, short phrases with long silences between them, ${PIN}, no drums`,
  },
];

async function runOne(spec: { role: string; style: string }) {
  const dir = path.join(OUT_ROOT, spec.role);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[descent] ${spec.role}: generating…`);
  const taskId = await generateTrack(spec.style, true);
  console.log(`[descent] ${spec.role}: task ${taskId}, polling…`);
  const tracks = await pollUntilComplete(taskId);
  const saved: string[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    if (!t.audioUrl) continue;
    const dest = path.join(dir, `cand_${i}.mp3`);
    await downloadAudio(t.audioUrl, dest);
    saved.push(`${dest} (${Math.round(t.duration || 0)}s)`);
  }
  console.log(`[descent] ${spec.role}: saved ${saved.length} candidates\n  ${saved.join('\n  ')}`);
  return { role: spec.role, count: saved.length };
}

const results = await Promise.allSettled(SPECS.map(runOne));
let ok = 0;
for (const r of results) {
  if (r.status === 'fulfilled') { ok++; continue; }
  console.error('[descent] FAILED:', r.reason?.message || r.reason);
}
console.log(`[descent] done: ${ok}/${SPECS.length} roles succeeded`);
process.exit(ok > 0 ? 0 : 1);
