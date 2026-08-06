// DESCENT SFX processing: candidates (result_audio/descent-sfx/<id>/cand_*.mp3)
// -> onset-trimmed, faded, peak-normalised one-shots + a loop-baked wind bed,
// opus+aac encoded, with manifest.json.
//
// Run from audio_gen/:  node src/descent-sfx/process.mjs [outDir]
// Then copy the out dir's contents into the game's public/sfx/.
import { execSync, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve('result_audio/descent-sfx');
const OUT = resolve(process.argv[2] || 'result_audio/descent-sfx_out');
const TMP = join(OUT, '_wav');
mkdirSync(TMP, { recursive: true });

const SR = 44100;
const MAXBUF = 512 * 1024 * 1024;

// ---------- helpers ----------------------------------------------------------

function decode(file, extraAf) {
  const af = extraAf ? ['-af', extraAf] : [];
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, ...af,
    '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: MAXBUF });
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength >> 2);
  const n = f.length >> 1;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return { L, R, n };
}

function writeWav(name, L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 44 + i * 4 + 2);
  }
  const p = join(TMP, name);
  writeFileSync(p, buf);
  return p;
}

/** Integrated LUFS via ffmpeg ebur128 (for the wind loop only). */
function lufs(file) {
  const out = execSync(`ffmpeg -i "${file}" -af ebur128 -f null - 2>&1`, { maxBuffer: MAXBUF }).toString();
  const m = out.match(/I:\s+(-?[\d.]+)\s+LUFS/g);
  if (!m) return -23;
  return parseFloat(m[m.length - 1].match(/(-?[\d.]+)/)[1]);
}

function encode(wavPath, id, gainDb, opusKbps, eq) {
  // The safety limiter only matters when the EQ shelf lifts a peak-normalised
  // signal: +4 dB of treble on an already ~-1.5 dBFS peak can clip the AAC.
  const af = `${eq ? eq + ',' : ''}volume=${gainDb.toFixed(2)}dB${eq ? ',alimiter=limit=0.94:level=false' : ''}`;
  execSync(`ffmpeg -v error -y -i "${wavPath}" -af "${af}" -c:a libopus -b:a ${opusKbps}k "${join(OUT, id + '.ogg')}"`);
  execSync(`ffmpeg -v error -y -i "${wavPath}" -af "${af}" -c:a aac -b:a ${Math.max(64, opusKbps)}k "${join(OUT, id + '.m4a')}"`);
}

// One-shots get a corrective tilt: Suno foley comes back bottom-heavy even
// with a "bright, dry" prompt, and in the mix (over the synthesised low body
// drop) that reads as boomy. Trim the sub, lift the top shelf.
const ONESHOT_EQ = 'highpass=f=45,treble=g=4:f=3000';

/** Peak-normalising encode: scale so |peak| lands at peakDb. */
function encodePeak(wavPath, seg, id, peakDb, opusKbps) {
  let peak = 1e-6;
  for (let i = 0; i < seg.L.length; i++) {
    const a = Math.abs(seg.L[i]), b = Math.abs(seg.R[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  const gain = Math.max(-20, Math.min(24, peakDb - 20 * Math.log10(peak)));
  encode(wavPath, id, gain, opusKbps, ONESHOT_EQ);
  console.log(`  ${id}: peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS -> ${peakDb} (gain ${gain.toFixed(1)} dB)`);
}

const HOP = 512;

/** Short-window energy envelope. */
function energyEnv(pcm) {
  const frames = Math.floor(pcm.n / HOP) - 1;
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = f * HOP; i < (f + 1) * HOP; i++) e += pcm.L[i] * pcm.L[i] + pcm.R[i] * pcm.R[i];
    env[f] = e;
  }
  return env;
}

/**
 * Cut a one-shot around the action: start just before the first significant
 * onset (a fraction of the loudest frame), end when energy stays low or maxDur
 * is hit. Suno "sounds" candidates often carry lead-in noise and several takes;
 * this keeps the first strong take.
 */
function cutOneShot(pcm, maxDur, tailS) {
  const env = energyEnv(pcm);
  let peak = 0;
  for (const e of env) if (e > peak) peak = e;
  if (peak <= 0) return null;
  let sf = 0;
  for (let f = 0; f < env.length; f++) if (env[f] > peak * 0.12) { sf = f; break; }
  const start = Math.max(0, Math.round(sf * HOP - 0.03 * SR));
  // End: after maxDur, or earlier if energy sits 40 dB under the peak for
  // 0.35 s (transient peaks dwarf the audible dirt-scatter tail — a tighter
  // threshold was chopping crashes down to the first 0.26 s).
  let end = Math.min(pcm.n, start + Math.round(maxDur * SR));
  const quiet = Math.round(0.35 * SR / HOP);
  let run = 0;
  for (let f = Math.round((start + 0.2 * SR) / HOP); f < Math.min(env.length, end / HOP); f++) {
    run = env[f] < peak * 1e-4 ? run + 1 : 0;
    if (run >= quiet) { end = Math.round((f - run + 1) * HOP + 0.05 * SR); break; }
  }
  const N = end - start;
  const L = new Float32Array(N), R = new Float32Array(N);
  const fi = Math.round(0.003 * SR), fo = Math.min(Math.round(tailS * SR), N >> 1);
  for (let i = 0; i < N; i++) {
    let g = 1;
    if (i < fi) g = i / fi;
    if (N - i < fo) g = Math.min(g, (N - i) / fo);
    L[i] = pcm.L[start + i] * g; R[i] = pcm.R[start + i] * g;
  }
  return { L, R };
}

/**
 * Downward expander for mechanical takes: Suno bakes room reverb into rattle
 * and clank recordings even with a "completely dry" prompt, and that wash
 * between the hits reads as echo in-game. Everything under ~5% of the peak
 * envelope (-26 dB) is squeezed to 12%, with fast attack / slow release so
 * the hits themselves keep their transients.
 */
function gateTail(seg) {
  const n = seg.L.length;
  const aAtt = Math.exp(-1 / (0.004 * SR)), aRel = Math.exp(-1 / (0.030 * SR));
  const env = new Float32Array(n);
  let e = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(seg.L[i]), Math.abs(seg.R[i]));
    e = x > e ? aAtt * e + (1 - aAtt) * x : aRel * e + (1 - aRel) * x;
    env[i] = e;
    if (e > peak) peak = e;
  }
  const thr = peak * 0.05;
  const gAtt = Math.exp(-1 / (0.002 * SR)), gRel = Math.exp(-1 / (0.050 * SR));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const target = env[i] >= thr ? 1 : 0.12;
    g = target > g ? gAtt * g + (1 - gAtt) * target : gRel * g + (1 - gRel) * target;
    seg.L[i] *= g; seg.R[i] *= g;
  }
  return seg;
}

