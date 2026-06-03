import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ConductorService } from '../../Base_de_datos/conductor.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mis-viajes-conductor',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-viajes-conductor.html',
  styleUrls: ['./mis-viajes-conductor.css']
})
export class MisViajesConductorComponent implements OnInit {
  nombre: string = '';
  conductorId: number | null = null;
  viajes: any[] = [];
  stats: any = { viajes_hoy: 0, ganancias_hoy: 0, activos: 0 };
  cargando: boolean = true;
  calificacion: number = 4.9; // Esto podría venir del perfil

  constructor(
    private conductorService: ConductorService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const correo = localStorage.getItem('correo');
    if (!correo) {
      this.router.navigate(['/login']);
      return;
    }

    // Primero obtenemos el ID del conductor
    this.conductorService.obtenerPerfil(correo).subscribe({
      next: (perfil: any) => {
        this.nombre = perfil.nombre;
        this.conductorId = perfil.conductor_id || perfil.id;
        this.calificacion = perfil.calificacion || 4.9;
        if (this.conductorId) {
          this.cargarViajes();
        }
      },
      error: () => this.cargando = false
    });
  }

  cargarViajes(): void {
    fetch(`${environment.apiUrl}/transporte/historial-conductor/${this.conductorId}`)
      .then(res => res.json())
      .then(data => {
        this.viajes = data.viajes;
        this.stats = data.stats;
        this.cargando = false;
      })
      .catch(err => {
        console.error('Error cargando historial:', err);
        this.cargando = false;
      });
  }

  getBadgeClass(estado: string): string {
    const e = estado?.toUpperCase();
    if (e === 'FINALIZADO') return 'completed-badge';
    if (e === 'CANCELADO' || e === 'RECHAZADO') return 'cancelled-badge';
    return 'in-progress-badge';
  }

  getFriendlyEstado(estado: string): string {
    if (estado === 'FINALIZADO') return '✓ COMPLETADO';
    if (estado === 'CANCELADO') return '✕ CANCELADO';
    if (estado === 'ACEPTADO' || estado === 'EN_VIAJE') return '● EN CURSO';
    return estado;
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  verDetalle(viajeId: number) {
    // Lógica para ver detalle si fuera necesario
  }
}