import { energyLine, formatCost, formatKWh, formatWatts } from "../services/energy";

describe("energy formatters", () => {
  it("formats live watts with a tilde and rounds", () => {
    expect(formatWatts(180)).toBe("~180 W");
    expect(formatWatts(180.4)).toBe("~180 W");
    expect(formatWatts(179.6)).toBe("~180 W");
    expect(formatWatts(0)).toBe("~0 W");
  });

  it("formats kWh with one decimal below 10 and whole numbers above", () => {
    expect(formatKWh(4.24)).toBe("4.2 kWh");
    expect(formatKWh(9.94)).toBe("9.9 kWh");
    expect(formatKWh(0)).toBe("0.0 kWh");
    expect(formatKWh(10)).toBe("10 kWh");
    expect(formatKWh(42.4)).toBe("42 kWh");
    expect(formatKWh(42.6)).toBe("43 kWh");
  });

  it("formats costs as euros with two decimals", () => {
    expect(formatCost(8.82)).toBe("€8.82");
    expect(formatCost(0)).toBe("€0.00");
    expect(formatCost(12.5)).toBe("€12.50");
  });
});

describe("energyLine", () => {
  const row = { liveWatts: 180, monthKWh: 42, monthCost: 8.82 };

  it("includes the cost segment when a price is set", () => {
    expect(energyLine(row, 0.25)).toBe("~180 W · 42 kWh · €8.82");
  });

  it("omits the cost segment when the price is null", () => {
    expect(energyLine(row, null)).toBe("~180 W · 42 kWh");
  });
});
