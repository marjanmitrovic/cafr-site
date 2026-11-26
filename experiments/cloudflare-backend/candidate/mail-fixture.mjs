import http from 'node:http';
let latest=null;
const server=http.createServer(async(req,res)=>{
 if(req.url==='/fixture'&&req.method==='GET'){
  res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(latest));
 }
 if(req.url!=='/v3/smtp/email'||req.method!=='POST'||req.headers['api-key']!=='synthetic-ci-key'){res.writeHead(404);return res.end();}
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>50000){res.writeHead(413);return res.end();}}
 try {
  const data=JSON.parse(raw);
  if(data.to?.length!==1||data.to[0].email!=='member@example.invalid')throw Error('Unexpected fixture recipient');
  const match=String(data.textContent).match(/https:\/\/candidate\.invalid\/reset\.html\?token=([a-f0-9]{64})/);
  if(!match)throw Error('Missing reset link');
  latest={token:match[1]};
  res.writeHead(201,{'Content-Type':'application/json'});return res.end(JSON.stringify({messageId:'synthetic-ci-message'}));
 }catch{res.writeHead(400);return res.end();}
});
server.listen(8790,'127.0.0.1');
