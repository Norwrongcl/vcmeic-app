import { writeFile, mkdir } from 'node:fs/promises'
import { database } from '../tests/helpers/database.ts'
const db = await database()
try {
  const tables = (
    await db.client.query(
      "select tablename from pg_tables where schemaname='vcm' order by tablename",
    )
  ).rows as { tablename: string }[]
  const migrationCount = (await db.client.query('SELECT count(*)::int n FROM vcm_meta.schema_migrations')).rows[0].n
  let text = `# Diccionario físico VcM\n\nGenerado desde ${migrationCount} migraciones aplicadas a PostgreSQL 18; esquema de negocio \`vcm\`. ${tables.length} tablas. Fuente de verdad física: archivos SQL con checksum en \`database/migrations\`.\n\n## Convenciones y protección\n\nIDs text estables, fechas civiles date, instantes timestamptz, dinero bigint CLP (API: cadena decimal), magnitudes numeric, NULL desconocido. Claves foráneas sin borrado en cascada; archivo/cancelación para datos formales. Runtime no tiene DELETE/TRUNCATE ni DDL. Revisiones, auditoría y afirmaciones son inmutables; aprobaciones apuntan a object_revisions. Cada objeto protegido conserva confidencialidad; autorización efectiva por objeto y rol se aplica en la API compartida. No se usa RLS todavía.\n\nLos triggers de inmutabilidad impiden UPDATE/DELETE; hijos de revisión editorial aprobada no admiten nuevas inserciones. Invariantes como QA, autoridad por rol, ciclos, vigencia de mandato, comparación de versiones e indicadores elegibles se resuelven en transacciones de API. Las tablas por sí solas no acreditan esos flujos.\n\n## Mapeo heredado\n\nactivities/cases se concilian en cases y activity_records, events en projects, eventId en project_id y partners en organizations. El expediente mantiene el estado documental; projects.execution_state conserva el operativo. project_cases admite varios expedientes por proyecto. No importar por coincidencia de nombre. Registros demo y asignaciones sin identidad requieren revisión. Las fechas legacy inválidas se mantienen en staging, no se inventan fechas válidas. Catálogos internos usan códigos propios identificados como internos, nunca IDs institucionales inventados.\n\nLos estados documentales actuales están en catalog/states.json; estados de excepción operativa del PO se conservan como incidencias/bloqueos o pendientes de mapeo explícito. Cambiar este catálogo no cambia la UI automáticamente.\n\n## Tablas\n`
  for (const { tablename } of tables) {
    const cols = await db.client.query(
      `select column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='vcm' and table_name=$1 order by ordinal_position`,
      [tablename],
    )
    const constraints = await db.client.query(
      `select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid=to_regclass($1) order by conname`,
      ['vcm.' + tablename],
    )
    const indexes = await db.client.query(
      `select indexname,indexdef from pg_indexes where schemaname='vcm' and tablename=$1 order by indexname`,
      [tablename],
    )
    const triggers = await db.client.query(
      `select pg_get_triggerdef(oid) definition from pg_trigger where tgrelid=to_regclass($1) and not tgisinternal order by tgname`,
      ['vcm.' + tablename],
    )
    text += `\n### ${tablename}\n\n| Columna | Tipo | NULL | Default |\n|---|---|---|---|\n`
    const cell = (v: unknown) =>
      String(v ?? '—')
        .replaceAll('|', '\\|')
        .replaceAll('\n', ' ')
    text +=
      cols.rows
        .map(
          (c) =>
            `| ${cell(c.column_name)} | ${cell(c.data_type === 'USER-DEFINED' ? c.udt_name : c.data_type)} | ${c.is_nullable} | ${cell(c.column_default)} |`,
        )
        .join('\n') + '\n\n'
    for (const c of constraints.rows)
      text += `- Restricción \`${c.conname}\`: \`${c.definition}\`\n`
    for (const i of indexes.rows) text += `- Índice: \`${i.indexdef}\`\n`
    for (const t of triggers.rows) text += `- Trigger: \`${t.definition}\`\n`
  }
  await mkdir(new URL('../../docs/data/', import.meta.url), { recursive: true })
  await writeFile(
    new URL('../../docs/data/dictionary.md', import.meta.url),
    text,
  )
  console.log(`Dictionary generated: ${tables.length} tables`)
} finally {
  await db.close()
}
