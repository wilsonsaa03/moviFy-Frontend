import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment'; // Asumiendo que environment está disponible

@Component({
  selector: 'app-ver-mi-perfil-conductor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ver-mi-perfil-conductor.html',
  styleUrls: ['./ver-mi-perfil-conductor.css']
})
export class VerMiPerfilConductorComponent implements OnInit {
  // Propiedades existentes (placeholder)
  nombre: string = '';
  correo: string = '';
  estadoCuenta: string = ''; // Asumiendo que esto existe para el estado de los documentos
  estadoSoat: string = 'Vigente'; // Placeholder para el estado del SOAT

  // Documentos
  cedula: string = '';
  licenciaDoc: string = '';
  soatDoc: string = '';
  tarjetaPropiedad: string = '';

  constructor(private router: Router) {} // Asumiendo que Router está inyectado

  ngOnInit(): void {
    // Placeholder para cargar los datos del perfil
    this.cargarPerfilConductor();
  }

  async cargarPerfilConductor(): Promise<void> {
    const usuarioId = localStorage.getItem('id'); // Asumiendo que el ID del usuario está en localStorage
    if (!usuarioId) {
      alert('No se encontró el ID del usuario.');
      this.router.navigate(['/login']); // Redirigir a login o home
      return;
    }

    try {
      const resp = await fetch(`${environment.apiUrl}/conductor/perfil/${usuarioId}`);
      if (!resp.ok) {
        throw new Error(`Error al obtener el perfil: ${resp.statusText}`);
      }
      const data = await resp.json();
      console.log('Datos del perfil del conductor:', data);

      this.nombre = data.nombre || '';
      this.correo = data.correo || '';
      this.estadoCuenta = data.estado || 'desconocido'; // Asumiendo 'estado' del backend
      // Podrías necesitar calcular estadoSoat basado en una fecha del backend
      // Por ahora, usando un valor estático o una verificación simple
      // this.estadoSoat = this.calcularEstadoSoat(data.fecha_vencimiento_soat);

      // Documentos
      this.cedula = data.cedula || '';
      this.licenciaDoc = data.licencia || '';
      this.soatDoc = data.soat || '';
      this.tarjetaPropiedad = data.tarjeta_propiedad || '';

    } catch (error) {
      console.error('Error al cargar el perfil del conductor:', error);
      alert('Error al cargar el perfil.');
      // Manejar el error, por ejemplo, redirigir o mostrar un mensaje
    }
  }

  verDocumento(nombreArchivo: string): void {
    if (!nombreArchivo) {
      alert('Documento no disponible.');
      return;
    }
    const url = `${environment.apiUrl}/conductor/documento/${encodeURIComponent(nombreArchivo)}`;
    window.open(url, '_blank');
  }

  // Otros métodos existentes irían aquí
  volver(): void {
    this.router.navigate(['/home-conductor']); // Asumiendo una ruta de inicio para conductores
  }
}