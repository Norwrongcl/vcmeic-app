export function hasDependencyCycle(
  tasks: ReadonlyArray<{ id: string; dependencies: string[] }>,
): boolean {
  const edges = new Map(tasks.map((t) => [t.id, t.dependencies])),
    visiting = new Set<string>(),
    done = new Set<string>()
  function visit(id: string): boolean {
    if (visiting.has(id)) return true
    if (done.has(id)) return false
    visiting.add(id)
    for (const dep of edges.get(id) ?? []) if (visit(dep)) return true
    visiting.delete(id)
    done.add(id)
    return false
  }
  return tasks.some((t) => visit(t.id))
}
