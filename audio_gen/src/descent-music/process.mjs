// DESCENT stem processing: candidates (result_audio/descent/<role>/cand_*.mp3)
// -> loop-baked, loudness-normalised, opus+aac encoded stems + manifest.json.
//
// Run from audio_gen/:  node src/descent-music/process.mjs [outDir]
// Then copy the out dir's contents into the game's public/music/.
import { execSync, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve('result_audio/descent');
const OUT = resolve(process.argv[2] || 'result_audio/descent_out');
const TMP = join(OUT, '_wav');
mkdirSync(TMP, { recursive: true });

const SR = 44100;
const BPM = 96;
const BAR = (60 / BPM) * 4; // 2.5 s
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

/** Integrated LUFS via ffmpeg ebur128. */
function lufs(file) {
  const out = execSync(`ffmpeg -i "${file}" -af ebur128 -f null - 2>&1`, { maxBuffer: MAXBUF }).toString();
  const m = out.match(/I:\s+(-?[\d.]+)\s+LUFS/g);
  if (!m) return -23;
  return parseFloat(m[m.length - 1].match(/(-?[\d.]+)/)[1]);
}

/** Encode wav -> opus .ogg + aac .m4a with a gain that hits targetLufs. */
function encodeTo(wavPath, id, targetLufs, opusKbps) {
  const measured = lufs(wavPath);
  const gain = Math.max(-20, Math.min(20, targetLufs - measured));
  const vol = `volume=${gain.toFixed(2)}dB`;
  execSync(`ffmpeg -v error -y -i "${wavPath}" -af "${vol}" -c:a libopus -b:a ${opusKbps}k "${join(OUT, id + '.ogg')}"`);
  execSync(`ffmpeg -v error -y -i "${wavPath}" -af "${vol}" -c:a aac -b:a 96k "${join(OUT, id + '.m4a')}"`);
  console.log(`  ${id}: ${measured.toFixed(1)} LUFS -> ${targetLufs} (gain ${gain.toFixed(1)} dB)`);
}

/** Cut seg of durS starting at t0, bake an equal-power loop crossfade of cfS. */
function loopBake(pcm, t0, durS, cfS) {
  const N = Math.round(durS * SR), CF = Math.round(cfS * SR);
  const s0 = Math.min(Math.round(t0 * SR), pcm.n - N - CF - 1);
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) { L[i] = pcm.L[s0 + i]; R[i] = pcm.R[s0 + i]; }
  for (let i = 0; i < CF; i++) {
    const th = (i / CF) * Math.PI * 0.5;
    const a = Math.cos(th), b = Math.sin(th); // tail out, head in
    L[i] = pcm.L[s0 + N + i] * a + L[i] * b;
    R[i] = pcm.R[s0 + N + i] * a + R[i] * b;
  }
  return { L, R };
}

/** Cut with edge fades (for phrases/stingers). */
function cutFade(pcm, t0, durS, inS, outS) {
  const N = Math.round(durS * SR);
  const s0 = Math.max(0, Math.min(Math.round(t0 * SR), pcm.n - N - 1));
  const L = new Float32Array(N), R = new Float32Array(N);
  const fi = Math.round(inS * SR), fo = Math.round(outS * SR);
  for (let i = 0; i < N; i++) {
    let g = 1;
    if (i < fi) g = i / fi;
    if (N - i < fo) g = Math.min(g, (N - i) / fo);
    L[i] = pcm.L[s0 + i] * g; R[i] = pcm.R[s0 + i] * g;
  }
  return { L, R };
}

/** Onset-energy autocorrelation BPM estimate over 70..140. */
function estimateBpm(pcm) {
  const hop = 512, frames = Math.floor(pcm.n / hop) - 1;
  const env = new Float32Array(frames);
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) e += pcm.L[i] * pcm.L[i] + pcm.R[i] * pcm.R[i];
    env[f] = Math.max(0, e - prev); prev = e;
  }
  const fps = SR / hop;
  let best = 0, bestBpm = 0;
  for (let bpm = 70; bpm <= 140; bpm += 0.25) {
    const lag = Math.round(fps * 60 / bpm);
    let c = 0;
    for (let f = 0; f + lag < frames; f++) c += env[f] * env[f + lag];
    if (c > best) { best = c; bestBpm = bpm; }
  }
  return bestBpm;
}

