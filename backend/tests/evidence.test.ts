import assert from "node:assert/strict";
import test from "node:test";
import { evidenceId,parseCheck,parseVerificationDecision } from "../src/evidence.js";

test("verification check requires controlled result and substantive notes",()=>{
  assert.deepEqual(parseCheck({checkTypeCode:"issuer_confirmation",resultCode:"pass",notes:"Issuer confirmed",responseReference:"ref-1"}),{checkTypeCode:"ISSUER_CONFIRMATION",resultCode:"PASS",notes:"Issuer confirmed",responseReference:"ref-1"});
  assert.throws(()=>parseCheck({checkTypeCode:"issuer",resultCode:"UNKNOWN",notes:"x"}));
  assert.throws(()=>parseCheck({checkTypeCode:"issuer",resultCode:"PASS",notes:""}));
});

test("verification decision validates decision codes dates and identifiers",()=>{
  assert.deepEqual(parseVerificationDecision({decisionCode:"verified",rationale:"Checks passed",validUntil:"2030-12-31"}),{decisionCode:"VERIFIED",rationale:"Checks passed",validUntil:"2030-12-31"});
  assert.throws(()=>parseVerificationDecision({decisionCode:"APPROVED",rationale:"x"}));
  assert.throws(()=>parseVerificationDecision({decisionCode:"VERIFIED",rationale:"x",validUntil:"31/12/2030"}));
  assert.throws(()=>evidenceId("not-a-uuid"));
});
