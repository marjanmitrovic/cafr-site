import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8789',access='a'.repeat(48);
async function request(path,{method='GET',body,token}={}){
 const r=await fetch(origin+path,{method,headers:{'X-UCFR-Candidate-Token':access,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,body:await r.json()};
}
const health=await request('/api/health');assert.equal(health.status,200);assert.equal(health.body.ok,true);
const wrong=await request('/api/auth/login',{method:'POST',body:{email:'member@example.invalid',password:'invalid'}});assert.equal(wrong.status,401);
const result=await request('/api/auth/login',{method:'POST',body:{email:'member@example.invalid',password:'ucfr-ci-test-only'}});
assert.equal(result.status,200);assert.equal(result.body.user.role,'MEMBER');assert.equal(result.body.user.passwordHash,undefined);assert.ok(result.body.token);
const token=result.body.token;
const me=await request('/api/auth/me',{token});assert.equal(me.status,200);assert.equal(me.body.user.id,result.body.user.id);
assert.equal((await request('/api/admin/users',{token})).status,403);
const memberCount=await request('/api/public/member-count');assert.equal(memberCount.status,200);assert.equal(memberCount.body.count,3);
const news=await request('/api/news');assert.equal(news.status,200);assert.deepEqual(news.body,[]);
assert.equal((await request('/api/documents',{token})).status,200);
assert.equal((await request('/api/auth/me',{token:'invalid'})).status,401);
console.log('Original API: health, bcrypt login, JWT session, role protection, public data and documents passed on isolated PostgreSQL.');

// The following mutations are enabled ONLY against the disposable local CI database.
const admin=await request('/api/auth/login',{method:'POST',body:{email:'admin@example.invalid',password:'ucfr-ci-test-only'}});
assert.equal(admin.status,200);assert.equal(admin.body.user.role,'ADMIN');
const adminToken=admin.body.token,memberId=result.body.user.id;
assert.equal((await request('/api/admin/users',{token:adminToken})).status,200);
const profile=await request('/api/auth/me',{method:'PATCH',token,body:{firstName:'Updated',language:'en'}});
assert.equal(profile.status,200);assert.equal(profile.body.user.firstName,'Updated');
assert.equal((await request('/api/auth/me',{token})).body.user.firstName,'Updated');
const statusPath='/api/admin/users/'+memberId+'/status';
const rolePath='/api/admin/users/'+memberId+'/role';
assert.equal((await request(statusPath,{method:'PATCH',token,body:{membershipStatus:'SUSPENDED'}})).status,403);
assert.equal((await request(rolePath,{method:'PATCH',token:adminToken,body:{role:'ADMIN'}})).status,403);
const changed=await request(statusPath,{method:'PATCH',token:adminToken,body:{membershipStatus:'SUSPENDED'}});
assert.equal(changed.status,200);assert.equal(changed.body.user.membershipStatus,'SUSPENDED');
const notices=await request('/api/notifications/me',{token});
assert.equal(notices.status,200);assert.ok(notices.body.notifications.some(n=>n.type==='MEMBERSHIP_STATUS'));
assert.equal((await request('/api/public/member-count')).body.count,2);
assert.equal((await request(statusPath,{method:'PATCH',token:adminToken,body:{membershipStatus:'APPROVED'}})).status,200);
assert.equal((await request('/api/auth/password',{method:'PATCH',token,body:{currentPassword:'wrong',newPassword:'ucfr-ci-changed-only'}})).status,400);
assert.equal((await request('/api/auth/password',{method:'PATCH',token,body:{currentPassword:'ucfr-ci-test-only',newPassword:'ucfr-ci-changed-only'}})).status,200);
assert.equal((await request('/api/auth/login',{method:'POST',body:{email:'member@example.invalid',password:'ucfr-ci-test-only'}})).status,401);
assert.equal((await request('/api/auth/login',{method:'POST',body:{email:'member@example.invalid',password:'ucfr-ci-changed-only'}})).status,200);
console.log('Original API: admin permissions, profile update, transactional status/notification and password change passed.');


// Synthetic storage fixture; no production files are used.
const fixtureBytes=Buffer.from('Synthetic document fixture');
const documentFixture={titleCs:'Test',titleEn:'Test',category:'GENERAL',fileName:'test.pdf',fileData:'data:application/pdf;base64,'+fixtureBytes.toString('base64')};
const upload=await request('/api/admin/documents/upload',{method:'POST',token:adminToken,body:{...documentFixture,visibility:'APPROVED_MEMBERS'}});
assert.equal(upload.status,201,JSON.stringify(upload.body));
assert.equal(upload.body.file.storage,'postgresql');
const download=await fetch(origin+upload.body.file.url,{headers:{'X-UCFR-Candidate-Token':access,Authorization:'Bearer '+token}});
assert.equal(download.status,200);
assert.deepEqual(Buffer.from(await download.arrayBuffer()),fixtureBytes);
assert.match(download.headers.get('cache-control'),/no-store/);
const guest=await fetch(origin+upload.body.file.url,{headers:{'X-UCFR-Candidate-Token':access}});
assert.equal(guest.status,404);
console.log('Stored document upload, private download and exact bytes passed.');
