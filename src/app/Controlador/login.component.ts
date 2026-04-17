import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Obligatorio para Standalone
import { FormsModule } from '@angular/forms'; // <--- ESTO QUITA EL ERROR ROJO DEL HTML
import { Router } from '@angular/router';
import { UsuarioService } from '../Base_de_datos/usuario.service';
import { Usuario } from '../Modelo/usuario.model';

@Component({
  selector: 'app-login',
  standalone: true, // Tu versión de Angular es moderna
  imports: [CommonModule, FormsModule], // <--- ESTO ACTIVA EL [(ngModel)]
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  usuario: Usuario = { correo: '', contrasena: '', rol: '' };

  constructor(private usuarioService: UsuarioService, private router: Router) { }

  onLogin(): void {
    this.usuarioService.login(this.usuario).subscribe({
      next: (res: any) => {
        console.log('Login exitoso', res);
        this.router.navigate(['/inicio']);
      },
      error: (err: any) => alert('Credenciales incorrectas')
    });
  }
}