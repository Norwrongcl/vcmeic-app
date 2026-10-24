# Skill y conector Hermes → API VcM

El conector stdio MCP usa solo la API NestJS; no contiene SQL ni credenciales en Git. La skill está en [`skill/`](skill/SKILL.md). Hermes carga skills por perfil; copiarla a **cada** directorio de perfil conserva instrucciones versionadas, pero no comparte memoria ni tokens.

## Instalación operativa

1. Respaldar los perfiles y la configuración actual de Hermes. Verificar que API `/health` responde y que el proceso del conector puede alcanzar la API privada desde su contenedor/red. El valor predeterminado `http://127.0.0.1:32800` solo funciona si el conector corre en el host; dentro de Docker se necesita una ruta privada explícita. No abrir PostgreSQL ni exponer una URL pública para resolverlo.
2. Provisionar **dos** credenciales con `server/scripts/provision-service.ts` y la identidad SQL de operador, usando archivos de entrada JSON privados 0600. Scopes entrevistador: `interview:read`, `interview:capture`. Scopes Coordinación: `coordination:read`, `coordination:write`, `coordination:execute` solo si se autorizan ejecuciones bajo mandatos; de otro modo omitir `coordination:execute`. Guardar cada JSON de salida 0600 en un destino distinto del perfil; nunca copiar la clave del otro perfil, Telegram o servicios externos.
3. Instalar `bridge.py` en una ruta legible por ambos perfiles, sin escritura por Hermes. Copiar `skill/` a `skills/vcm-backend/` de `default` y `vcm-entrevistas` (verificar rutas reales antes). Mantener SOUL.md y restricciones de herramientas existentes.
4. Añadir bajo `mcp_servers` del `config.yaml` de cada perfil un servidor `vcm_api` de tipo stdio. Ejecutar `python3` con argumento de ruta absoluta a `bridge.py`; `env` debe contener `VCM_PROFILE=coordination` o `interview`, `VCM_API_URL=<URL privada alcanzable>` y `VCM_CREDENTIAL_FILE=<JSON privado de ese perfil>`. No poner el token literal en YAML.
5. Recargar MCP con `/reload-mcp` o reiniciar solo el gateway de forma controlada. Verificar `vcm_contract`, consulta autorizada, escritura de un caso de prueba y lectura tras reinicio. Probar 403 desde WhatsApp para decisión y transición, y probar que Telegram no puede firmar una aprobación humana. Revocar credenciales de prueba si no se reutilizan.

Ejemplo de bloque de perfil (sustituir rutas y URL privadas tras verificarlas):

```yaml
mcp_servers:
  vcm_api:
    command: python3
    args: [/opt/vcm-hermes/bridge.py]
    env:
      VCM_PROFILE: interview
      VCM_API_URL: http://vcm-api-api-1:3000
      VCM_CREDENTIAL_FILE: /opt/data/profiles/vcm-entrevistas/vcm-api-credential.json
    tools:
      include: [vcm_contract, vcm_query, vcm_read, vcm_write]
```

La URL del ejemplo depende de que Hermes y API compartan una red Docker privada; no se asume que esa red ya exista. Una skill de texto sola no puede llamar a la API desde el perfil entrevistador porque su terminal está deshabilitada: el MCP es parte necesaria de esta entrega.

## Instalación verificada — 24 de octubre de 2026

En `srv2028793.hstgr.cloud` se instaló la misma versión de `bridge.py` y la skill en ambos perfiles. El contenedor Hermes está unido a `vcm_api_access` y su Compose declara esa red externa; **no** se unió a `vcm_backend`, donde vive PostgreSQL. Tras recrear Hermes, el contenedor volvió a estar healthy, conservó ambas redes y `https://hermes.vcmeic.cl/` respondió 302 con TLS válido.

- `default` (Telegram): credencial `04ccbe0e-b28c-4ae9-bc46-894aed619013`, scopes `coordination:read` y `coordination:write`.
- `vcm-entrevistas` (WhatsApp): credencial `b3db8d0a-ce7f-48b7-b5c2-8b0568ebaac1`, scopes `interview:read` y `interview:capture`.
- Los tokens solo están en los JSON 0600 de cada perfil, propiedad de UID/GID 10000. No se copió ningún token de Telegram, Drive, Notion o Buffer.
- Copia de configuración y Compose anterior: `/root/vcm-hermes-backups/20261024T055034Z/` en el VPS. La clave SSH de desarrollo solicitada por el usuario se conserva en `/Users/bruno/.ssh/vcm_hermes_deploy_ed25519`; su clave pública está autorizada para root en el VPS hasta terminar el desarrollo.

Ambos perfiles descubrieron cuatro herramientas MCP y recibieron su catálogo autorizado (`coordination`: 19 entidades/45 comandos; `interview`: 4 entidades/4 comandos expuestos por el adaptador). Una consulta de `decisions` desde entrevistador devolvió 403; lectura y escritura de decisiones y transición de casos se bloquearon además en el adaptador de WhatsApp. La API respondió con una colección vacía de expedientes para ambos perfiles. No se creó un expediente de prueba en la base principal. Falta una conversación real por WhatsApp porque aún no hay número vinculado para la prueba.

## Verificación local

`python3 -m unittest integrations/hermes-vcm/test_bridge.py`

Este test comprueba inventario y límites locales sin tocar la base. La prueba integrada requiere credenciales reales y acceso privado al VPS. La API, no el adaptador, aplica permisos por objeto, precondiciones institucionales, versiones e idempotencia.

Para recuperar la configuración anterior, deshabilitar `vcm_api` en ambos `config.yaml` o restaurar los archivos respaldados, recrear solo Hermes con el Compose respaldado, y revocar ambas credenciales por ID mediante operación SQL autorizada o `server/scripts/provision-service.ts`. No eliminar `vcm_api_access` mientras otro servicio la use. Cambiar una skill o puente requiere copiar la nueva versión, revisar los diffs, ejecutar los tests y volver a verificar ambos perfiles.