/** First strong onset after fromS (to cut percussive loops on a hit). */
function firstOnsetAfter(pcm, fromS) {
  const hop = 512, from = Math.floor(fromS * SR / hop);
  const frames = Math.floor(pcm.n / hop) - 1;
  let prev = 0; const env = [];
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) e += pcm.L[i] * pcm.L[i] + pcm.R[i] * pcm.R[i];
    env.push(Math.max(0, e - prev)); prev = e;
  }
  const mean = env.reduce((a, b) => a + b, 0) / env.length;
  for (let f = from; f < frames; f++) if (env[f] > mean * 3) return f * hop / SR;
  return fromS;
}

function pickCandidate(role) {
  const dir = join(SRC, role);
  if (!existsSync(dir)) return null;
  const cands = readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort();
  if (!cands.length) return null;
  // Prefer the longer candidate — more material to slice from.
  let best = null, bestDur = 0;
  for (const c of cands) {
    const p = join(dir, c);
    try {
      const d = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${p}"`).toString());
      if (d > bestDur) { bestDur = d; best = p; }
    } catch (e) { /* skip broken file */ }
  }
  console.log(`${role}: picked ${best} (${bestDur.toFixed(0)}s)`);
  return { path: best, dur: bestDur };
}

// ---------- process ----------------------------------------------------------

const manifest = {
  version: 1, bpm: BPM, key: 'Dm', beatsPerBar: 4,
  note: 'Suno-generated stems (gu_engine/audio_gen/src/descent-music). window = tension trapezoid for layers; bands = phrase tension bands; priority = fetch stage.',
  assets: [],
};
const missing = [];

// base: 8 bars, long crossfade (pad tails breathe)
{
  const c = pickCandidate('base');
  if (c) {
    const pcm = decode(c.path);
    const seg = loopBake(pcm, Math.min(12, c.dur * 0.2), 8 * BAR, 0.6);
    encodeTo(writeWav('base.wav', seg.L, seg.R), 'base', -20, 80);
    manifest.assets.push({ id: 'base', role: 'layer', priority: 0,
      files: { opus: 'base.ogg', aac: 'base.m4a' },
      bars: 8, gain: 0, loopStart: 0, loopEnd: 8 * BAR, window: [-1, -1, 2, 2] });
  } else missing.push('base');
}

// harm
{
  const c = pickCandidate('harm');
  if (c) {
    const pcm = decode(c.path);
    const seg = loopBake(pcm, Math.min(20, c.dur * 0.3), 8 * BAR, 0.6);
    encodeTo(writeWav('harm.wav', seg.L, seg.R), 'harm', -21, 80);
    manifest.assets.push({ id: 'harm', role: 'layer', priority: 1,
      files: { opus: 'harm.ogg', aac: 'harm.m4a' },
      bars: 8, gain: 0, loopStart: 0, loopEnd: 8 * BAR, window: [0.15, 0.35, 0.9, 1.1] });
  } else missing.push('harm');
}

// rhythm: tempo-conform to 96, cut on an onset, short seam
{
  const c = pickCandidate('rhythm');
  if (c) {
    let pcm = decode(c.path);
    const bpm = estimateBpm(pcm);
    let conformNote = 'kept';
    if (bpm > 70 && bpm < 140 && Math.abs(bpm - BPM) > 0.5) {
      pcm = decode(c.path, `atempo=${(BPM / bpm).toFixed(5)}`);
      conformNote = `conformed ${bpm.toFixed(1)} -> ${BPM}`;
    }
    console.log(`  rhythm bpm: ${bpm.toFixed(1)} (${conformNote})`);
    const t0 = firstOnsetAfter(pcm, 8);
    const seg = loopBake(pcm, t0, 4 * BAR, 0.05);
    encodeTo(writeWav('rhythm.wav', seg.L, seg.R), 'rhythm', -19, 80);
    manifest.assets.push({ id: 'rhythm', role: 'layer', priority: 1,
      files: { opus: 'rhythm.ogg', aac: 'rhythm.m4a' },
      bars: 4, gain: 0, loopStart: 0, loopEnd: 4 * BAR, window: [0.4, 0.6, 1.1, 1.2] });
  } else missing.push('rhythm');
}

