# Color, calendario y Kanban de tareas

## Objetivo

Hacer la interfaz más llamativa y fácil de escanear mediante color funcional, sin cambiar la estructura ni reemplazar los componentes existentes. Agenda debe comportarse como calendario mensual y Tareas debe sumar una vista Kanban.

## Alcance visual

- Mantener tipografía, espaciado, navegación, tarjetas, tablas y formularios actuales.
- Cambiar el color primario neutro por azul y añadir una paleta semántica reutilizable: azul para planificación, violeta para hitos, ámbar para pendientes, verde para completados y rojo para rechazo o cancelación.
- Usar fondos suaves, bordes o barras superiores de color; evitar superficies saturadas que reduzcan la legibilidad.
- Dar color a estados, métricas, columnas Kanban, eventos del calendario y selección activa de navegación.
- Mantener contraste y equivalencia en modo oscuro.

## Agenda

La ruta `/agenda` mostrará un calendario mensual de lunes a domingo. El encabezado tendrá el nombre del mes, controles para mes anterior, hoy y mes siguiente, junto con el filtro existente por tipo. Cada celda mostrará su número y los hitos correspondientes: inicio de evento, término de evento o vencimiento de tarea. Los días fuera del mes serán visibles con menor contraste para mantener la cuadrícula completa. El día actual tendrá una señal azul y cada hito conservará un color por tipo.

El filtro temporal anterior se elimina porque la navegación mensual pasa a controlar el período visible. Los elementos de eventos continuarán enlazando a la ficha del evento. En móvil el calendario conservará siete columnas y ofrecerá desplazamiento horizontal para no comprimir el contenido.

## Tareas

La ruta `/tasks` conservará filtros, alta, edición y eliminación. Añadirá un selector de vista persistente con Tabla y Kanban. Kanban tendrá columnas estables para Pendiente, En curso, Completada y Cancelada, coloreadas según su estado. Cada tarjeta mostrará título, evento, responsable, etapa, prioridad y vencimiento, además de los controles de edición y eliminación ya existentes.

La tabla conservará sus acciones actuales y el Kanban ofrecerá los mismos controles dentro de cada tarjeta, sin alterar el flujo existente. En esta iteración no se crearán rutas de detalle de tarea ni arrastre entre columnas.

## Límites y pruebas

- Sin nuevas dependencias ni cambios al esquema de `localStorage`.
- Las preferencias de vista seguirán usando el mecanismo existente.
- Pruebas unitarias cubrirán la matriz mensual y la agrupación por estado.
- Pruebas de componente cubrirán el selector Kanban de Tareas y la semántica visual de estados.
- La validación final incluirá pruebas enfocadas, lint, build y revisión en navegador de Agenda y Tareas en escritorio y móvil.
