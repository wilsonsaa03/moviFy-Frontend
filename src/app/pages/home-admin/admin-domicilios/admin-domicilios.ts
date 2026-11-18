import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { environment } from '../../../../environments/environment';
import { AdminIcoComponent } from '../admin-ico';

type Categoria = 'comida' | 'farmacia' | 'mercado' | 'licores' | 'tienda';

interface Comercio {
  id?: number;
  nombre: string;
  categoria: Categoria;
  descripcion: string | null;
  foto_url: string | null;
  direccion: string;
  barrio: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  abre: string;
  cierra: string;
  pedido_minimo: number;
  radio_km: number;
  minutos_preparacion: number;
  activo: boolean;
  orden: number;
  abierto?: boolean;
  productos?: number;
  pedidos?: number;
}

interface Opcion {
  nombre: string;
  precio_extra: number;
  disponible: boolean;
}

interface Grupo {
  nombre: string;
  minimo: number;
  maximo: number;
  opciones: Opcion[];
}

interface Producto {
  id?: number;
  seccion: string;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  precio: number;
  disponible: boolean;
  solo_mayores: boolean;
  orden: number;
  grupos: Grupo[];
}

interface Cupon {
  id?: number;
  codigo: string;
  descripcion: string;
  tipo: 'porcentaje' | 'valor' | 'envio';
  valor: number;
  tope_descuento: number | null;
  minimo_compra: number;
  comercio_id: number | null;
  comercio_nombre?: string | null;
  solo_primer_pedido: boolean;
  usos_por_cliente: number;
  usos_totales: number | null;
  vence_en: string | null;
  activo: boolean;
  usados?: number;
  vencido?: boolean;
}

const CATEGORIAS: { id: Categoria; nombre: string }[] = [
  { id: 'comida', nombre: 'Comida' },
  { id: 'farmacia', nombre: 'Farmacia' },
  { id: 'mercado', nombre: 'Mercado' },
  { id: 'licores', nombre: 'Licores (+18)' },
  { id: 'tienda', nombre: 'Tienda' },
];

/**
 * Domicilios con catálogo (V24): el admin carga los comercios aliados, sus productos con grupos de opciones
 * (tamaños, adiciones, "sin cebolla") y los cupones simulados. Soporte solo mira.
 *   /api/admin/domicilios/comercios · /comercios/{id}/productos · /productos/{id} · /cupones · /fotos
 */
