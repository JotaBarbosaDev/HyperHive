import { btrfsUsagePercent } from "../utils/btrfs-usage";

test("calculates usage only for valid capacity values", () => {
  expect(btrfsUsagePercent(0, 100)).toBe(0);
  expect(btrfsUsagePercent("25", "100")).toBe(25);
  for (const [used, total] of [[undefined, 100], ["", 100], [10, 0], [-1, 100], [101, 100], ["bad", 100]]) {
    expect(btrfsUsagePercent(used, total)).toBeNull();
  }
});
