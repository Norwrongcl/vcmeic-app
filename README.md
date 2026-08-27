# ContentHub

Prototipo frontend para gestionar iniciativas, eventos, tareas, relaciones e indicadores de impacto desde una experiencia unificada.

## Alcance actual

- Dashboard operativo con indicadores y gráficos.
- Actividades, eventos, agenda, tareas y tableros Kanban con drag and drop.
- Convenios, socios, contactos, recursos, conexiones y reportes.
- Formularios, filtros, exportación local y persistencia versionada en `localStorage`.
- Acceso simulado, temas claro/oscuro y diseño responsive.

Esta etapa no usa backend ni servicios remotos. Los datos de demostración se almacenan sólo en el navegador.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Validaciones disponibles:

```bash
pnpm test
pnpm run lint
pnpm run build
```
