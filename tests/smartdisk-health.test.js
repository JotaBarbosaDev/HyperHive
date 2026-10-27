import { cautionCauses } from "../utils/smartdisk-health";

test("identifies only server warning thresholds and reports missing or invalid causes as unknown", () => {
  expect(cautionCauses({device:"/dev/sda", raw:{crcErrorCount:"11", temperatureC:"61", rawReadErrorRate:"1000"}})).toEqual(["CRC errors: 11", "Temperature (°C): 61"]);
  expect(cautionCauses({device:"/dev/sda", raw:{crcErrorCount:"invalid", availableSpare:"", availableSpareThreshold:0}})).toEqual([]);
  expect(cautionCauses({device:"/dev/sda", raw:{availableSpare:"5", availableSpareThreshold:"10"}})).toEqual(["Available spare: 5% (threshold 10%)"]);
  expect(cautionCauses({device:"/dev/sda"})).toEqual([]);
});
