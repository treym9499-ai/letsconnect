const KEY='AIzaSyDUCCsYG1YnjAtf2MY_rs5AdTmwZCBfzA8',FS='https://firestore.googleapis.com/v1/projects/tdm-chat-804774/databases/(default)/documents';
const r=process.argv[2],PW='TdmTest!2026';
const j=async(u,o)=>{const x=await fetch(u,o);return {s:x.status,b:await x.json().catch(()=>null)}};
(async()=>{const U=[];for(const n of ['alice','bob','eve']){const s=await j(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`tdm.${n}.${r}@example.com`,password:PW,returnSecureToken:true})});if(s.b.idToken)U.push({n,t:s.b.idToken,uid:s.b.localId});}
const D=(p,t)=>j(`${FS}/${p}`,{method:'DELETE',headers:{Authorization:'Bearer '+t}});
if(U.length>=2){const cid=[U[0].uid,U[1].uid].sort().join('_');const m=await j(`${FS}/chats/${cid}/messages`,{headers:{Authorization:'Bearer '+U[0].t}});for(const d of m.b?.documents||[])await D(d.name.split('/documents/')[1],U[0].t);await D('chats/'+cid,U[0].t);}
for(const u of U){for(const o of U)await D(`users/${u.uid}/friends/${o.uid}`,u.t);await D(`usernames/${u.n}_${r}`,u.t);await D(`users/${u.uid}`,u.t);
for(const o of U)await D(`friendRequests/${u.uid}_${o.uid}`,u.t);
console.log(u.n,(await j(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:u.t})})).s);}})();
