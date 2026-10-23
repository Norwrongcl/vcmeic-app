export function committedRemainder(
  commitments: ReadonlyArray<{ id: string; amount: string; active: boolean }>,
  payments: ReadonlyArray<{ commitmentId: string; amount: string }>,
): bigint {
  return commitments
    .filter((c) => c.active)
    .reduce(
      (sum, c) =>
        sum +
        (BigInt(c.amount) -
          payments
            .filter((p) => p.commitmentId === c.id)
            .reduce((n, p) => n + BigInt(p.amount), 0n)),
      0n,
    )
}
export function projectedCost(
  actual: bigint,
  unspent: bigint,
  forecast: bigint | null,
): string | null {
  return forecast === null ? null : (actual + unspent + forecast).toString()
}
