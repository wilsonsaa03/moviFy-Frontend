import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // <--- IMPORTANTE

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule], // <--- IMPORTANTE: Agregarlo aquí
  templateUrl: './landing.html',
  styleUrls: ['./landing.css']
})
export class LandingComponent {
  // Como Scrum Master, mantén este archivo limpio para el equipo
}