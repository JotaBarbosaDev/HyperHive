export function btrfsUsagePercent(used?: string | number, total?: string | number): number | null {
  if (used === undefined || used === null || used === "" || total === undefined || total === null || total === "") return null;
  const usedValue = Number(used);
  const totalValue = Number(total);
  if (!Number.isFinite(usedValue) || !Number.isFinite(totalValue) || usedValue < 0 || totalValue <= 0 || usedValue > totalValue) return null;
  return usedValue / totalValue * 100;
}
