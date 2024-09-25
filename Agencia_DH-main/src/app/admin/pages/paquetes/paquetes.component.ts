import { Component, OnInit } from '@angular/core';
import { ServicioGenericoCRUD } from '../../../core/services/CRUDS/crud-servicio.service';
import { UsuariosService, Usuario } from '../../../core/services/usuarios.service'; 
import { Paquete } from '../../../interfaces/CRUDS/tablas.interface';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-paquetes',
  templateUrl: './paquetes.component.html',
  styleUrls: ['./paquetes.component.scss']
})
export class PaquetesComponent implements OnInit {
  paquetes: any[] = [];
  usuarios: any[] = []; 
  
  paquetesFiltrados: any[] = [];
  paqueteForm!: FormGroup;
  editingPaquete: Paquete | null = null;
  showEditForm: boolean = false;

  filtroTipo: string = 'todos';
  filtroCostoMin: number | null = null;
  filtroCostoMax: number | null = null;

  usuariosBuscados: Usuario[] = [];
  usuarioSeleccionado: Usuario | null = null;

  private searchTerms = new Subject<string>();

  constructor(
    private genericService: ServicioGenericoCRUD,
    private usuariosService: UsuariosService, // Inyectamos el nuevo servicio
    private fb: FormBuilder,
  ) {
    this.paqueteForm = this.fb.group({
      nom_paquete: ['', Validators.required],
      tipo_paquete: ['', Validators.required],
      costo_paquete: ['', [Validators.required, Validators.min(1)]]
    });

    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => this.usuariosService.buscarUsuarios(term))
    ).subscribe(usuarios => {
      this.usuariosBuscados = usuarios;
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();
    this.cargarPaquetes();
  }


  cargarPaquetes() {
    this.genericService.getAll<Paquete>('Paquete').subscribe(
      data => {
        this.paquetes = data;
        this.paquetes.forEach(paquete => {
          this.genericService.getPaqueteCompleto(paquete.id_paquete).subscribe(
            paqueteCompleto => {
              Object.assign(paquete, paqueteCompleto);
              // Cargar usuarios asignados
              this.cargarUsuariosAsignados(paquete);
              console.log('Paquete completo cargado:', paquete);
            },
            error => {
              console.error('Error al obtener paquete completo:', error);
            }
          );
        });
        this.filtrarPaquetes();
      },
      error => {
        console.error('Error al obtener Paquetes:', error);
      }
    );
  }
  
  cargarUsuariosAsignados(paquete: Paquete) {
    this.genericService.getUsuariosAsignados(paquete.id_paquete).subscribe(
      usuarios => {
        paquete.usuariosAsignados = usuarios;
      },
      error => {
        console.error('Error al cargar usuarios asignados:', error);
      }
    );
  }

  filtrarPaquetes() {
    this.paquetesFiltrados = this.paquetes.filter(paquete => {
      const cumpleTipo = this.filtroTipo === 'todos' || paquete.tipo_paquete === this.filtroTipo;
      const cumpleCostoMin = this.filtroCostoMin === null || paquete.costo_paquete >= this.filtroCostoMin;
      const cumpleCostoMax = this.filtroCostoMax === null || paquete.costo_paquete <= this.filtroCostoMax;
      return cumpleTipo && cumpleCostoMin && cumpleCostoMax;
    });
  }

  editarPaquete(paquete: Paquete) {
    this.editingPaquete = paquete;
    this.paqueteForm.patchValue({
      nom_paquete: paquete.nom_paquete,
      tipo_paquete: paquete.tipo_paquete,
      costo_paquete: paquete.costo_paquete
    });
    this.showEditForm = true;

  }

  actualizarPaquete() {
    if (this.paqueteForm.valid && this.editingPaquete) {
      const paqueteActualizado = {
        nom_paquete: this.paqueteForm.get('nom_paquete')?.value,
        tipo_paquete: this.paqueteForm.get('tipo_paquete')?.value,
        costo_paquete: this.paqueteForm.get('costo_paquete')?.value
      };
  
      this.genericService.update(this.editingPaquete.id_paquete, paqueteActualizado).subscribe(
        (response) => {
          Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'El paquete se ha actualizado correctamente.',
          });
          this.cargarPaquetes();
          this.cancelarEdicion();
        },
        error => {
          console.error('Error al actualizar el paquete:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el paquete. Por favor, intenta de nuevo.',
          });
        }
      );
    }
  }
  
  eliminarPaquete(paquete: Paquete) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar el paquete "${paquete.nom_paquete}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.genericService.delete('Paquete', paquete.id_paquete).subscribe(
          (response) => {
            if (response && response.message === 'Paquete eliminado exitosamente') {
              Swal.fire(
                '¡Eliminado!',
                'El paquete y sus asignaciones han sido eliminados correctamente.',
                'success'
              );
              this.cargarPaquetes();
            } else {
              Swal.fire(
                'Error',
                'Hubo un problema al eliminar el paquete.',
                'error'
              );
            }
          },
          error => {
            console.error('Error al eliminar el paquete:', error);
            Swal.fire(
              'Error',
              'No se pudo eliminar el paquete. Por favor, intenta de nuevo.',
              'error'
            );
          }
        );
      }
    });
  }

  cancelarEdicion() {
    this.editingPaquete = null;
    this.paqueteForm.reset();
    this.showEditForm = false;
  }

  buscarUsuarios(term: string): void {
    this.searchTerms.next(term);
  }

  seleccionarUsuario(usuario: Usuario): void {
    this.usuarioSeleccionado = usuario;
  }

  cargarUsuarios() {
    this.usuariosService.getAllUsuarios().subscribe({
      next: (data) => {
        this.usuarios = data;
        console.log('Usuarios cargados en el componente:', this.usuarios);
        if (this.usuarios.length === 0) {
          console.log('No se encontraron usuarios con rol "usuario"');
        }
      },
      error: (error) => {
        console.error('Error al obtener Usuarios:', error);
      }
    });
  }

    asignarPaquete(paquete: Paquete) {
      Swal.fire({
        title: 'Gestionar Asignación de Paquete',
        html: `
          <input id="buscarUsuario" class="swal2-input" placeholder="Buscar usuario">
          <div id="resultadosBusqueda" style="max-height: 200px; overflow-y: auto; margin-top: 10px;"></div>
          <p id="usuarioSeleccionado" style="margin-top: 10px; font-weight: bold;"></p>
          <div id="usuariosAsignados" style="margin-top: 20px;">
            <h4>Usuarios Asignados:</h4>
            <ul id="listaUsuariosAsignados"></ul>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Asignar',
        cancelButtonText: 'Cerrar',
        showDenyButton: true,
        denyButtonText: 'Desasignar',
        didOpen: () => {
          const input = Swal.getPopup()!.querySelector('#buscarUsuario') as HTMLInputElement;
          const resultados = Swal.getPopup()!.querySelector('#resultadosBusqueda') as HTMLDivElement;
          const seleccionado = Swal.getPopup()!.querySelector('#usuarioSeleccionado') as HTMLParagraphElement;
          const listaUsuariosAsignados = Swal.getPopup()!.querySelector('#listaUsuariosAsignados') as HTMLUListElement;
    
          // Cargar usuarios asignados
          this.cargarUsuariosAsignados(paquete);
          this.actualizarListaUsuariosAsignados(listaUsuariosAsignados, paquete);
    
          input.addEventListener('input', () => {
            this.buscarUsuarios(input.value);
          });
    
          const usuariosSubject = new Subject<Usuario[]>();
    
          usuariosSubject.subscribe(usuarios => {
            resultados.innerHTML = usuarios.map(u => `
              <div class="usuario-item" data-id="${u.id_usr}" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">
                ${u.nom_usr} ${u.app_usr}
              </div>
            `).join('');
    
            resultados.querySelectorAll('.usuario-item').forEach(item => {
              item.addEventListener('click', (e) => {
                const userId = (e.target as HTMLElement).getAttribute('data-id');
                const usuario = usuarios.find(u => u.id_usr.toString() === userId);
                if (usuario) {
                  this.usuarioSeleccionado = usuario;
                  seleccionado.textContent = `Usuario seleccionado: ${usuario.nom_usr} ${usuario.app_usr}`;
                  resultados.querySelectorAll('.usuario-item').forEach((el) => {
                    (el as HTMLElement).style.backgroundColor = '';
                  });
                  ((e.target as HTMLElement).style.backgroundColor = '#e0e0e0');
                }
              });
            });
          });
    
          this.searchTerms.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap((term: string) => this.usuariosService.buscarUsuarios(term))
          ).subscribe(usuarios => {
            this.usuariosBuscados = usuarios;
            usuariosSubject.next(usuarios);
          });
        },
        preConfirm: () => {
          if (!this.usuarioSeleccionado) {
            Swal.showValidationMessage('Debe seleccionar un usuario para asignar');
            return false;
          }
          return this.usuarioSeleccionado.id_usr;
        },
        preDeny: () => {
          if (!this.usuarioSeleccionado) {
            Swal.showValidationMessage('Debe seleccionar un usuario para desasignar');
            return false;
          }
          return this.usuarioSeleccionado.id_usr;
        }
      }).then((result) => {
        if (result.isConfirmed && this.usuarioSeleccionado) {
          this.asignarUsuarioPaquete(paquete, this.usuarioSeleccionado);
        } else if (result.isDenied && this.usuarioSeleccionado) {
          this.desasignarUsuarioPaquete(paquete, this.usuarioSeleccionado);
        }
      });
    }
    
    private actualizarListaUsuariosAsignados(lista: HTMLUListElement, paquete: Paquete) {
      lista.innerHTML = '';
      if (paquete.usuariosAsignados && paquete.usuariosAsignados.length > 0) {
        paquete.usuariosAsignados.forEach(usuario => {
          const li = document.createElement('li');
          li.textContent = `${usuario.nom_usr} ${usuario.app_usr}`;
          li.style.cursor = 'pointer';
          li.addEventListener('click', () => {
            this.usuarioSeleccionado = usuario;
            (Swal.getPopup()!.querySelector('#usuarioSeleccionado') as HTMLParagraphElement).textContent = 
              `Usuario seleccionado: ${usuario.nom_usr} ${usuario.app_usr}`;
          });
          lista.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = 'No hay usuarios asignados';
        lista.appendChild(li);
      }
    }
    
    private asignarUsuarioPaquete(paquete: Paquete, usuario: Usuario) {
      const asignacion = {
        id_paquete: paquete.id_paquete,
        id_usr: usuario.id_usr
      };
    
      this.genericService.asignarUsuarioPaquete(asignacion).subscribe(
        response => {
          console.log('Asignación exitosa', response);
          Swal.fire('Éxito', 'Paquete asignado correctamente', 'success');
          this.cargarUsuariosAsignados(paquete);
        },
        error => {
          console.error('Error al asignar paquete:', error);
          Swal.fire('Error', 'No se pudo asignar el paquete. ' + (error.error?.error || ''), 'error');
        }
      );
    }
    
    private desasignarUsuarioPaquete(paquete: Paquete, usuario: Usuario) {
      this.genericService.desasignarUsuarioPaquete(paquete.id_paquete, usuario.id_usr).subscribe(
        (        response: any) => {
          console.log('Desasignación exitosa', response);
          Swal.fire('Éxito', 'Usuario desasignado correctamente del paquete', 'success');
          this.cargarUsuariosAsignados(paquete);
        },
        (        error: { error: { error: any; }; }) => {
          console.error('Error al desasignar usuario del paquete:', error);
          Swal.fire('Error', 'No se pudo desasignar el usuario del paquete. ' + (error.error?.error || ''), 'error');
        }
      );
    }

}