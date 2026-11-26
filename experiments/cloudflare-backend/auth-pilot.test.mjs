import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createAuthPilot, TEST_EMAIL } from './auth-pilot.js';
const secret='a'.repeat(48), env={LAB_TOKEN:secret,LAB_DATABASE_URL:'synthetic'};
const password='ucfr-lab-fixture-not-a-password';
const hash='$2y$12$BRrlWOLxqxVr2eCyftc8wOlmC1xrkxwJ7uROkK/JCD6ldWLqBKe62';
const fixture={id:'fixture',email:TEST_EMAIL,firstName:'Test',lastName:'Member',role:'MEMBER',membershipStatus:'APPROVED',isActive:true,passwordHash:hash};
const req=(path, method, data, session, lab=secret)=>new Request('https://test.invalid'+path,{method,headers:{'X-UCFR-Lab-Token':lab,...(session?{Authorization:'Bearer '+session}:{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
test('real bcrypt fixture and isolated login/me session',async()=>{
 let clock=1000;
 const pilot=createAuthPilot({findFixture:async()=>fixture,comparePassword:bcrypt.compare,now:()=>clock});
 const r=await pilot(req('/lab/api/auth/login','POST',{email:TEST_EMAIL,password}),env);
 assert.equal(r.status,200);const body=await r.json();
 assert.equal(body.user.id,'fixture');assert.equal(body.user.passwordHash,undefined);
 const me=await pilot(req('/lab/api/auth/me','GET',null,body.token),env);assert.equal(me.status,200);
 assert.deepEqual((await me.json()).user,body.user);
 const altered=body.token.split('.');altered[2]='A'+altered[2].slice(1);if(altered[2]===body.token.split('.')[2])altered[2]='B'+altered[2].slice(1);
 assert.equal((await pilot(req('/lab/api/auth/me','GET',null,altered.join('.')),env)).status,401);
 clock+=600;assert.equal((await pilot(req('/lab/api/auth/me','GET',null,body.token),env)).status,401);
});
test('production paths and real identities are excluded, wrong credentials rejected',async()=>{
 let calls=0;
 const pilot=createAuthPilot({findFixture:async()=>{calls++;return fixture},comparePassword:async()=>false});
 assert.equal(await pilot(req('/api/auth/login','POST',{email:TEST_EMAIL,password}),env),null);
 assert.equal((await pilot(req('/lab/api/auth/login','POST',{email:'member@real.invalid',password}),env)).status,401);
 assert.equal((await pilot(req('/lab/api/auth/login','POST',{email:TEST_EMAIL,password},null,'wrong'),env)).status,401);
 assert.equal(calls,0);
 assert.equal((await pilot(req('/lab/api/auth/login','POST',{email:TEST_EMAIL,password:'wrong'}),env)).status,401);
 assert.equal(calls,1);
});
test('inactive or privileged fixture cannot obtain a session',async()=>{
 for(const user of [{...fixture,isActive:false},{...fixture,role:'ADMIN'}]){
  const pilot=createAuthPilot({findFixture:async()=>user,comparePassword:async()=>true});
  assert.equal((await pilot(req('/lab/api/auth/login','POST',{email:TEST_EMAIL,password}),env)).status,401);
 }
});
