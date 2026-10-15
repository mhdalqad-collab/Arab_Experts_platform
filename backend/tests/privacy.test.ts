import assert from "node:assert/strict";
import test from "node:test";
import { parsePrivacyPreference,parseRevocation } from "../src/privacy.js";
const partyId="20000000-0000-4000-8000-000000000001";
test("privacy preference normalizes controlled fields and visibility",()=>{assert.deepEqual(parsePrivacyPreference({resourceType:"party_profile",resourceId:partyId,fieldPath:"display_name_ar",visibilityCode:"public",allowedRoleCodes:[],reason:"Public profile"}),{resourceType:"PARTY_PROFILE",resourceId:partyId,fieldPath:"display_name_ar",visibilityCode:"PUBLIC",allowedRoleCodes:[],reason:"Public profile"});assert.throws(()=>parsePrivacyPreference({resourceType:"PARTY_PROFILE",resourceId:partyId,fieldPath:"../secret",visibilityCode:"PUBLIC"}));assert.throws(()=>parsePrivacyPreference({resourceType:"PARTY_PROFILE",resourceId:partyId,fieldPath:"name",visibilityCode:"PUBLIC",allowedRoleCodes:["bad role"]}));});
test("grant revocation requires an auditable reason",()=>{assert.deepEqual(parseRevocation({reason:" Engagement ended "}),{reason:"Engagement ended"});assert.throws(()=>parseRevocation({reason:""}));});
