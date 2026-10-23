# API privada en el VPS

La plataforma permanece en Hostinger Apps. Este contenedor comparte únicamente la red privada PostgreSQL y dispone de una red propia de acceso. Publica **solo** `127.0.0.1:32800`; no crea DNS, no cambia Traefik/Hermes y no abre PostgreSQL.

## Preparación verificable

1. Transferir únicamente `server/`, `packages/domain/`, `database/` e `infra/vps/api/`; excluir node_modules/dist/.env/logs/secretos y metadatos `._*`.
2. Registrar SHA256 del archivo en `/docker/vcm-services/api-source-sha`; extraer en `/docker/vcm-services/api-source`.
3. Desde esa raíz construir ambos targets de `server/Dockerfile`, mismo `--build-arg VCM_SOURCE_SHA=<hash>`:
   - `verification` → `vcm-api-verify:20261022`.
   - `runtime` → `vcm-api-runtime:20261022`.
4. Ejecutar `verify.sh <hash>` con el password postgres montado solo en la herramienta temporal. Escribe `api-verified-images` con hash y IDs inmutables, únicamente si pasa toda la suite. La API de ejecución nunca recibe ese secreto de operador.
5. Revisar cambios, probar migración en otra base, tomar backup y restaurarlo allí. Aplicar migraciones 0009 en adelante usando `vcm_migrator`; no alterar migraciones previas. Comprobar main con cero datos ficticios y sin exponer puertos.

## Aplicación privada

`install.sh --apply-private` crea un LOGIN nuevo `vcm_api`, miembro de runtime sin superusuario/DDL/administración, y una clave de cursor. **Esta creación de acceso requiere confirmación en el momento de ejecutarla cuando se opera desde la consola web.** Preparar/revisar/probar todo antes.

Instalar `compose.yaml` como `/docker/vcm-services/api.compose.yaml`. El script comprueba origen del artefacto; no actualiza contraseñas de usuarios existentes. Secretos en `secrets/api/`, directorio root 0700, ficheros UID 1000:1000 0400 para lectura del contenedor no root. `.api.env` 0600 contiene solo imagen inmutable y origen explícito. `https://api.vcmeic.cl` es origen provisional propio, **no una afirmación de que exista el frontend ahí**.

No se crean cuentas humanas ni claves Hermes. No se publica HTTPS hasta comprobar origen real de Hostinger Apps, cookies/proxy/CORS y respaldo externo. La clave de cursor se conserva tras reinicios; sustituirla obliga a resincronizar.

## Verificar y operar

```sh
cd /docker/vcm-services
docker compose --env-file .api.env -f api.compose.yaml ps
curl --fail http://127.0.0.1:32800/health
# Sin sesión:
curl -o /dev/null -s -w '%{http_code}\n' http://127.0.0.1:32800/v1/cases
```

Esperado: healthy; health ok; datos 401. Verificar además memoria/CPU, app no root, raíz de solo lectura, bindings loopback y que `vcm_api` no sea propietario/superusuario/BYPASSRLS. Reiniciar solo `api` y comprobar de nuevo. No imprimir variables privadas, URLs con contraseña ni contenidos de los ficheros de secretos.

## Recuperación

Backup y restauración: [PostgreSQL](../postgres/README.md). Antes/después de migraciones mantener dump + globals + manifest/checksums y fuente/imagen exacta; guardar también de forma privada manifiestos de despliegue y secretos de app, sin añadirlos al Git. La copia externa y política de retención todavía necesitan un destino acordado.

Para parar: `docker compose --env-file .api.env -f api.compose.yaml stop api`. Conserva imagen, DB y secretos. Un rollback de imagen solo es viable con su esquema compatible: el arranque valida checksums estrictamente. Si se requiere volver a un esquema previo, restaurar el backup en **otra** base y cambiar la conexión privada hacia ella después de verificarla; no borrar ni reemplazar el volumen activo. Revalidar permisos y resincronizar clientes tras una restauración.

Para acreditar un backup de importación, ejecutar el backup original (ya comprueba `pg_restore --list`), y luego `server/scripts/issue-import-backup.ts` con JSON privado que identifique base de operador, lote y directorio del backup. La identidad runtime no puede emitir esos recibos.

El respaldo diario guarda también la configuración de API, `.api.env`, su URL SQL y clave de cursor, además del secreto de PostgreSQL, dentro del mismo directorio root 0700 y manifiesto SHA256. Nunca copiar ese bundle a un destino público. Para recuperar en otro host, restituir los secretos en sus rutas originales y aplicar de nuevo UID 1000/modo 0400 para API bajo directorio root 0700 antes de arrancar. La copia fuera del VPS y su retención siguen pendientes.
