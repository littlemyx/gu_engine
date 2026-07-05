import type { SceneAudioProfile } from "./types";

type ActiveTrack = {
  source: AudioBufferSourceNode;
  trackGain: GainNode;
  url: string;
};

export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterBgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Желаемый трек (desired state) — выставляется синхронно при входе в
  // crossfadeTo, до await: повторные вызовы с тем же URL идемпотентны.
  private targetUrl: string | null = null;
  // Реально играющий трек. Источники одноразовые: запланированный stop()
  // не отменяется, затухающий трек не «воскрешается» — создаётся новый.
  private current: ActiveTrack | null = null;
  // Монотонный токен: инвалидирует async-продолжения устаревших вызовов.
  private generation = 0;

  private audioCache = new Map<string, AudioBuffer>();
  private disposed = false;

  private crossfadeDurationMs: number;
  private bgmVolume: number;
  private sfxVolume: number;

  constructor(settings: {
    bgmVolume?: number;
    sfxVolume?: number;
    crossfadeDurationMs?: number;
  }) {
    this.bgmVolume = settings.bgmVolume ?? 0.3;
    this.sfxVolume = settings.sfxVolume ?? 0.5;
    this.crossfadeDurationMs = settings.crossfadeDurationMs ?? 2000;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // bgmVolume живёт только на мастере; trackGain рампится строго 0..1,
      // иначе смена громкости дерётся с якорями рампов.
      this.masterBgmGain = this.ctx.createGain();
      this.masterBgmGain.gain.value = this.bgmVolume;
      this.masterBgmGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.ctx.destination);

      // Standalone-сборка стартует без пользовательского жеста — контекст
      // рождается suspended. Рампы, запланированные на замороженном
      // currentTime, корректно исполнятся после resume по первому жесту.
      if (this.ctx.state === "suspended") {
        const resume = () => {
          this.ctx?.resume();
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  async preload(urls: string[]): Promise<void> {
    const ctx = this.ensureContext();
    const toLoad = [...new Set(urls)].filter((u) => u && !this.audioCache.has(u));
    await Promise.all(
      toLoad.map(async (url) => {
        try {
          const res = await fetch(url);
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          this.audioCache.set(url, audioBuffer);
        } catch {
          // Preload failures are non-fatal
        }
      }),
    );
  }

  /**
   * Кроссфейд к треку (loop). null — fade-out в тишину.
   * Идемпотентен по targetUrl: безопасно звать на каждом рендере сцены.
   */
  async crossfadeTo(url: string | null): Promise<void> {
    if (this.disposed || this.targetUrl === url) return;
    this.targetUrl = url;
    const gen = ++this.generation;

    const ctx = this.ensureContext();
    const buffer = url ? await this.getBuffer(ctx, url) : null;
    if (gen !== this.generation) return; // вызов устарел (superseded / stop / dispose)
    if (url && !buffer) {
      // Загрузка не удалась — откат desired state, чтобы retry был возможен.
      this.targetUrl = this.current?.url ?? null;
      return;
    }

    const fade = this.crossfadeDurationMs / 1000;
    const now = ctx.currentTime;

    if (this.current) {
      this.fadeOutTrack(this.current, now, fade);
      this.current = null;
    }

    if (!buffer || !url) return; // только fade-out

    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0, now);
    trackGain.gain.linearRampToValueAtTime(1, now + fade);
    trackGain.connect(this.masterBgmGain!);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(trackGain);
    source.start(now);

    this.current = { source, trackGain, url };
  }

  private fadeOutTrack(track: ActiveTrack, now: number, fade: number): void {
    const { source, trackGain } = track;
    // Портабельный cancel-and-hold (cancelAndHoldAtTime нет в Firefox):
    // снять будущие события, заякорить текущее значение, рампить вниз.
    const v = trackGain.gain.value;
    trackGain.gain.cancelScheduledValues(now);
    trackGain.gain.setValueAtTime(v, now);
    trackGain.gain.linearRampToValueAtTime(0, now + fade);
    try {
      source.stop(now + fade + 0.05); // по audio-клоку, без setTimeout
    } catch {
      /* already stopped */
    }
    source.onended = () => trackGain.disconnect();
  }

  async playSfx(url: string): Promise<void> {
    if (this.disposed) return;
    const ctx = this.ensureContext();
    // На suspended-контексте SFX встали бы в очередь и выстрелили пачкой
    // после resume — пропускаем.
    if (ctx.state !== "running") return;

    const buffer = await this.getBuffer(ctx, url);
    if (!buffer || this.disposed) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGain!);
    source.start();
  }

  stop(): void {
    this.generation++;
    this.targetUrl = null;
    if (this.current && this.ctx) {
      this.fadeOutTrack(this.current, this.ctx.currentTime, 0.05);
      this.current = null;
    }
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    this.audioCache.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterBgmGain = null;
      this.sfxGain = null;
    }
  }

  /**
   * Целевой трек сцены. Тон согласован с диалоговыми brackets: пороги
   * приходят в профиле из bracketCondition-констант компилятора мира.
   * Пустой URL вариации → база (baseUrl), не подавление кроссфейда.
   */
  evaluateAudioState(
    state: Readonly<Record<string, number>>,
    profile: SceneAudioProfile | undefined,
    baseUrl: string | undefined,
  ): string | null {
    const base = baseUrl || null;
    if (!profile) return base;

    const affection = state[`relationship[${profile.liId}].affection`] ?? 0;
    if (affection >= profile.positiveGte && profile.positiveUrl) {
      return profile.positiveUrl;
    }
    if (affection <= profile.negativeLte && profile.negativeUrl) {
      return profile.negativeUrl;
    }
    return base;
  }

  private async getBuffer(
    ctx: AudioContext,
    url: string,
  ): Promise<AudioBuffer | null> {
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url)!;
    }
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.audioCache.set(url, buffer);
      return buffer;
    } catch {
      return null;
    }
  }
}