@Component({
  selector: 'app-admin-domicilios',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-domicilios.html',
  styleUrl: './admin-domicilios.css',
})
export class AdminDomiciliosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cd = inject(ChangeDetectorRef);
  @Input() soloLectura = false;
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();

  readonly categorias = CATEGORIAS;
  vista: 'comercios' | 'cupones' = 'comercios';
  comercios: Comercio[] = [];
  cupones: Cupon[] = [];
  cargando = false;
  error = '';

  /** Comercio abierto para ver sus productos. */
  comercioSel: Comercio | null = null;
  productos: Producto[] = [];

  // Formularios (modales)
  formComercio: Comercio | null = null;
  formProducto: Producto | null = null;
  formCupon: Cupon | null = null;
  guardando = false;
  errorForm = '';
  subiendoFoto = false;

  ngOnInit(): void {
    this.cargarComercios();
  }

  nombreCategoria(c: Categoria): string {
    return CATEGORIAS.find((x) => x.id === c)?.nombre ?? c;
  }

  urlFoto(f: string | null | undefined): string | null {
    if (!f) return null;
    if (/^https?:/.test(f)) return f;
    return environment.apiUrl.replace(/\/api\/?$/, '') + f;
  }

  pesos(n: number | null | undefined): string {
    return '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(n ?? 0));
  }

  cambiarVista(v: 'comercios' | 'cupones'): void {
    this.vista = v;
    this.comercioSel = null;
    if (v === 'cupones') this.cargarCupones();
    else this.cargarComercios();
  }

  // ───────────── Comercios ─────────────

  async cargarComercios(): Promise<void> {
    this.cargando = true;
    try {
      this.comercios = await this.api.get<Comercio[]>('/admin/domicilios/comercios');
      this.error = '';
    } catch (e) {
      this.error = ApiService.mensaje(e, 'No se pudieron cargar los comercios.');
    } finally {
      this.cargando = false;
      this.cd.markForCheck();
    }
  }

  nuevoComercio(): void {
    this.errorForm = '';
    this.formComercio = {
      nombre: '', categoria: 'comida', descripcion: null, foto_url: null, direccion: '', barrio: null,
      lat: 3.8801, lng: -77.0312, telefono: null, abre: '08:00', cierra: '20:00', pedido_minimo: 0,
      radio_km: 8, minutos_preparacion: 15, activo: true, orden: 0,
    };
  }

  editarComercio(c: Comercio): void {
    this.errorForm = '';
    this.formComercio = { ...c, telefono: c.telefono ? c.telefono.replace(/^\+57/, '') : null };
  }

  async guardarComercio(): Promise<void> {
    const f = this.formComercio;
    if (!f || this.guardando) return;
    this.guardando = true;
    this.errorForm = '';
    try {
      const cuerpo = { ...f, telefono: f.telefono?.trim() || null, descripcion: f.descripcion?.trim() || null, barrio: f.barrio?.trim() || null };
      const r = f.id
        ? await this.api.put<{ message: string }>(`/admin/domicilios/comercios/${f.id}`, cuerpo)
        : await this.api.post<{ message: string }>('/admin/domicilios/comercios', cuerpo);
      this.formComercio = null;
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      await this.cargarComercios();
    } catch (e) {
      this.errorForm = ApiService.mensaje(e, 'No se pudo guardar el comercio.');
    } finally {
      this.guardando = false;
      this.cd.markForCheck();
    }
  }

  async borrarComercio(c: Comercio): Promise<void> {
    if (!confirm(`¿Borrar "${c.nombre}" y todos sus productos? Los pedidos que ya se hicieron no cambian.`)) return;
    try {
      const r = await this.api.delete<{ message: string }>(`/admin/domicilios/comercios/${c.id}`);
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      await this.cargarComercios();
    } catch (e) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(e, 'No se pudo borrar.') });
    }
  }

  // ───────────── Productos ─────────────

  async verProductos(c: Comercio): Promise<void> {
    this.comercioSel = c;
    this.productos = [];
    await this.cargarProductos();
  }

  async cargarProductos(): Promise<void> {
    if (!this.comercioSel) return;
    try {
      const r = await this.api.get<{ productos: (Producto & { grupos: (Grupo & { obligatorio?: boolean })[] })[] }>(
        `/admin/domicilios/comercios/${this.comercioSel.id}/productos`,
      );
      this.productos = r.productos;
      this.error = '';
    } catch (e) {
      this.error = ApiService.mensaje(e, 'No se pudieron cargar los productos.');
    }
    this.cd.markForCheck();
  }

  /** Secciones ya usadas en este comercio (para sugerirlas al escribir). */
  get secciones(): string[] {
    return [...new Set(this.productos.map((p) => p.seccion))];
  }

  nuevoProducto(): void {
    this.errorForm = '';
    this.formProducto = {
      seccion: this.secciones[0] ?? 'Productos', nombre: '', descripcion: null, foto_url: null, precio: 0, disponible: true,
      solo_mayores: this.comercioSel?.categoria === 'licores', orden: this.productos.length, grupos: [],
    };
  }

  editarProducto(p: Producto): void {
    this.errorForm = '';
    // Copia profunda: lo que se edita en el formulario no toca la tabla hasta guardar
    this.formProducto = {
      ...p,
      grupos: p.grupos.map((g) => ({
        nombre: g.nombre, minimo: g.minimo, maximo: g.maximo,
        opciones: g.opciones.map((o) => ({ nombre: o.nombre, precio_extra: Number(o.precio_extra), disponible: o.disponible })),
      })),
    };
  }

  agregarGrupo(): void {
    this.formProducto?.grupos.push({ nombre: '', minimo: 0, maximo: 1, opciones: [{ nombre: '', precio_extra: 0, disponible: true }] });
  }

  quitarGrupo(i: number): void {
    this.formProducto?.grupos.splice(i, 1);
  }

  agregarOpcion(g: Grupo): void {
    g.opciones.push({ nombre: '', precio_extra: 0, disponible: true });
  }

  quitarOpcion(g: Grupo, i: number): void {
    g.opciones.splice(i, 1);
  }

  ayudaGrupo(g: Grupo): string {
    if (g.minimo >= 1) return g.minimo === g.maximo ? `Obligatorio: el cliente elige ${g.minimo}` : `Obligatorio: entre ${g.minimo} y ${g.maximo}`;
    return g.maximo === 1 ? 'Opcional: hasta 1' : `Opcional: hasta ${g.maximo}`;
  }

  async guardarProducto(): Promise<void> {
    const f = this.formProducto;
    if (!f || !this.comercioSel || this.guardando) return;
    this.guardando = true;
    this.errorForm = '';
    try {
      const cuerpo = { ...f, descripcion: f.descripcion?.trim() || null };
      const r = f.id
        ? await this.api.put<{ message: string }>(`/admin/domicilios/productos/${f.id}`, cuerpo)
        : await this.api.post<{ message: string }>(`/admin/domicilios/comercios/${this.comercioSel.id}/productos`, cuerpo);
      this.formProducto = null;
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      await this.cargarProductos();
    } catch (e) {
      this.errorForm = ApiService.mensaje(e, 'No se pudo guardar el producto.');
    } finally {
      this.guardando = false;
      this.cd.markForCheck();
    }
  }

  async alternarDisponible(p: Producto): Promise<void> {
    try {
      await this.api.put(`/admin/domicilios/productos/${p.id}/disponible`, { disponible: !p.disponible });
      p.disponible = !p.disponible;
    } catch (e) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(e, 'No se pudo cambiar.') });
    }
    this.cd.markForCheck();
  }

  async borrarProducto(p: Producto): Promise<void> {
    if (!confirm(`¿Borrar "${p.nombre}"?`)) return;
    try {
      const r = await this.api.delete<{ message: string }>(`/admin/domicilios/productos/${p.id}`);
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      await this.cargarProductos();
    } catch (e) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(e, 'No se pudo borrar.') });
    }
  }

  // ───────────── Fotos ─────────────

  async subirFoto(ev: Event, destino: 'comercio' | 'producto'): Promise<void> {
    const campo = ev.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!archivo) return;
    this.subiendoFoto = true;
    try {
      const form = new FormData();
      form.append('foto', archivo);
      const r = await this.api.post<{ foto_url: string }>('/admin/domicilios/fotos', form);
      if (destino === 'comercio' && this.formComercio) this.formComercio.foto_url = r.foto_url;
      if (destino === 'producto' && this.formProducto) this.formProducto.foto_url = r.foto_url;
    } catch (e) {
      this.errorForm = ApiService.mensaje(e, 'No se pudo subir la foto (JPG, PNG o WEBP de hasta 10 MB).');
    } finally {
      this.subiendoFoto = false;
      this.cd.markForCheck();
    }
  }

  // ───────────── Cupones ─────────────

  async cargarCupones(): Promise<void> {
    this.cargando = true;
    try {
      this.cupones = await this.api.get<Cupon[]>('/admin/domicilios/cupones');
      if (!this.comercios.length) this.comercios = await this.api.get<Comercio[]>('/admin/domicilios/comercios');
      this.error = '';
    } catch (e) {
      this.error = ApiService.mensaje(e, 'No se pudieron cargar los cupones.');
    } finally {
      this.cargando = false;
      this.cd.markForCheck();
    }
  }

  nuevoCupon(): void {
    this.errorForm = '';
    this.formCupon = {
      codigo: '', descripcion: '', tipo: 'porcentaje', valor: 10, tope_descuento: null, minimo_compra: 0, comercio_id: null,
      solo_primer_pedido: false, usos_por_cliente: 1, usos_totales: null, vence_en: null, activo: true,
    };
  }

  editarCupon(c: Cupon): void {
    this.errorForm = '';
    this.formCupon = { ...c, vence_en: c.vence_en ? c.vence_en.substring(0, 10) : null };
  }

  textoCupon(c: Cupon): string {
    if (c.tipo === 'porcentaje') return `${c.valor} %${c.tope_descuento ? ' hasta ' + this.pesos(c.tope_descuento) : ''}`;
    if (c.tipo === 'envio') return `Domicilio gratis (hasta ${this.pesos(c.valor)})`;
    return `${this.pesos(c.valor)} menos`;
  }

  async guardarCupon(): Promise<void> {
    const f = this.formCupon;
    if (!f || this.guardando) return;
    this.guardando = true;
    this.errorForm = '';
    try {
      // La fecha del formulario (aaaa-mm-dd) vence al final de ese día en Colombia
      const cuerpo = { ...f, vence_en: f.vence_en ? `${f.vence_en}T23:59:59-05:00` : null, tope_descuento: f.tope_descuento || null,
        usos_totales: f.usos_totales || null, comercio_id: f.comercio_id || null };
      const r = f.id
        ? await this.api.put<{ message: string }>(`/admin/domicilios/cupones/${f.id}`, cuerpo)
        : await this.api.post<{ message: string }>('/admin/domicilios/cupones', cuerpo);
      this.formCupon = null;
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      await this.cargarCupones();
    } catch (e) {
      this.errorForm = ApiService.mensaje(e, 'No se pudo guardar el cupón.');
    } finally {
      this.guardando = false;
      this.cd.markForCheck();
    }
  }

  async borrarCupon(c: Cupon): Promise<void> {
    if (!confirm(`¿Borrar el cupón ${c.codigo}?`)) return;
    try {
      const r = await this.api.delete<{ message: string }>(`/admin/domicilios/cupones/${c.id}`);
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      await this.cargarCupones();
    } catch (e) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(e, 'No se pudo borrar.') });
    }
  }
}
