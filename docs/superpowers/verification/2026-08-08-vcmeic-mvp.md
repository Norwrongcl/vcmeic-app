# Verificación del MVP VCM EIC con LocalStorage

Fecha: 8 de agosto de 2026

## Alcance verificado

Se verificó el MVP local-first completo: Inicio, Actividades, Eventos, Agenda,
Tareas, Convenios, Socios, Contactos, Recursos, Reportes y Configuración.

El flujo funcional ejecutado en el navegador fue:

1. Crear el socio `Fundación Horizonte QA`.
2. Crear el contacto `Daniela Muñoz QA` y asociarlo al socio.
3. Registrar una actividad puntual ya realizada, con responsable y cantidad
   general de participantes.
4. Recargar la aplicación.
5. Confirmar que socio, contacto y actividad continúan visibles.

También se recorrió un evento existente y se comprobaron sus pestañas de
Resumen, Pre-evento, Durante, Post-evento y Presupuesto y gastos. El apartado
post-evento presenta cierre con participantes, resultados y evidencias, sin
convertir el evento en una actividad.

## Verificación automatizada

- `npm test -- src/features/core src/features/events src/features/activities src/features/directory src/features/agreements src/features/resources`
  - 13 archivos aprobados.
  - 36 pruebas aprobadas.
- `npm run lint`
  - Aprobado sin errores.
- `npm run build`
  - TypeScript y compilación de producción aprobados.
- Formato de todos los archivos modificados en esta entrega:
  - Aprobado con Prettier.

El chequeo global `npm run format:check` sigue informando 11 archivos heredados
de la plantilla que no fueron modificados por este MVP. No afectan la
compilación ni los flujos verificados.

La suite global `npm test` queda en 90 pruebas aprobadas y 76 fallidas. Las 76
fallas están en pruebas heredadas de autenticación, usuarios, tareas y
configuración que todavía buscan textos o controles en inglés (por ejemplo,
`Continue`, `Email`, `Delete` y `Open theme settings`) mientras la interfaz ya
está en español o esos controles no forman parte de la navegación VCM EIC. Las
13 suites del alcance MVP sí están verdes y se ejecutaron nuevamente después de
la verificación manual.

## Verificación en navegador

- Navegador: navegador integrado de Codex contra `http://127.0.0.1:5173`.
- Escritorio: 1440 × 900.
- Móvil: 390 × 844.
- Consola: sin errores ni advertencias durante el recorrido.
- Responsive: sin desplazamiento horizontal en Inicio, Eventos, Actividades,
  Agenda, Reportes y Configuración.
- Formulario móvil de actividad: 358 px de ancho dentro del viewport y scroll
  vertical interno para sus campos.

## Registro de fidelidad visual

La pantalla de Eventos existente se tomó como referencia visual del producto.

| Punto de comparación | Resultado |
| --- | --- |
| Navegación lateral y encabezado | Se conserva la misma estructura, contraste, iconografía y estado activo. |
| Jerarquía tipográfica | Títulos, descripciones y datos secundarios mantienen escala y peso coherentes. |
| Tarjetas de métricas | Actividades, Inicio y Eventos usan el mismo borde, radio, espaciado e iconos. |
| Filtros y tablas | Se conserva el lenguaje de inputs, selects, encabezados y acciones compactas. |
| Ritmo espacial | Las nuevas vistas respetan la grilla, separación vertical y ancho de contenido del sistema existente. |
| Responsive | Sidebar móvil, filtros apilados, columnas ocultables y formularios dialogados funcionan dentro de 390 px. |

Capturas de referencia y resultado:

- [Referencia de Eventos](assets/events-reference.png)
- [Inicio final en escritorio](assets/home-final-desktop.png)
- [Actividades en escritorio](assets/activities-desktop.png)
- [Actividades en móvil](assets/activities-mobile.png)
- [Formulario de actividad en móvil](assets/activity-form-mobile.png)

## Decisiones funcionales confirmadas

- Actividades: hechos puntuales ya ejecutados, sin estado ni planificación.
- Actividades: una sola línea VcM principal y un solo contacto responsable.
- Participación: cantidad total general.
- Evidencias: nombre y enlace durante el MVP local.
- Eventos: un coordinador, tareas con varios responsables y fases pre/durante/post.
- Catálogos: Socios y Contactos son entidades separadas; un contacto puede no
  tener usuario ni socio asociado.
- Persistencia: una instantánea versionada bajo la clave `vcmeic-mvp-v1`, con
  importación, exportación, reinicio y migración de los eventos heredados.

## Advertencias no bloqueantes

- Vite informa que `vite.config.ts` todavía usa `__dirname`, una advertencia
  heredada para el futuro cargador nativo de configuración.
- La compilación informa chunks mayores a 500 kB; es una oportunidad posterior
  de división de bundle y no bloquea este MVP.
