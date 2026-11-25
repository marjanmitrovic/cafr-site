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
const memberCount=await request('/api/public/member-count');assert.equal(memberCount.status,200);assert.equal(memberCount.body.count,1);
const news=await request('/api/news');assert.equal(news.status,200);assert.deepEqual(news.body,[]);
assert.equal((await request('/api/documents',{token})).status,200);
assert.equal((await request('/api/auth/me',{token:'invalid'})).status,401);
console.log('Original API: health, bcrypt login, JWT session, role protection, public data and documents passed on isolated PostgreSQL.');