// high
{
  const c = pickCandidate('high');
  if (c) {
    const pcm = decode(c.path);
    const seg = loopBake(pcm, Math.min(15, c.dur * 0.25), 4 * BAR, 0.3);
    encodeTo(writeWav('high.wav', seg.L, seg.R), 'high', -21, 80);
    manifest.assets.push({ id: 'high', role: 'layer', priority: 1,
      files: { opus: 'high.ogg', aac: 'high.m4a' },
      bars: 4, gain: 0, loopStart: 0, loopEnd: 4 * BAR, window: [0.65, 0.85, 1.1, 1.2] });
  } else missing.push('high');
}

// phrases: four 2-bar cuts from the melody track, spread out
{
  const c = pickCandidate('melody');
  if (c) {
    const pcm = decode(c.path);
    const spots = [0.15, 0.35, 0.55, 0.75].map((f) => Math.min(c.dur - 2 * BAR - 1, c.dur * f));
    const defs = [
      { id: 'ph_low_01', register: 'low', bands: [0, 1, 2] },
      { id: 'ph_low_02', register: 'low', bands: [0, 1] },
      { id: 'ph_high_01', register: 'high', bands: [1, 2, 3] },
      { id: 'ph_high_02', register: 'high', bands: [2, 3] },
    ];
    defs.forEach((d, i) => {
      const seg = cutFade(pcm, spots[i], 2 * BAR, 0.05, 0.5);
      encodeTo(writeWav(d.id + '.wav', seg.L, seg.R), d.id, -18, 64);
      manifest.assets.push({ id: d.id, role: 'phrase', register: d.register, priority: 2,
        files: { opus: d.id + '.ogg', aac: d.id + '.m4a' },
        bars: 2, gain: 0, release: 0.4, bands: d.bands });
    });
  } else missing.push('melody/phrases');
}

// stingers: crash = darkened, slowed slice of the base drone; finish = the
// harm track's natural ending (last seconds resolve and fade).
{
  const cb = pickCandidate('base');
  if (cb) {
    const dark = decode(cb.path, 'asetrate=44100*0.7,aresample=44100,atempo=1.0');
    const seg = cutFade(dark, Math.min(30, dark.n / SR * 0.4), 2.2, 0.005, 1.2);
    encodeTo(writeWav('st_crash.wav', seg.L, seg.R), 'st_crash', -14, 64);
    manifest.assets.push({ id: 'st_crash', role: 'stinger', event: 'crash', priority: 0,
      files: { opus: 'st_crash.ogg', aac: 'st_crash.m4a' }, gain: 0 });
  }
  const ch = pickCandidate('harm');
  if (ch) {
    const pcm = decode(ch.path);
    const seg = cutFade(pcm, Math.max(0, ch.dur - 6), 5.5, 0.3, 2.0);
    encodeTo(writeWav('st_finish.wav', seg.L, seg.R), 'st_finish', -16, 64);
    manifest.assets.push({ id: 'st_finish', role: 'stinger', event: 'finish', priority: 0,
      files: { opus: 'st_finish.ogg', aac: 'st_finish.m4a' }, gain: 0 });
  }
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
const total = readdirSync(OUT).filter((f) => /\.(ogg|m4a)$/.test(f))
  .reduce((a, f) => a + statSync(join(OUT, f)).size, 0);
console.log(`\nout: ${OUT}`);
console.log(`total encoded: ${(total / 1024 / 1024).toFixed(2)} MB ${total > 5 * 1024 * 1024 ? '!! OVER 5MB BUDGET' : '(within budget)'}`);
if (missing.length) console.log('MISSING roles:', missing.join(', '));
