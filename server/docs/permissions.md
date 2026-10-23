# Permisos efectivos API

La identidad se resuelve desde sesión/credencial y se relee antes del comando. Ningún rol del cuerpo tiene efecto. Catálogo base: `database/catalog/actions.json`; política ejecutable: `src/access/policy.ts`.

- Usuarios con roles de lectura ven objetos internos; responsables solo expedientes asignados. Objetos sensibles/restringidos requieren propiedad o concesión explícita vigente. Cada documento, presupuesto, convenio y proyecto se filtra por sí mismo.
- Coordinación Hermes consulta/edita objetos internos según scopes y concesiones. Entrevistador solo consulta expedientes asignados y sus documentos autorizados, y aporta antecedentes. Roles humanos no se asignan a servicios.
- Aprobación, clasificación, resolución de conflicto y validación son acciones humanas; los handlers verifican además autoridad, QA, revisión y vigencia. Permiso genérico no equivale a mandato financiero ni a aprobación institucional.
- Maestros públicos exponen solo identificador/nombre/catálogo. Contactos, notas y datos personales requieren acceso de gestión explícito; no se incluyen en una relación solo porque el caso padre sea visible.
- Ausencia o invisibilidad de objeto devuelve 404; acción no permitida devuelve 403. Deshabilitar/revocar se comprueba también antes de replay y entrega SSE.
