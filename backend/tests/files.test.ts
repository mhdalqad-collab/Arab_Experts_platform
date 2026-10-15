import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "../src/database.js";
import { createFileRepository, parseAccessGrant, parseDownloadConsume, parseEvidenceInput, parseFileIntent, parseReviewDocumentAccess, parseScanResult, parseUploadCompletion } from "../src/files.js";
import type { Principal } from "../src/identity.js";

const principal: Principal={userAccountId:"10000000-0000-4000-8000-000000000001",partyId:"20000000-0000-4000-8000-000000000001",primaryEmail:"x@example.com",displayNameAr:"عضو",displayNameEn:null,roles:["MEMBER_SELF"],permissions:["account.self.manage"],organizationPartyIds:[],authentication:{providerCode:"TEST",assuranceLevel:null,methods:["pwd"]}};
const valid={originalFileName:" شهادة.pdf ",mediaType:"application/pdf",sizeBytes:1024,sha256:"a".repeat(64),confidentialityLevelCode:"AUTHORIZED_CLIENTS"};

test("file upload intent validates and normalizes security-sensitive metadata",()=>{
  assert.equal(parseFileIntent(valid).originalFileName,"شهادة.pdf");
  assert.throws(()=>parseFileIntent({...valid,mediaType:"text/html"}));
  assert.throws(()=>parseFileIntent({...valid,sizeBytes:10*1024*1024+1}));
  assert.throws(()=>parseFileIntent({...valid,sha256:"invalid"}));
});

test("upload intent uses authenticated party scope and emits short-lived private URL",async()=>{
  let values:readonly unknown[]=[];
  const database={query:async(_sql:string,input:readonly unknown[]=[])=>{values=input;return{rows:[]};}} as unknown as Database;
  const repository=createFileRepository(database,{uploadBaseUrl:"https://storage.example/upload",downloadBaseUrl:"https://storage.example/download",providerCode:"PRIVATE_OBJECT_STORAGE"});
  const intent=await repository.createUploadIntent(principal,parseFileIntent(valid),"correlation");
  assert.equal(values[2],principal.partyId);
  assert.match(intent.uploadUrl,/parties\/20000000-0000-4000-8000-000000000001\/files\//);
  assert.equal(intent.requiredHeaders["x-content-sha256"],"a".repeat(64));
  assert.ok(Date.parse(intent.expiresAt)-Date.now()<=600000);
});

test("access grants and one-time download callbacks validate bounded input",()=>{
  const grant=parseAccessGrant({granteePartyId:"30000000-0000-4000-8000-000000000001",purposeCode:"client_review",expiresAt:new Date(Date.now()+86400000).toISOString()});
  assert.equal(grant.purposeCode,"CLIENT_REVIEW");
  assert.equal(parseDownloadConsume({sessionId:"50000000-0000-4000-8000-000000000001",downloadToken:"x".repeat(32)}).downloadToken.length,32);
  assert.throws(()=>parseAccessGrant({granteePartyId:"bad",purposeCode:"CLIENT_REVIEW",expiresAt:new Date(Date.now()+86400000).toISOString()}));
  assert.throws(()=>parseDownloadConsume({sessionId:"50000000-0000-4000-8000-000000000001",downloadToken:"short"}));
});

test("review document access requires a specific normalized reason",()=>{
  assert.deepEqual(parseReviewDocumentAccess({reason:"  التحقق من تطابق الشهادة مع ملخص الدليل المجمد  "}),{reason:"التحقق من تطابق الشهادة مع ملخص الدليل المجمد"});
  assert.throws(()=>parseReviewDocumentAccess({reason:"مراجعة"}));
});

test("assigned publication review download uses a three-minute isolated session",async()=>{
  let values:readonly unknown[]=[];
  const database={query:async(_sql:string,input:readonly unknown[]=[])=>{values=input;return{rows:[{storage_object_key:"private/key",original_file_name:"evidence.pdf",media_type:"application/pdf"}]};}} as unknown as Database;
  const reviewer:Principal={...principal,partyId:"30000000-0000-4000-8000-000000000001",permissions:["professional.review.document"],authentication:{providerCode:"TEST",assuranceLevel:"mfa",methods:["otp"]}};
  const repository=createFileRepository(database,{uploadBaseUrl:"https://storage.example/upload",downloadBaseUrl:"https://storage.example/download",providerCode:"PRIVATE_OBJECT_STORAGE"});
  const intent=await repository.createReviewDocumentDownloadIntent(reviewer,"50000000-0000-4000-8000-000000000001","60000000-0000-4000-8000-000000000001","70000000-0000-4000-8000-000000000001","Verify the frozen evidence source document","correlation");
  assert.equal(values[4],reviewer.partyId);
  assert.equal(intent.authorizationBasisCode,"ASSIGNED_PUBLICATION_REVIEWER");
  assert.ok(Date.parse(intent.expiresAt)-Date.now()<=180000);
});

test("upload intent fails closed when object storage gateway is absent",async()=>{
  const repository=createFileRepository({} as Database,null);
  await assert.rejects(repository.createUploadIntent(principal,parseFileIntent(valid),"c"),(error:{status?:number;code?:string})=>error.status===503&&error.code==="OBJECT_STORAGE_UNAVAILABLE");
});

test("internal callbacks and evidence metadata reject malformed values",()=>{
  assert.equal(parseUploadCompletion({sessionId:"41000000-0000-4000-8000-000000000001",uploadToken:"x".repeat(32),mediaType:"application/pdf",sizeBytes:1024,sha256:"a".repeat(64)}).sizeBytes,1024);
  assert.equal(parseScanResult({fileId:"40000000-0000-4000-8000-000000000001",resultCode:"safe",scannerReference:"scan-1"}).resultCode,"SAFE");
  assert.equal(parseEvidenceInput({fileId:"40000000-0000-4000-8000-000000000001",evidenceTypeCode:"professional_certificate",titleAr:"شهادة"}).evidenceTypeCode,"PROFESSIONAL_CERTIFICATE");
  assert.throws(()=>parseScanResult({fileId:"bad",resultCode:"SAFE",scannerReference:"scan"}));
  assert.throws(()=>parseEvidenceInput({fileId:"40000000-0000-4000-8000-000000000001",evidenceTypeCode:"bad code",titleAr:"شهادة"}));
});
