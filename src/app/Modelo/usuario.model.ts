export interface Usuario {
  id?: number;
  nombre?: string;
  correo: string;
  password: string;
  telefono?: string;
  rol: string;
}