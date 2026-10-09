(()=>{
'use strict';
if(window.NafesDurableStore)return;

const DB_NAME='nafes_exam_reliability_v1';
const DB_VERSION=1;
const STORE='drafts';
let dbPromise=null;

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
async function get(key){
  try{
    const db=await openDb();
    const tx=db.transaction(STORE,'readonly');
    return (await requestPromise(tx.objectStore(STORE).get(String(key))))?.value??null;
  }catch(_){return null;}
}
async function put(key,value){
  try{
    await withStore('readwrite',store=>store.put({key:String(key),value,updated_at:Date.now()}));
    return true;
  }catch(_){return false;}
}
async function remove(key){
  try{await withStore('readwrite',store=>store.delete(String(key)));return true;}catch(_){return false;}
}
window.NafesDurableStore=Object.freeze({get,put,remove});
})();