# ContentHub · VcM EIC

Prototipo funcional local para validar los procesos MP1–MP5 del documento del PO, conservando una sola referencia por expediente.

## Recorrido

- **Inicio:** prioridades, agenda, bloqueos y decisiones según el rol de demostración.
- **Portafolio:** iniciativas, eventos, campañas, organizaciones y convenios.
- **Control:** Presencias P5.1 (siete tipos), Actividades P5.2 (49 campos), evidencia, QA, Concordancia y cortes.
- **Reportes:** vistas operativa/ejecutiva, indicadores, cortes e histórico desde los mismos datos.
- **Ficha 360:** registro con fuentes y conflictos, operación MP2 con tareas/Kanban/hitos/finanzas, evidencia, estrategia y contenido editorial, gobierno, indicadores e historial.

Guardar antecedentes no los valida automáticamente. El cierre exige datos confirmados, evidencia revisada y QA. Los paquetes editoriales abarcan siete días y conservan las versiones aprobadas; editar requiere nueva revisión. Los registros no elegibles no aportan a indicadores.

## Datos y límites

La web de esta versión guarda sus datos únicamente en el navegador. El repositorio asíncrono separa persistencia y reglas de negocio de los componentes. La API y PostgreSQL existen como servicios privados aparte, pero esta web aún no los utiliza: no hay autenticación productiva ni sincronización. El selector de roles permite evaluar vistas y acciones; no reemplaza autorización en servidor.

Hermes permanece fuera de la plataforma, en sus canales WhatsApp/Telegram. Ambos perfiles accederán al futuro backend compartido. Esta versión no incluye chat, inferencia simulada ni conexión a Hermes, Drive, Notion, Buffer, Canva, Calendar o correo. No publica ni envía información.

El snapshot **v4** conserva las entidades originales y migra v1/v2/v3 sin inferir validación institucional. Configuración permite exportar/importar el respaldo completo y restablecer la demostración. Si un dato antiguo no puede interpretarse se conserva una copia recuperable; no se descarta silenciosamente. Exporta antes de restablecer. Las URLs antiguas principales redirigen a los nuevos espacios.

Las metas 2026 provienen del PO y se diferencian del avance de demostración. Las reglas completas y catálogos institucionales no disponibles permanecen pendientes. Los vínculos a evidencia se revisan manualmente; no se verifican ni descargan archivos remotos.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Acceso de demostración: cualquier correo válido y contraseña de siete o más caracteres.

```bash
pnpm test
pnpm lint
pnpm build
```

Implementación principal: `src/features/vcm/`. El modelo de origen permanece en `src/features/core/model/` para conservar registros y reutilizar tareas/finanzas. Las reglas institucionales y transiciones están centralizadas y versionadas; deberán trasladarse al backend antes de operar con datos reales.

Para desplegar esta demo como Web App de Hostinger desde GitHub, seleccionar la raíz del repositorio, el script `build` y la salida `dist` (Vite). El servidor debe devolver `index.html` para las rutas internas de la SPA. El despliegue de la web no conecta automáticamente la API privada; usar solo datos de demostración hasta completar autenticación y persistencia compartida.

### Planificación y seguimiento local

Portafolio incluye el plan anual y sus objetivos, con propuesta de Coordinación, sanción de Jefatura y aprobación de Dirección. Operación incorpora plan de trabajo y mandato, compromisos conciliados con gastos y estimación de cierre. Gobierno conserva pertinencia/urgencia y las decisiones con su autoridad. Inicio y Reportes reutilizan esas mismas relaciones y cálculos.

Las estimaciones requieren revisión al cambiar sus antecedentes; las aprobaciones no se trasladan automáticamente a nuevas versiones. Los criterios institucionales no disponibles no suman avance. Véase `docs/reviews/2026-10-21-logica-funcional-po.md` para cobertura y límites.
