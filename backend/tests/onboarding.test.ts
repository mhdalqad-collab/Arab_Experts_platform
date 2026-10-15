import assert from "node:assert/strict";
import test from "node:test";
import { parseRegistrationInput } from "../src/onboarding.js";

test("registration input is normalized and bounded", () => {
  assert.deepEqual(parseRegistrationInput({
    firstNameAr: " أحمد ", lastNameAr: " علي ", displayNameAr: " أحمد علي ", displayNameEn: " Ahmed Ali ",
  }), {
    firstNameAr: "أحمد", lastNameAr: "علي", displayNameAr: "أحمد علي", displayNameEn: "Ahmed Ali",
  });
  assert.throws(() => parseRegistrationInput({ firstNameAr: "", lastNameAr: "علي", displayNameAr: "اسم" }), (error: { code?: string }) => error.code === "VALIDATION_FAILED");
  assert.throws(() => parseRegistrationInput({ firstNameAr: "أحمد", lastNameAr: "علي", displayNameAr: "x".repeat(241) }), (error: { code?: string }) => error.code === "VALIDATION_FAILED");
});
