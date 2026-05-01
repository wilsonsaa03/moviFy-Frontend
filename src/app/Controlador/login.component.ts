import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService } from '../Base_de_datos/usuario.service';
import { Usuario } from '../Modelo/usuario.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  usuario: Usuario = { correo: '', password: '', rol: '' };
  error = '';

  constructor(private usuarioService: UsuarioService, private router: Router) {}

  onLogin(): void {
    this.usuarioService.login(this.usuario).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('rol', res.rol);
        localStorage.setItem('nombre', res.nombre);
        if (res.rol === 'admin') this.router.navigate(['/admin']);
        else if (res.rol === 'conductor') this.router.navigate(['/conductor']);
        else this.router.navigate(['/cliente']);
      },
      error: () => this.error = 'Correo o contraseña incorrectos'
    });
  }
}