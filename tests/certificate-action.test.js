import { certificateAction } from "../utils/certificate-action";
test("certificate actions follow known provider capabilities", () => {
  expect(certificateAction({provider:"letsencrypt"})).toBe("renew");
  expect(certificateAction({provider:"other"})).toBe("upload");
  expect(certificateAction({provider:"unknown"})).toBeNull();
  expect(certificateAction({})).toBeNull();
});
