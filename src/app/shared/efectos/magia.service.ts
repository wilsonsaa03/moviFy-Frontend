import { Injectable, NgZone, inject } from '@angular/core';

/** Una chispa del "polvo mágico" que se dibuja en el canvas. */
interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravedad: number;
  vida: number;
  vidaMax: number;
  tamano: number;
  giro: number;
  velGiro: number;
  color: string;
  estrella: boolean;
}

/**
 * Dibuja el polvo de estrellas de la landing en un <canvas> fijo sobre la página.
 *
 * - Todo corre FUERA de la zona de Angular (runOutsideAngular): dibujar 60 veces
 *   por segundo no necesita que Angular revise la vista, y así no se pone lento.
 * - El ciclo de animación solo está activo mientras haya chispas vivas, para no
 *   gastar batería cuando no pasa nada.
 * - Respeta la opción del sistema "reducir movimiento".
 */
@Injectable({ providedIn: 'root' })
export class MagiaService {
  private zone = inject(NgZone);

  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private dpr = 1;
  private particulas: Particula[] = [];
  private cicloId: number | null = null;
  private alRedimensionar = () => this.ajustarTamano();

  private readonly colores = ['#02AAB4', '#5FD3D9', '#FE7B13', '#FFC93C', '#FFFFFF', '#9BE6EA'];
  private readonly maxParticulas = 420;

  /** true si el usuario pidió menos animaciones en su sistema operativo. */
  sinMovimiento(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  conectar(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ajustarTamano();
    this.zone.runOutsideAngular(() => window.addEventListener('resize', this.alRedimensionar));
  }

  desconectar(): void {
    window.removeEventListener('resize', this.alRedimensionar);
    if (this.cicloId !== null) cancelAnimationFrame(this.cicloId);
    this.cicloId = null;
    this.particulas = [];
    this.canvas = undefined;
    this.ctx = null;
  }

  /** Estela pequeña que sigue al cursor. */
  estela(x: number, y: number): void {
    if (this.sinMovimiento()) return;
    for (let i = 0; i < 2; i++) {
      this.crear(x, y, (Math.random() - 0.5) * 1.2, Math.random() * 0.8 - 0.2, 0.025, 28 + Math.random() * 18, 3 + Math.random() * 4);
    }
  }

  /**
   * Ráfaga de chispas cuando algo aparece.
   * 'borde': salen del borde superior del elemento. 'centro': explotan desde el centro.
   */
  rafaga(r: DOMRect, modo: 'borde' | 'centro' = 'borde'): void {
    if (!this.ctx || this.sinMovimiento()) return;
    const alto = window.innerHeight;
    if (r.bottom < 0 || r.top > alto) return;

    if (modo === 'centro') {
      const cx = r.left + r.width / 2;
      const cy = Math.min(Math.max(r.top + Math.min(r.height / 2, 260), 40), alto - 40);
      for (let i = 0; i < 46; i++) {
        const angulo = Math.random() * Math.PI * 2;
        const vel = 2 + Math.random() * 5;
        this.crear(cx, cy, Math.cos(angulo) * vel, Math.sin(angulo) * vel, 0.05, 50 + Math.random() * 30, 4 + Math.random() * 6);
      }
      return;
    }

    const y = Math.min(Math.max(r.top + 8, 20), alto - 20);
    const cuantas = Math.min(34, Math.max(14, Math.round(r.width / 26)));
    for (let i = 0; i < cuantas; i++) {
      const x = r.left + Math.random() * r.width;
      this.crear(x, y + Math.random() * 20, (Math.random() - 0.5) * 2.4, -1.2 - Math.random() * 3, 0.06, 45 + Math.random() * 30, 3 + Math.random() * 5);
    }
  }

  private ajustarTamano(): void {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  }

  private crear(x: number, y: number, vx: number, vy: number, gravedad: number, vida: number, tamano: number): void {
    if (!this.ctx) return;
    if (this.particulas.length >= this.maxParticulas) this.particulas.shift();
    this.particulas.push({
      x, y, vx, vy, gravedad, vida, vidaMax: vida, tamano,
      giro: Math.random() * Math.PI,
      velGiro: (Math.random() - 0.5) * 0.2,
      color: this.colores[Math.floor(Math.random() * this.colores.length)],
      estrella: Math.random() > 0.35
    });
    if (this.cicloId === null) {
      this.zone.runOutsideAngular(() => {
        this.cicloId = requestAnimationFrame(() => this.dibujar());
      });
    }
  }

  private dibujar(): void {
    this.cicloId = null;
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const vivas: Particula[] = [];
    for (const p of this.particulas) {
      p.vida -= 1;
      if (p.vida <= 0) continue;
      p.vx *= 0.97;
      p.vy = p.vy * 0.97 + p.gravedad;
      p.x += p.vx;
      p.y += p.vy;
      p.giro += p.velGiro;

      const t = p.vida / p.vidaMax;
      const s = p.tamano * (0.4 + 0.6 * t);
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.beginPath();
      if (p.estrella) {
        // Estrella de 4 puntas con curvas hacia el centro
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(0, 0, s, 0);
        ctx.quadraticCurveTo(0, 0, 0, s);
        ctx.quadraticCurveTo(0, 0, -s, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s);
      } else {
        ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
      vivas.push(p);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    this.particulas = vivas;

    if (vivas.length) {
      this.cicloId = requestAnimationFrame(() => this.dibujar());
    }
  }
}
