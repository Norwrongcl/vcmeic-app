# VcM: base de servicios del VPS

La plataforma web se aloja en **Hostinger Apps**. Este directorio prepara PostgreSQL, su respaldo y las herramientas privadas de migración/verificación en el VPS que ya ejecuta Hermes. El esquema de negocio está en `database/migrations`. NestJS, autenticación de aplicación, Realtime y trabajos ejecutables de Hermes corresponden a la siguiente entrega.

## Instalación

Copiar los archivos a `/docker/vcm-services` y ejecutar `bash install.sh` como root. El instalador genera la contraseña exclusivamente en el servidor y fija la imagen oficial PostgreSQL 18 mediante digest. Aborta ante una instalación existente; no rota secretos ni elimina volúmenes.

La base `vcm` queda en el volumen `vcm-services_postgres_data`, en la red interna `vcm_backend`. **No publica puertos**. Hermes no se conecta a esta red ni recibe credenciales. El futuro backend tendrá un usuario de ejecución restringido distinto del administrador, y será el único servicio accesible por HTTPS desde la web; el navegador nunca recibirá acceso a PostgreSQL.

Límites iniciales: 1 GiB RAM, 0,75 CPU, 40 conexiones y 128 MiB de shared buffers. Ajustarlos con métricas reales. Los límites no garantizan rendimiento ni reservan recursos para Hermes.

## Operación y recuperación

Desde `/docker/vcm-services`:

```sh
docker compose ps
docker compose exec -T postgres pg_isready -U postgres -d vcm
docker compose logs --tail 50 postgres
systemctl status vcm-postgres-backup.timer
systemctl start vcm-postgres-backup.service
journalctl -u vcm-postgres-backup.service --no-pager -n 30
```

Respaldos diarios a las 06:20 UTC (más hasta cinco minutos de dispersión) en `/var/backups/vcm-postgres/<fecha UTC>/`. Incluyen dump custom, roles globales y configuración sin contraseña en claro; los roles globales pueden contener hashes de autenticación, por lo que todo el directorio es privado de root. `COMPLETE` identifica el respaldo terminado y `SHA256SUMS` permite comprobarlo. No se purgan automáticamente: controlar crecimiento y acordar retención.

Para ensayar una recuperación, crear una **base nueva**, verificar checksums y restaurar con `pg_restore --exit-on-error --no-owner --no-privileges -U postgres -d <base nueva>` mediante `docker compose exec -T postgres`, redirigiendo el dump a stdin. Nunca restaurar sobre la base activa sin una ventana y un respaldo previo. En servidor nuevo, revisar/restaurar primero roles globales con `psql -v ON_ERROR_STOP=1` y después los permisos necesarios. La contraseña de arranque está en `secrets/postgres_password`; su custodia y una copia cifrada externa se configuran por separado.

`docker compose stop` detiene la base sin eliminar datos; `docker compose up -d --wait` la inicia. **No ejecutar `down -v`**: elimina el volumen. No actualizar de versión mayor cambiando solo la etiqueta; usar el procedimiento de migración de PostgreSQL.

Los respaldos locales **no cubren la pérdida del VPS**. Pendiente destino externo, cifrado, alertas y retención; no se conectan Drive/Notion/Buffer como parte de esta instalación.

Fuentes: [imagen oficial](https://hub.docker.com/_/postgres), [respaldos PostgreSQL](https://www.postgresql.org/docs/current/backup.html).

## Instalación verificada — 22 de octubre de 2026

En `srv2028793.hstgr.cloud` se levantó `vcm-services-postgres-1`, PostgreSQL **18.6**, con la imagen fijada a `postgres@sha256:bbf83594798e144bff365a9c191c5d779f181fb3135902064ab8ff11918020fc`.

Verificado en el servidor: estado healthy, reinicio del contenedor, conservación de un marcador de infraestructura, dump y checksums correctos, restauración en una base separada con lectura del mismo marcador, rechazo de contraseña incorrecta, ausencia de puertos publicados y red interna. Timer de respaldo habilitado y activo. El reinicio ensayado fue del contenedor PostgreSQL, no del VPS completo.

Se conservaron únicamente datos de prueba técnica: esquema `infra_checks` en `vcm` y base `vcm_restore_check_20261022`; no contienen expedientes ni datos personales. El ensayo y su salida están en `/root/vcm-verify-infrastructure.sh` y `/root/vcm-verify-infrastructure.log`. La instalación tiene su log en `/root/vcm-services-install.log`.

La configuración del servidor utiliza formato compacto equivalente al Compose de este directorio. No se modificó la configuración de Hermes ni se desplegó el frontend en el VPS. El frontend mantiene su almacenamiento local hasta que se implemente y conecte la API.

## Esquema relacional desplegado — 22 de octubre de 2026

Base `vcm`: ocho migraciones con SHA256 en `vcm_meta.schema_migrations` y 98 tablas en `vcm`. Propietario de ambos esquemas: `vcm_migrator`. Tanto ese rol como `vcm_runtime` son grupos NOLOGIN, sin superusuario ni BYPASSRLS; no se generaron credenciales de API ni se concedió acceso a Hermes. La base principal contiene catálogos y cero expedientes de prueba.

Código instalado en `/docker/vcm-services/database`; imagen temporal de herramientas identificada por su ID inmutable en `/docker/vcm-services/database-image-id`. `migrate.sh` usa el runner Node en contenedor aislado, aplicando SET ROLE mediante PGOPTIONS. `verify-domain.sh` crea únicamente bases UUID `vcm_test_*`; espera su desconexión y las elimina sin terminación forzada. No son servicios HTTP.

Respaldos comprobados antes/después: `/var/backups/vcm-postgres/20261022T190341Z` y `/var/backups/vcm-postgres/20261022T190347Z`. Se restauraron datos sintéticos con relaciones/conflictos en `vcm_stage_restore_20261022` y el backup de la base principal en `vcm_domain_restore_20261022`. `vcm_stage_20261022` y las dos restauraciones son pruebas técnicas retenidas; no usar como producción. Dump sintético privado en `/var/backups/vcm-postgres/domain-proof-20261022/stage.dump`.

Para restaurar conservando propiedad de migraciones y ACL: provisionar primero los grupos con `database/bootstrap.sql`, crear una base nueva con propietario `vcm_migrator`, y usar `pg_restore --role=vcm_migrator --no-owner --exit-on-error` como administrador privado. Verificar datos, permisos y versiones antes de cambiar consumidores. No restaurar sobre `vcm`.

Logs privados: `/root/vcm-db-tests-final.log` (36 pruebas), `/root/vcm-db-deployment-proof.log`, `/root/vcm-db-stage-migrate.log`, `/root/vcm-db-live-migrate.log` y `/root/vcm-db-idempotent.log`. El ensayo completo quedó en `/root/vcm-db-deploy-verify.sh`; su fuente versionada es `verify-delivery-20261022.sh`, deliberadamente de un solo uso: aborta si encuentra esquema de negocio o bases de ensayo existentes.

El reinicio verificado fue solo de PostgreSQL; Hermes continuó activo y respondió HTTPS 302 hacia su acceso. Estado posterior healthy, sin puertos SQL publicados. Persisten los pendientes de respaldo externo y política de retención anteriores.