/** Equal-power loop crossfade (same maths as the music pipeline). */
function loopBake(pcm, t0, durS, cfS) {
  const N = Math.round(durS * SR), CF = Math.round(cfS * SR);
  const s0 = Math.max(0, Math.min(Math.round(t0 * SR), pcm.n - N - CF - 1));
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) { L[i] = pcm.L[s0 + i]; R[i] = pcm.R[s0 + i]; }
  for (let i = 0; i < CF; i++) {
    const th = (i / CF) * Math.PI * 0.5;
    const a = Math.cos(th), b = Math.sin(th);
    L[i] = pcm.L[s0 + N + i] * a + L[i] * b;
    R[i] = pcm.R[s0 + N + i] * a + R[i] * b;
  }
  return { L, R };
}

function candidates(id) {
  const dir = join(SRC, id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort().map((f) => join(dir, f));
}

// ---------- process ----------------------------------------------------------

const manifest = {
  version: 1,
  note: 'Suno-generated SFX (gu_engine/audio_gen/src/descent-sfx). kind groups variants; the game picks one at random per event. wind is a seamless loop.',
  assets: [],
};
const missing = [];

// One-shots: every decent candidate becomes a variant of its kind.
const ONE_SHOTS = [
  { kind: 'crash', srcs: ['crash_a', 'crash_b'], maxDur: 3.2, tail: 0.45, peakDb: -1.5, kbps: 64 },
  { kind: 'impact_hard', srcs: ['impact_hard'], maxDur: 1.5, tail: 0.25, peakDb: -1.5, kbps: 64 },
  { kind: 'impact_soft', srcs: ['impact_soft'], maxDur: 1.0, tail: 0.2, peakDb: -3.0, kbps: 64 },
  { kind: 'slide', srcs: ['slide'], maxDur: 3.0, tail: 0.6, peakDb: -3.0, kbps: 64 },
  // Mechanical accents: quiet by design — they sit on top of the main foley.
  // gate: squeeze the baked-in room wash between the hits (reads as echo).
  { kind: 'chain_slap', srcs: ['chain_slap'], maxDur: 0.45, tail: 0.15, peakDb: -6.0, kbps: 48, gate: true },
  { kind: 'clank', srcs: ['clank'], maxDur: 0.6, tail: 0.2, peakDb: -4.5, kbps: 48, gate: true },
  // UI cues.
  { kind: 'ui_trick', srcs: ['ui_trick'], maxDur: 0.8, tail: 0.3, peakDb: -6.0, kbps: 48 },
  { kind: 'ui_fall', srcs: ['ui_fall'], maxDur: 1.4, tail: 0.5, peakDb: -6.0, kbps: 48 },
];

for (const spec of ONE_SHOTS) {
  let idx = 0;
  for (const srcId of spec.srcs) {
    for (const cand of candidates(srcId)) {
      const pcm = decode(cand);
      let seg = cutOneShot(pcm, spec.maxDur, spec.tail);
      if (!seg || seg.L.length < 0.15 * SR) { console.log(`  ${srcId}: skipped ${cand} (too short/empty)`); continue; }
      if (spec.gate) seg = gateTail(seg);
      idx++;
      const id = `${spec.kind}_${String(idx).padStart(2, '0')}`;
      encodePeak(writeWav(id + '.wav', seg.L, seg.R), seg, id, spec.peakDb, spec.kbps);
      manifest.assets.push({ id, kind: spec.kind, role: 'oneshot', priority: 0,
        files: { opus: id + '.ogg', aac: id + '.m4a' }, gain: 0 });
    }
  }
  if (!idx) missing.push(spec.kind);
}

// Chain rattle: each candidate is a continuous rattle texture — slice three
// short snippets per candidate at spread offsets, so the in-flight rattle can
// fire varied one-shots without ever sounding looped.
{
  let idx = 0;
  for (const cand of candidates('chain_rattle')) {
    const pcm = decode(cand);
    const N = Math.round(0.38 * SR);
    // Slice at the three loudest non-overlapping windows — fixed fractional
    // offsets kept landing in silence (candidates carry rattle in bursts).
    const env = energyEnv(pcm);
    const win = Math.max(1, Math.round(N / HOP));
    const scored = [];
    for (let f = 0; f + win < env.length; f++) {
      let e = 0;
      for (let i = f; i < f + win; i++) e += env[i];
      scored.push([e, f]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const startsF = [];
    for (const [, f] of scored) {
      if (startsF.length >= 3) break;
      if (startsF.every((o) => Math.abs(o - f) >= win)) startsF.push(f);
    }
    for (const fStart of startsF) {
      const s0 = Math.min(fStart * HOP, pcm.n - N - 1);
      if (s0 < 0) continue;
      const L = new Float32Array(N), R = new Float32Array(N);
      const fi = Math.round(0.01 * SR), fo = Math.round(0.09 * SR);
      let pk = 0;
      for (let i = 0; i < N; i++) {
        let g = 1;
        if (i < fi) g = i / fi;
        if (N - i < fo) g = Math.min(g, (N - i) / fo);
        L[i] = pcm.L[s0 + i] * g; R[i] = pcm.R[s0 + i] * g;
        const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
        if (a > pk) pk = a;
      }
      // A "loudest window" of a near-silent candidate is still silence; boosting
      // it 24 dB just amplifies the mp3 noise floor.
      if (pk < 0.03) continue;
      idx++;
      const id = `rattle_${String(idx).padStart(2, '0')}`;
      const seg = gateTail({ L, R });
      encodePeak(writeWav(id + '.wav', seg.L, seg.R), seg, id, -9.0, 48);
      manifest.assets.push({ id, kind: 'rattle', role: 'oneshot', priority: 1,
        files: { opus: id + '.ogg', aac: id + '.m4a' }, gain: 0 });
    }
  }
  if (!idx) missing.push('rattle');
}

// Wind: pick the longest candidate, bake an 8 s seamless loop from the middle.
{
  const cands = candidates('wind_loop');
  let best = null, bestDur = 0;
  for (const c of cands) {
    try {
      const d = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${c}"`).toString());
      if (d > bestDur) { bestDur = d; best = c; }
    } catch (e) { /* skip broken file */ }
  }
  if (best && bestDur > 4) {
    const pcm = decode(best);
    const cf = 0.7;
    const durS = Math.min(8, bestDur - cf - 0.3);
    const seg = loopBake(pcm, Math.max(0, Math.min(bestDur * 0.25, bestDur - durS - cf - 0.3)), durS, cf);
    const wav = writeWav('wind.wav', seg.L, seg.R);
    const gain = Math.max(-20, Math.min(20, -20 - lufs(wav)));
    encode(wav, 'wind', gain, 48);
    console.log(`  wind: loop from ${best} (${bestDur.toFixed(0)}s), gain ${gain.toFixed(1)} dB -> -20 LUFS`);
    manifest.assets.push({ id: 'wind', kind: 'wind', role: 'loop', priority: 1,
      files: { opus: 'wind.ogg', aac: 'wind.m4a' }, gain: 0, loop: true });
  } else missing.push('wind');
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
const total = readdirSync(OUT).filter((f) => /\.(ogg|m4a)$/.test(f))
  .reduce((a, f) => a + statSync(join(OUT, f)).size, 0);
console.log(`\nout: ${OUT}`);
console.log(`total encoded: ${(total / 1024 / 1024).toFixed(2)} MB ${total > 2 * 1024 * 1024 ? '!! OVER 2MB BUDGET' : '(within budget)'}`);
if (missing.length) console.log('MISSING kinds:', missing.join(', '));
