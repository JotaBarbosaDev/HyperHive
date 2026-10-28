import { certificateExpiry } from "../utils/certificate-expiry";
const now = Date.parse("2026-01-01T12:00:00Z");
test("expiry handles unknown, invalid and boundaries without false validity", () => {
  for (const expires of [undefined, "garbage", "2026-02-30", ""]) expect(certificateExpiry({expires}, now).label).toBe("Expiry unknown");
  expect(certificateExpiry({expires:"2026-01-01T12:00:00Z"}, now).label).toBe("Expired");
  expect(certificateExpiry({expires:"2026-01-01T12:00:01Z"}, now)).toMatchObject({days:1,label:"Expires in 1 day"});
  expect(certificateExpiry({expires:"2026-01-31T12:00:00Z"}, now).days).toBe(30);
});
