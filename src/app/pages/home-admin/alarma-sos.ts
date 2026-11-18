/**
 * Aviso de SOS nuevo en el panel: un SOS es una emergencia y el admin puede estar en otra pestaña.
 *  - Sonido: tres pitidos de dos tonos generados con Web Audio (no hace falta un archivo de audio).
 *  - Título de la pestaña: "(2) SOS · …" mientras haya SOS abiertas.
 *  - Notificación del navegador si la persona dio permiso; al tocarla abre la sección Seguridad.
 * El navegador solo deja sonar después de que la persona interactúa con la página (iniciar sesión ya cuenta).
 */
export class AlarmaSos {
  private audio: AudioContext | null = null;
  private tituloOriginal: string | null = null;

  static permiso(): NotificationPermission | 'no-soportado' {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'no-soportado';
  }

  async pedirPermiso(): Promise<NotificationPermission | 'no-soportado'> {
    if (AlarmaSos.permiso() === 'no-soportado') return 'no-soportado';
    // Aprovecha este clic para "despertar" el audio (los navegadores lo exigen)
    this.contexto()?.resume().catch(() => undefined);
    try {
      return await Notification.requestPermission();
    } catch {
      return AlarmaSos.permiso();
    }
  }

  sonar(abiertas: number, alTocar: () => void): void {
    this.pitar();
    if (AlarmaSos.permiso() === 'granted') {
      try {
        const n = new Notification('🚨 SOS en MoviFY', {
          body: abiertas === 1 ? 'Alguien pidió ayuda en un viaje. Atiéndela ya.' : `Hay ${abiertas} alertas SOS abiertas.`,
          tag: 'movify-sos',
          requireInteraction: true,
        });
        n.onclick = () => {
          window.focus();
          alTocar();
          n.close();
        };
      } catch {
        // Algunos navegadores solo permiten notificaciones desde un service worker: queda el sonido y el título
      }
    }
  }

  titulo(abiertas: number): void {
    if (typeof document === 'undefined') return;
    if (this.tituloOriginal === null) this.tituloOriginal = document.title;
    document.title = abiertas > 0 ? `(${abiertas}) SOS · ${this.tituloOriginal}` : this.tituloOriginal;
  }

  detener(): void {
    if (this.tituloOriginal !== null && typeof document !== 'undefined') document.title = this.tituloOriginal;
    this.audio?.close().catch(() => undefined);
    this.audio = null;
  }

  private contexto(): AudioContext | null {
    if (this.audio) return this.audio;
    const Ctor = typeof window !== 'undefined'
      ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
    this.audio = Ctor ? new Ctor() : null;
    return this.audio;
  }

  /** Tres pares de pitidos (880 Hz / 660 Hz), como una sirena corta. */
  private pitar(): void {
    const ctx = this.contexto();
    if (!ctx) return;
    ctx.resume().catch(() => undefined);
    const inicio = ctx.currentTime + 0.05;
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      const t = inicio + i * 0.22;
      osc.type = 'square';
      osc.frequency.value = i % 2 === 0 ? 880 : 660;
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(vol).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.21);
    }
  }
}
