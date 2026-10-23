# Base relacional VcM

Esquema PostgreSQL 18 para expedientes, fuentes, operación, gobierno, comunicaciones, indicadores y automatización. No es todavía la API. La web mantiene su persistencia local y Hermes no recibe acceso SQL.

## Pruebas locales

Requiere Node 24 y pnpm. Paquete independiente del frontend:

```sh
pnpm --dir database install
pnpm --dir database test:local
pnpm --dir database typecheck
pnpm --dir database test:local --dictionary
```

`test:local` inicia PostgreSQL 18.4 con binarios de `embedded-postgres`, contraseña aleatoria y escucha solo loopback, ejecuta pruebas y detiene/elimina su cluster temporal. Requiere puerto 55439 disponible. No crea usuarios del sistema ni utiliza `DATABASE_URL`. En Mac los binarios publicados se ejecutan mediante traducción x86_64 aunque el paquete se denomine darwin-arm64; la compatibilidad productiva se verifica por separado en PostgreSQL 18.6 del VPS.

También se puede ejecutar `TEST_DATABASE_URL=<conexión privada al administrador de pruebas> pnpm --dir database test`. Antes, aplicar `bootstrap.sql` en el cluster de pruebas para crear dos roles de grupo NOLOGIN. Cada suite crea una base `vcm_test_<uuid>`; elimina exclusivamente su propia base. Nunca apuntar este administrador a una instalación que no permita bases efímeras.

## Migraciones

`DATABASE_URL=<conexión privada> pnpm --dir database migrate`. No usar variables VITE_, no copiar URL al chat ni incluirla en logs. `src/migrate.ts` serializa despliegues con advisory lock y verifica todos los SHA256 aplicados antes de ejecutar SQL pendiente. Cada archivo y su registro de historial se confirman en una transacción. No editar migraciones aplicadas; añadir otra.

`bootstrap.sql` se ejecuta como administrador, sin contraseñas en el repositorio. Crea `vcm_migrator` y `vcm_runtime` como grupos NOLOGIN. El despliegue asigna los esquemas a migrator; aún no se crea login ni credencial de API. Runtime no es propietario y no puede hacer DDL, DELETE/TRUNCATE ni modificar registros históricos. Las credenciales/identidad requieren permisos acotados adicionales al implementar la API: actualmente runtime no puede leer/modificar tablas de autenticación o secretos.

Los permisos SQL no reemplazan autorización por rol/expediente en la API. No se habilitó RLS y no existe acceso SQL para Hermes. Ningún rol runtime debe recibir membresía de migrator.

## Modelo y límites

- [Diccionario físico](../docs/data/dictionary.md), [relaciones](../docs/data/relationships.md) y [mapeo oficial P5.2](../docs/data/p52-mapping.csv).
- Catálogos versionados en `catalog/`; cambios deben acompañarse de nuevas migraciones si ya se desplegaron.
- 49 campos P5.2, siete tipologías P5.1; otros campos son complementarios. El texto legado incierto se preserva en staging.
- Migraciones crean estructura y catálogos conocidos, no usuarios, expedientes demo ni conexiones ficticias.
- La cola no ejecuta trabajos por sí sola. No hay publicaciones ni envíos al instalarla.
- Integridad SQL: FK, unicidad, tipos, inmutabilidad y referencias a revisiones. Reglas de QA, autoridad, elegibilidad de indicadores, ciclos y mandato vigente requieren transacciones de la API posterior.
- `report_runs` y `case_snapshots` conservan referencias/historia, no un segundo maestro de datos.

## Recuperación

Ver `infra/vps/postgres/README.md`. Backup antes de migrar, restore siempre a una base nueva, nunca borrar volumen ni usar `down -v`. Rollback operativo: detener la nueva aplicación y volver a la versión anterior compatible; si hubo escritura incompatible, restaurar a otra base y conciliar antes del cambio, no ejecutar un down destructivo. Respaldo externo requerido antes de datos reales.

## Correcciones de integridad revisadas

La migración 0008 serializa aprobaciones y cambios de hijos mediante bloqueos de revisión; congela membresías y activos de paquetes aprobados. Referencias capturadas se declaran como objetos `{type: "evidence" | "organization" | "agreement", id: string}` en el valor inmutable; sus relaciones normalizadas deben coincidir y no admiten modificación. Resoluciones y evidencias conservan el expediente/campo mediante FK compuesta.

Las autorizaciones presupuestarias son concesiones inmutables identificadas por `authorization_key/version`; una enmienda crea otra fila y la revocación es un registro aparte. Cada compromiso conserva el ID exacto de la concesión. Los cortes exigen revisión existente y sellado irreversible antes del cierre. Publicaciones admiten aprobación directa o la del paquete que contenga esa revisión exacta. La API futura debe revalidar vigencia y autorización antes del efecto externo.

En el VPS, `verify-domain.sh` usa el cargador nativo de configuración y cache en /tmp para ejecutar tests en contenedor con raíz de solo lectura. La herramienta es temporal, no un servicio publicado.
