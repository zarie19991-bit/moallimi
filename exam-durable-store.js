(()=>{
'use strict';
if(window.NafesDurableStore)return;

const DB_NAME='nafes_exam_reliability_v1';
const DB_VERSION=1;
const STORE='drafts';
let dbPromise=null;
// Some browsers leave indexedDB.open() pending forever (private mode, storage pressure, OS bugs). The player awaits these calls
// before showing a restored attempt, so every operation is bounded and degrades to "nothing stored" instead of freezing the exam.
const OP_TIMEOUT_MS=1500;
function bounded(promise,fallback){
  return new Promise(resolve=>{
    const timer=setTimeout(()=>{dbPromise=null;resolve(fallback);},OP_TIMEOUT_MS);
    promise.then(v=>{clearTimeout(timer);resolve(v);},()=>{clearTimeout(timer);resolve(fallback);});
  });
}

function openDb(){
  if(!('indexedDB' in window))return Promise.reject(new Error('IndexedDB unavailable'));
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
    req.onblocked=()=>reject(new Error('IndexedDB blocked'));
  }).catch(error=>{dbPromise=null;throw error;});
  return dbPromise;
}
function requestPromise(req){
  return new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('IndexedDB request failed'));
  });
}
async function withStore(mode,fn){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const store=tx.objectStore(STORE);
    let result;
    try{result=fn(store);}catch(error){reject(error);return;}
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
    tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
  });
}
async function getRaw(key){
  try{
    const db=await openDb();
    const tx=db.transaction(STORE,'readonly');
    return (await requestPromise(tx.objectStore(STORE).get(String(key))))?.value??null;
  }catch(_){return null;}
}
async function putRaw(key,value){
  try{
    await withStore('readwrite',store=>store.put({key:String(key),value,updated_at:Date.now()}));
    return true;
  }catch(_){return false;}
}
async function removeRaw(key){
  try{await withStore('readwrite',store=>store.delete(String(key)));return true;}catch(_){return false;}
}
const get=key=>bounded(getRaw(key),null),put=(key,value)=>bounded(putRaw(key,value),false),remove=key=>bounded(removeRaw(key),false);
window.NafesDurableStore=Object.freeze({get,put,remove});
})();