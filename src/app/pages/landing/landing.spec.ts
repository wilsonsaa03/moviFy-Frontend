import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LandingComponent } from './landing';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('cambia el servicio seleccionado', () => {
    component.elegir('taxi');
    expect(component.servicio().titulo).toBe('Transporte en taxi');
  });

  it('al tocar un estado pausa el recorrido automático', () => {
    component.irAPaso(3);
    expect(component.paso()).toBe(3);
    expect(component.automatico()).toBe(false);
  });
});
