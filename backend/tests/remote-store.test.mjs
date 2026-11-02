import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {createApp} from '../server.mjs';
import {openStore} from '../store.mjs';

test('libSQL adapter: owned PDF at 5MB, unique application, and persistence',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'jobconnect-libsql-'));
 const databaseUrl=pathToFileURL(join(dir,'test.sqlite')).href;
 const {server}=await createApp({databaseUrl});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>server.close(r));const target=resolve(dir);assert.ok(target.startsWith(resolve(tmpdir())+ '\\')||target.startsWith(resolve(tmpdir())+'/'));await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 const base='http://127.0.0.1:'+server.address().port;
 let cookie='';
 async function request(path,{data,body,...options}={}){const r=await fetch(base+'/api'+path,{...options,headers:{...options.headers,...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):body});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const result=r.headers.get('content-type')?.includes('application/json')?await r.json():Buffer.from(await r.arrayBuffer());return {status:r.status,data:result};}
 const account=await request('/auth/register',{method:'POST',data:{name:'Cloud Candidate',email:'cloud@example.com',password:'CloudPassword123!',role:'Candidate'}});
 assert.equal(account.status,201);assert.ok(!JSON.stringify(account.data).includes('password'));
 assert.equal((await request('/auth/me')).data.user.role,'Candidate');
 assert.equal((await request('/admin/users')).status,403);
 const pdf=Buffer.alloc(5*1024*1024,32);pdf.write('%PDF-1.4\n');pdf.write('\n%%EOF',pdf.length-6);
 const upload=await request('/candidate/cvs?name=cloud.pdf',{method:'POST',headers:{'Content-Type':'application/pdf'},body:pdf});
 assert.equal(upload.status,201);const cvId=upload.data.cv.id;
 assert.deepEqual((await request('/candidate/cvs/'+cvId)).data,pdf);
 await request('/candidate/saved/1',{method:'PUT'});await request('/candidate/saved/1',{method:'PUT'});
 assert.deepEqual((await request('/candidate/saved')).data.saved,[1]);
 assert.equal((await request('/candidate/applications',{method:'POST',data:{jobId:1,cvId}})).status,201);
 assert.equal((await request('/candidate/applications',{method:'POST',data:{jobId:1,cvId}})).status,409);
 const application=(await request('/candidate/applications')).data.applications[0];
 assert.equal(application.status,'submitted');
 await request('/candidate/applications/'+application.id+'/withdraw',{method:'PATCH'});
 assert.equal((await request('/candidate/applications')).data.applications[0].status,'withdrawn');
 assert.equal((await request('/candidate/applications/'+application.id+'/withdraw',{method:'PATCH'})).status,409);
 const reopened=await openStore(':memory:',{url:databaseUrl});
 try{assert.equal((await reopened.prepare('SELECT COUNT(*) AS n FROM cvs').get()).n,1);assert.equal((await reopened.prepare('SELECT status FROM applications WHERE id=?').get(application.id)).status,'withdrawn');}finally{reopened.close();}
});

test('free hosting refuses ephemeral database without Turso credentials',async()=>{
 const old=process.env.REQUIRE_REMOTE_DB;process.env.REQUIRE_REMOTE_DB='true';
 try{await assert.rejects(()=>openStore(':memory:',{url:''}),/TURSO_DATABASE_URL/);}finally{if(old===undefined)delete process.env.REQUIRE_REMOTE_DB;else process.env.REQUIRE_REMOTE_DB=old;}
});
