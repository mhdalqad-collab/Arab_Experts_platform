import assert from "node:assert/strict";
import test from "node:test";
import { parseDeadLetterResolution, parseDeliveryIncidentResolution, parseNotificationClaim, parseNotificationResult } from "../src/notifications.js";

test("notification dispatcher claims only bounded provider batches",()=>{
 assert.deepEqual(parseNotificationClaim({providerCode:"EMAIL_PROVIDER",batchSize:20}),{providerCode:"EMAIL_PROVIDER",batchSize:20});
 assert.throws(()=>parseNotificationClaim({providerCode:"bad provider",batchSize:100}));
});

test("delivery incidents require acknowledge or resolve with evidence",()=>{
 assert.equal(parseDeliveryIncidentResolution({action:"ACKNOWLEDGE",reason:"Operations team accepted ownership of the delivery incident"}).action,"ACKNOWLEDGE");
 assert.throws(()=>parseDeliveryIncidentResolution({action:"CLOSE",reason:"This is not a controlled incident action"}));
});

test("dead-letter recovery requires a controlled action and substantive reason",()=>{
 assert.deepEqual(parseDeadLetterResolution({action:"REQUEUE",reason:"Recipient endpoint was corrected and independently verified"}),{action:"REQUEUE",reason:"Recipient endpoint was corrected and independently verified"});
 assert.throws(()=>parseDeadLetterResolution({action:"REQUEUE",reason:"retry"}));
});

test("notification provider results require a message lease and controlled outcome",()=>{
 const parsed=parseNotificationResult({messageId:"10000000-0000-4000-8000-000000000001",leaseToken:"a".repeat(64),providerCode:"EMAIL_PROVIDER",outcomeCode:"DELIVERED",providerReference:"provider-1"});
 assert.equal(parsed.outcomeCode,"DELIVERED");
 assert.throws(()=>parseNotificationResult({messageId:"bad",leaseToken:"short",providerCode:"EMAIL_PROVIDER",outcomeCode:"DELIVERED"}));
});
