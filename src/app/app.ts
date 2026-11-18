import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ScrollSuave } from './core/scroll-suave';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('moviFy-Frontend');
  private readonly scroll = inject(ScrollSuave);

  ngOnInit(): void {
    this.scroll.iniciar();
  }
}
