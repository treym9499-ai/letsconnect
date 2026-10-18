// End-to-end test: two real browser contexts (+ a REST-driven third user) against the live site or emulators.
const {chromium}=require('playwright-core');
const EMU=!!process.env.EMU;
const URL=process.env.U||'https://treym9499-ai.github.io/letsconnect/';
const SS=EMU?'/tmp/emu-shots/':'/workspace/messenger-app/screenshots/';
const KEY='AIzaSyDUCCsYG1YnjAtf2MY_rs5AdTmwZCBfzA8', PID='tdm-chat-804774';
const FS=(EMU?'http://127.0.0.1:8080':'https://firestore.googleapis.com')+`/v1/projects/${PID}/databases/(default)/documents`;
const IT=EMU?'http://127.0.0.1:9099/identitytoolkit.googleapis.com':'https://identitytoolkit.googleapis.com';
const FWD="They didn't want to answer 🤷🏻‍♂️";
const r=Math.random().toString(36).slice(2,7);
const U=[{dn:'Alice Test',un:'alice_'+r,em:`tdm.alice.${r}@example.com`},{dn:'Bob Test',un:'bob_'+r,em:`tdm.bob.${r}@example.com`}];
const C={dn:'Carl Test',un:'carl_'+r,em:`tdm.carl.${r}@example.com`};
const PW='TdmTest!2026';console.log('run',r,URL);
const results=[];const ok=(n,v,x='')=>{results.push([n,!!v,x]);console.log(v?'PASS':'FAIL',n,x)};
async function rest(path,opt={}){const res=await fetch(path,opt);let b;try{b=await res.json()}catch{b=null}return {s:res.status,b}}
const J=(t,method,body)=>({method,headers:{Authorization:'Bearer '+t,'content-type':'application/json'},body:body&&JSON.stringify(body)});
const sv=v=>({stringValue:v});
async function cleanup(){
  const del=(p,t)=>rest(`${FS}/${p}`,J(t,'DELETE'));
  for(const u of [...U,C]){const s=await rest(`${IT}/v1/accounts:signInWithPassword?key=${KEY}`,J('', 'POST',{email:u.em,password:PW,returnSecureToken:true}));if(!s.b?.idToken)continue;u.tok=s.b.idToken;u.uid=s.b.localId;}
  const live=[...U,C].filter(u=>u.tok);
  for(const a of live)for(const b of live){if(a===b)continue;const cid=[a.uid,b.uid].sort().join('_');
    const m=await rest(`${FS}/chats/${cid}/messages?pageSize=300`,J(a.tok,'GET'));for(const d of m.b?.documents||[])await del(d.name.split('/documents/')[1],a.tok);await del('chats/'+cid,a.tok);
    await del(`friendRequests/${a.uid}_${b.uid}`,a.tok);await del(`users/${a.uid}/friends/${b.uid}`,a.tok);}
  for(const u of live){const h=await rest(`${FS}/users/${u.uid}/callHistory?pageSize=300`,J(u.tok,'GET'));for(const d of h.b?.documents||[])await del(d.name.split('/documents/')[1],u.tok);
    await del(`usernames/${u.un}`,u.tok);await del(`users/${u.uid}`,u.tok);
    const d=await rest(`${IT}/v1/accounts:delete?key=${KEY}`,J('','POST',{idToken:u.tok}));console.log('deleted',u.em,d.s);}
}
(async()=>{
const b=await chromium.launch({args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const P=[];
for(const u of U){const c=await b.newContext({viewport:{width:1400,height:850},permissions:['microphone']});const p=await c.newPage();
 p.on('pageerror',e=>console.log(u.un,'PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log(u.un,'console',m.text().slice(0,200))});P.push(p);}
const [A,B]=P;const W=ms=>A.waitForTimeout(ms);
const go=async(p,t)=>{await p.click('#hamb');await p.click(`.drawer [data-go=${t}]`);await p.waitForTimeout(250);};
// --- login screen + Google button
await A.goto(URL);await A.waitForSelector('#gbtn');await A.screenshot({path:SS+'01-login.png'});
const popP=A.context().waitForEvent('page',{timeout:10000}).catch(()=>null);await A.click('#gbtn');const pop=await popP;
await W(1500);const gUrl=pop?pop.url():'';const gState=await A.evaluate(()=>window.__googleAttempt);
ok('Google button opens Firebase auth popup',pop&&/accounts\.google\.com|__\/auth\/handler|emulator/.test(gUrl)&&!/^error/.test(gState),`${gState} ${gUrl.slice(0,90)}`);
if(pop)await pop.close();
// --- register
for(let i=0;i<2;i++){const p=P[i],u=U[i];if(i)await p.goto(URL);await p.waitForSelector('#af');
 await p.click('#sw');await p.fill('#dn',u.dn);await p.fill('#un',u.un);await p.fill('#em',u.em);await p.fill('#pw',PW);await p.click('#go');
 await p.waitForSelector('#list',{timeout:25000});u.uid=await p.evaluate(()=>__app.user.uid);}
ok('register two users (email/password)',U[0].uid&&U[1].uid);
ok('app name in fixed header',await A.textContent('#brand')==='LetsConnect');
ok('home menu with 4 pills + clock',(await A.$$eval('.hpill',b=>b.map(x=>x.textContent.trim()).join(','))).startsWith('Messages,Calls,Friends,Settings')&&/^\d{1,2}:\d\d\s?(AM|PM)$/.test(await A.textContent('#clock')),await A.textContent('#clock'));
// themes: home screenshot in each, at phone size
await A.setViewportSize({width:390,height:844});
for(const t of ['default','pink','blue','usa','currency']){await go(A,'settings');await A.click(`[data-theme-id=${t}]`);await go(A,'home');await A.waitForTimeout(400);await A.screenshot({path:SS+`00-home-${t}.png`});}
await go(A,'settings');await A.click('[data-theme-id=pink]');await A.waitForTimeout(800);await A.screenshot({path:SS+'00-settings.png'});await A.reload();await A.waitForSelector('.hpill',{timeout:20000});
ok('theme persists after reload',await A.evaluate(()=>document.documentElement.dataset.theme)==='pink');
await go(A,'settings');await A.click('[data-theme-id=default]');await A.setViewportSize({width:1400,height:850});
// --- third user via REST, sends A a request (to test Decline)
const su=await rest(`${IT}/v1/accounts:signUp?key=${KEY}`,J('','POST',{email:C.em,password:PW,returnSecureToken:true}));C.tok=su.b.idToken;C.uid=su.b.localId;
await rest(`${FS}/usernames/${C.un}`,J(C.tok,'PATCH',{fields:{uid:sv(C.uid)}}));
await rest(`${FS}/users/${C.uid}`,J(C.tok,'PATCH',{fields:{username:sv(C.un),displayName:sv(C.dn),color:sv('#ffd60a'),online:{booleanValue:false},inCall:{booleanValue:false}}}));
const cr=await rest(`${FS}/friendRequests/${C.uid}_${U[0].uid}`,J(C.tok,'PATCH',{fields:{from:sv(C.uid),to:sv(U[0].uid)}}));
// --- friend request A -> B
await go(A,'friends');await A.fill('#sq',U[1].un);await A.click('#sf button');await A.waitForSelector('[data-add]');await A.click('[data-add]');
await go(B,'friends');await B.waitForSelector('#reqList [data-acc]',{timeout:15000});
await go(B,'home');await B.waitForSelector('.hpill[data-t=friends] .badge',{timeout:15000});ok('home Friends pill shows request badge',(await B.textContent('.hpill[data-t=friends] .badge'))==='1');await go(B,'friends');
await B.screenshot({path:SS+'02-connection-requests.png'});
await B.click('#reqList [data-acc]');await B.waitForFunction(()=>!document.querySelector('#reqList [data-acc]'),null,{timeout:15000});
ok('Connect removes request + adds friend',await B.waitForFunction(n=>document.querySelector('#list').textContent.includes(n),U[0].dn,{timeout:15000}).then(()=>true));
await A.waitForSelector('#reqList [data-decl]',{timeout:15000}).catch(()=>{});
ok('Decline button visible for incoming request',cr.s===200&&await A.$('#reqList [data-req] [data-decl]'));
await A.click('#reqList [data-req] [data-decl]');await A.waitForFunction(()=>!document.querySelector('#reqList [data-req]'),null,{timeout:10000});
ok('Decline removes request',(await rest(`${FS}/friendRequests/${C.uid}_${U[0].uid}`,J(C.tok,'GET'))).s!==200);
await A.waitForFunction(n=>[...document.querySelectorAll('#activeList .row')].some(x=>x.textContent.includes(n)&&x.querySelector('.gdot')),U[1].dn,{timeout:20000});
ok('Active Friends dropdown shows friend with green dot',true);
await A.screenshot({path:SS+'03-friends-active.png'});
// --- chat row only after first message
await go(A,'chats');await W(500);
ok('no chat row before first message',(await A.$$('#list .swipe')).length===0);
await A.click('#compose');await A.fill('#toq','Bob');await A.waitForSelector('[data-pick]');await A.click('[data-pick]');await A.fill('#cmt','Hey Bob! 👋 (sent via compose)');
await A.screenshot({path:SS+'04-compose.png'});await A.click('#cms');
await A.waitForFunction(()=>document.querySelector('#msgs')?.textContent.includes('via compose'),null,{timeout:15000});ok('compose To: + Send opens chat with message',true);
await go(B,'chats');await B.waitForFunction(()=>document.querySelector('#list .swipe .cnt')?.textContent==='1',null,{timeout:15000});
ok('chat row appears after first message with unread badge',true);
await B.screenshot({path:SS+'05-chats-list.png'});
await B.click('#list .swipe .row');await B.waitForFunction(()=>document.querySelector('#msgs')?.textContent.includes('via compose'),null,{timeout:15000});ok('message delivered in real time',true);
await A.waitForFunction(()=>document.querySelector('#seen')?.textContent==='Seen',null,{timeout:15000}).then(()=>ok('seen indicator',true)).catch(()=>ok('seen indicator',false));
await B.type('#ta','typing...',{delay:50});await A.waitForSelector('#typing',{timeout:10000}).then(()=>ok('typing indicator',true)).catch(()=>ok('typing indicator',false));
await B.fill('#ta','Hi Alice, works great 🎉');await B.press('#ta','Enter');await B.fill('#ta','🔥');await B.press('#ta','Enter');
await A.waitForFunction(()=>document.querySelector('#msgs').textContent.includes('works great'),null,{timeout:15000});ok('reply delivered',true);
await W(600);await A.screenshot({path:SS+'06-chat.png'});
// --- search
await A.fill('#cq','bob');await W(300);const s1=await A.$$eval('#list .row',rs=>rs.map(r=>r.textContent));
await A.fill('#cq','zzzz');await W(300);const s2=await A.$$('#list .row');
ok('chat search filters friends',s1.length===1&&s1[0].includes('Bob Test')&&s2.length===0);await A.fill('#cq','');
// --- mobile screenshot
await B.setViewportSize({width:390,height:844});await W(400);await B.screenshot({path:SS+'07-chat-mobile.png'});
await B.click('#back');await W(300);await B.screenshot({path:SS+'08-chats-mobile.png'});await B.setViewportSize({width:1400,height:850});
// --- call 1: Forward It
await A.click('#callbtn');
await B.waitForSelector('#callov[data-state=incoming]',{timeout:20000});
ok('incoming call screen with Pick Up / Forward It',await B.textContent('#ctitle')==='Incoming Call'&&await B.$('#cacc')&&await B.$('#cfwd'));
await B.screenshot({path:SS+'09-incoming-call.png'});
await B.click('#cfwd');
await A.waitForFunction(t=>document.querySelector('#msgs')?.textContent.includes(t),FWD,{timeout:15000}).then(()=>ok('Forward It auto-sends exact message',true)).catch(()=>ok('Forward It auto-sends exact message',false));
await A.waitForFunction(()=>!document.querySelector('#callov'),null,{timeout:10000});
await W(3500);
// --- call 2: Pick Up (A calls from Friends tab so we can watch "Having a conversation")
await go(A,'calls');await A.click('#pickcall');await A.waitForSelector('#callPicker [data-callpick] .gdot');await A.screenshot({path:SS+'13-calls-friend-picker.png'});ok('Calls phone icon opens friend picker with active dot',true);await A.click('#callPicker [data-callpick]');
await B.waitForSelector('#callov[data-state=incoming]',{timeout:20000});await B.click('#cacc');
for(const p of [A,B])await p.waitForSelector('#callov[data-state=active]',{timeout:30000});
ok('Pick Up -> both on "Active Phone Call"',(await A.textContent('#ctitle'))==='Active Phone Call'&&(await B.textContent('#ctitle'))==='Active Phone Call');
const st=await Promise.all([A,B].map(p=>p.evaluate(()=>({c:__pc.connectionState,i:__pc.iceConnectionState}))));
ok('WebRTC connected',st.every(s=>s.c==='connected'||['connected','completed'].includes(s.i)),JSON.stringify(st));
await W(3000);
const inb=await B.evaluate(async()=>{const s=await __pc.getStats();let x=0;s.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='audio')x=r.bytesReceived});return x});ok('audio bytes flowing',inb>0,'bytesReceived='+inb);
await go(A,'friends');await A.waitForFunction(()=>document.querySelector('#activeList')?.textContent.includes('Having a conversation'),null,{timeout:70000}).then(()=>ok('"Having a conversation" shown for friend in call',true)).catch(()=>ok('"Having a conversation" shown for friend in call',false));
await A.screenshot({path:SS+'10-active-call.png'});
await A.click('#chang');
await B.waitForFunction(()=>!document.querySelector('#callov')||document.querySelector('#callov').dataset.state==='ended',null,{timeout:10000});
ok('hang up propagates',true,await B.evaluate(()=>JSON.stringify(window.__lastCall)));
await W(4000);
// --- call history
for(const [p,exp] of [[A,['You called','Called · declined']],[B,['Received','Declined (forwarded)']]]){await go(p,'calls');await p.waitForSelector('#list .hist',{timeout:10000});
 const t=await p.$$eval('#list .hist',rs=>rs.map(r=>r.textContent.replace(/\s+/g,' ')));
 ok('call history ('+(p===A?'caller':'callee')+')',exp.every(e=>t.some(x=>x.includes(e)))&&t.some(x=>/\d:\d\d/.test(x)&&/20\d\d/.test(x)),t.join(' | ').slice(0,220));}
await A.screenshot({path:SS+'11-call-history.png'});
ok('call docs cleaned up',await (async()=>{const q=await rest(`${FS}:runQuery`,J(U[0].tok=(await rest(`${IT}/v1/accounts:signInWithPassword?key=${KEY}`,J('','POST',{email:U[0].em,password:PW,returnSecureToken:true}))).b.idToken,'POST',{structuredQuery:{from:[{collectionId:'calls'}],where:{fieldFilter:{field:{fieldPath:'caller'},op:'EQUAL',value:sv(U[0].uid)}}}}));return Array.isArray(q.b)&&!q.b.some(x=>x.document)})());
// --- swipe-left delete on B
await go(B,'chats');await B.waitForSelector('#list .swipe .row');
const box=await (await B.$('#list .swipe .row')).boundingBox();
await B.mouse.move(box.x+box.width-30,box.y+box.height/2);await B.mouse.down();for(let i=1;i<=10;i++)await B.mouse.move(box.x+box.width-30-i*14,box.y+box.height/2);await B.mouse.up();
await W(300);ok('swipe left reveals Delete',await B.$('#list .swipe.open'));await B.screenshot({path:SS+'12-swipe-delete.png'});
await B.click('#list .swipe.open .del');await B.waitForFunction(()=>!document.querySelector('#list .swipe'),null,{timeout:10000}).then(()=>ok('Delete removes conversation for this user',true)).catch(()=>ok('Delete removes conversation for this user',false));
ok('other side still has conversation',(await go(A,'chats'),await A.$$('#list .swipe')).length===1);
await A.click('#list .swipe .row');await A.fill('#ta','Are you there?');await A.press('#ta','Enter');
await B.waitForSelector('#list .swipe',{timeout:15000});await B.click('#list .swipe .row');await B.waitForFunction(()=>document.querySelector('#msgs')?.textContent.includes('Are you there'),null,{timeout:10000});
ok('conversation reappears with only new messages',!(await B.textContent('#msgs')).includes('via compose'));
// --- security rules negative tests (Carl is not part of A/B chat)
const tokA=U[0].tok, cid=[U[0].uid,U[1].uid].sort().join('_');
const n=[await rest(`${FS}/chats/${cid}/messages`,J(C.tok,'GET')),await rest(`${FS}/chats/${cid}`,J(C.tok,'GET')),
 await rest(`${FS}/chats/${cid}/messages`,J(C.tok,'POST',{fields:{from:sv(C.uid),text:sv('intrude')}})),
 await rest(`${FS}/users/${U[0].uid}?updateMask.fieldPaths=displayName`,J(C.tok,'PATCH',{fields:{displayName:sv('hacked')}})),
 await rest(`${FS}/users/${U[0].uid}/friends/${C.uid}`,J(C.tok,'PATCH',{fields:{}})),
 await rest(`${FS}/users/${U[0].uid}/callHistory`,J(C.tok,'GET'))];
['outsider cannot list messages','outsider cannot read chat','outsider cannot post message','cannot edit others profile','cannot force-add self as friend','cannot read others call history'].forEach((t,i)=>ok('rules: '+t,n[i].s===403,'status '+n[i].s));
const pos=await rest(`${FS}/chats/${cid}/messages`,J(tokA,'GET'));ok('rules: member can read messages',pos.s===200&&pos.b.documents?.length>=3,'status '+pos.s);
await b.close();
await cleanup();
console.log('\nSUMMARY',results.filter(x=>x[1]).length+'/'+results.length);if(results.some(x=>!x[1]))console.log('FAILED:',results.filter(x=>!x[1]).map(x=>x[0]).join('; '));
})().catch(async e=>{console.error('ERR',e.message.slice(0,500));await cleanup().catch(()=>{});process.exit(1)});
