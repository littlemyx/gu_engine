// DESCENT SFX generation — replaces the harshest procedural effects (crash,
// hard landing, dirt slide) and adds a wind-rush loop for the speed layer.
// Uses the Suno sounds endpoint (short SFX), downloads every candidate to
// result_audio/descent-sfx/<id>/. Curation + slicing happen in process.mjs.
//
// Run from audio_gen/:  npx tsx src/descent-sfx/generate.ts
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { generateSound, pollUntilComplete, downloadAudio } from '../suno-client.js';

const OUT_ROOT = path.resolve('result_audio', 'descent-sfx');

// Every prompt pins "no music, no voice" — the sounds endpoint happily drifts
// into musical beds otherwise, and the rider grunt stays procedural in-game.
// The dryness/brightness pin is load-bearing: the first batch (prompted with
// "muffled thud", "deep", "soft loam") came back bass-heavy and roomy — nearly
// all energy under 600 Hz — and read as "inside a bucket" in the mix.
const PIN = 'completely dry recording, dead acoustic, no reverb, no echo, no room, crisp bright and detailed, no music, no melody, no voice, close-mic realistic foley, single sound effect';

const SPECS: Array<{ id: string; prompt: string; loop: boolean }> = [
  {
    id: 'crash_a',
    prompt: `mountain bike crash on a dirt trail: sharp initial hit, bright clatter of bike frame and wheels tumbling over rocks, spoke and chain rattle, gravel scatter, tight and punchy, no ringing tones, ${PIN}`,
    loop: false,
  },
  {
    id: 'crash_b',
    prompt: `violent mountain bike wipeout: rider and bike hitting loose gravel hard, tumbling, spokes and frame rattling brightly, dust and small stones scattering with crisp detail, ${PIN}`,
    loop: false,
  },
  {
    id: 'impact_hard',
    prompt: `tight punchy thud of mountain bike tyres landing a big jump on packed dirt, crisp sharp attack, bright spray of dirt and pebbles, very short, ${PIN}`,
    loop: false,
  },
  {
    id: 'impact_soft',
    prompt: `quick light thud of bicycle tyres touching down on a forest trail, crisp subtle scatter of debris, very short, bright transient, ${PIN}`,
    loop: false,
  },
  {
    id: 'slide',
    prompt: `body and bicycle skidding to a stop across dry loose gravel, crisp scraping stones, bright gritty texture, fading out naturally, ${PIN}`,
    loop: false,
  },
  {
    id: 'wind_loop',
    prompt: `strong rushing wind of fast downhill movement, air whooshing past the ears at high speed, smooth steady broadband turbulence, seamless loop, constant level, no music, no melody, no voice, single sound effect`,
    loop: true,
  },
];

// Optional CLI filter: `npx tsx src/descent-sfx/generate.ts crash_a,slide`
// regenerates only the listed ids (the rest keep their downloaded candidates).
const only = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean);
const RUN = only.length ? SPECS.filter(s => only.includes(s.id)) : SPECS;

async function runOne(spec: { id: string; prompt: string; loop: boolean }) {
  const dir = path.join(OUT_ROOT, spec.id);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[descent-sfx] ${spec.id}: generating…`);
  const taskId = await generateSound(spec.prompt, spec.loop);
  console.log(`[descent-sfx] ${spec.id}: task ${taskId}, polling…`);
  const tracks = await pollUntilComplete(taskId);
  const saved: string[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    if (!t.audioUrl) continue;
    const dest = path.join(dir, `cand_${i}.mp3`);
    await downloadAudio(t.audioUrl, dest);
    saved.push(`${dest} (${Math.round(t.duration || 0)}s)`);
  }
  console.log(`[descent-sfx] ${spec.id}: saved ${saved.length} candidates\n  ${saved.join('\n  ')}`);
  return { id: spec.id, count: saved.length };
}

const results = await Promise.allSettled(RUN.map(runOne));
let ok = 0;
for (const r of results) {
  if (r.status === 'fulfilled') { ok++; continue; }
  console.error('[descent-sfx] FAILED:', r.reason?.message || r.reason);
}
console.log(`[descent-sfx] done: ${ok}/${RUN.length} sounds succeeded`);
process.exit(ok > 0 ? 0 : 1);
