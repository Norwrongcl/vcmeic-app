# Correcciones de la revisión heurística de Nielsen

Alcance: recorridos existentes del prototipo local; se conservan estilo, datos, IDs y límites de integración.

| Hallazgo | Corrección |
| --- | --- |
| Aprobación semanal sin mostrar otros expedientes | Diálogo con todas las piezas, expediente, versión, texto, brief y enlace al activo; confirmación explícita del paquete. El dominio rechaza la aprobación si cambian las piezas o estrategias desde la revisión. |
| Pérdida de borradores al cambiar de campo/vista | Conservación en sessionStorage, separada por rol, expediente y formulario. Recuperación al volver o recargar; aviso visible, descarte explícito y aviso al abandonar la página con borradores. No constituye un registro formal ni sincronización. |
| Registros sin fecha omitidos en reportes | Bandeja separada con acceso directo a completar fecha; explicación de exclusiones y alcance del CSV. Los registros sin fecha no se atribuyen a un año por inferencia. |
| Captura excesivamente individual | Edición de grupo con fuente común y comando atómico. Solo se guardan los datos modificados, con fuente e historial por campo. Las reglas de conflicto y permisos se conservan. |
| Faltantes poco accionables | Accesos al campo con foco, evidencia, operación, decisiones, conflictos y cortes institucionales; progreso de confirmación y siguiente dato pendiente. |
| Filtros engañosos y búsquedas vacías | Filtro de portafolio solo para expedientes; búsqueda por nombre en convenios/organizaciones, estado vacío explícito, limpiar filtros y conservación de filtros/vista en la sesión. |
| Acciones incompatibles con el rol | Las resoluciones se ofrecen según el tipo de decisión y la autoridad. Coordinación puede devolver o escalar presupuesto; Dirección lo aprueba. El dominio sigue validando los permisos. |
| Inicio demasiado extenso | Accesos de siguiente paso antes de los contadores; contadores en dos columnas en móvil, listas resumidas y detalles de gestión desplegables mediante teclado. |
| Vocabulario técnico | Registro y revisión, siguiente estado, actualizar expediente, plan de campaña y código de campaña sustituyen títulos técnicos. Las referencias normativas de Configuración y contratos internos se conservan. |

## Regresiones cubiertas

- La edición de grupo no degrada datos confirmados que el Responsable no modificó.
- Las fechas migradas con hora se representan por fecha sin perder el valor original si no se editan.
- Un error de validación mantiene el borrador y un mensaje persistente junto al formulario.
- Un paquete modificado requiere revisión nueva; no puede aprobarse una versión no mostrada.
- Los formularios se remontan al cambiar de rol para separar borradores de demostración.

## Verificación

Pruebas de dominio y componentes; recorridos aislados en Playwright para captura, conflictos, cierre, indicadores, contenidos, aprobación conjunta entre expedientes, borradores, recarga, filtros, decisiones por rol, teclado y móvil. Evidencias y scripts temporales fuera del repositorio. Backend, autenticación real y servicios externos siguen fuera de esta entrega.
