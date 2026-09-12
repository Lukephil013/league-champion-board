import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, validateState, placeChampion, shift, persistState, STORAGE_KEY } from '../dist/core.mjs';
const fixture=()=>({...initialState(),accounts:[{id:'a',name:'Jungle',champions:['JarvanIV','Gragas']},{id:'b',name:'Practice',champions:[]}]});
test('copy gives two placements with one shared notebook; move changes only membership',()=>{
 const before=fixture();before.notes.JarvanIV='Edited shared notes';
 const copy=placeChampion(before,'JarvanIV','b','a',true);
 assert.deepEqual(copy.accounts.map(a=>a.champions),[['JarvanIV','Gragas'],['JarvanIV']]);
 assert.equal(copy.notes.JarvanIV,'Edited shared notes');assert.deepEqual(before.accounts[1].champions,[]);
 const moved=placeChampion(before,'JarvanIV','b','a');assert.deepEqual(moved.accounts.map(a=>a.champions),[['Gragas'],['JarvanIV']]);assert.deepEqual(moved.notes,before.notes);
});
test('duplicate target rejects without removing the source placement',()=>{const s=fixture();s.accounts[1].champions=['JarvanIV'];assert.throws(()=>placeChampion(s,'JarvanIV','b','a'),/already/);assert.deepEqual(s.accounts[0].champions,['JarvanIV','Gragas']);});
test('drag reorder and button reorder preserve other champions and notes',()=>{const s=fixture();assert.deepEqual(placeChampion(s,'Gragas','a','a',false,'JarvanIV').accounts[0].champions,['Gragas','JarvanIV']);assert.deepEqual(shift(['a','b','c'],'b',1),['a','c','b']);assert.deepEqual(shift(['a','b'],'a',-1),['a','b']);assert.equal(placeChampion(s,'JarvanIV','a','a',false,'JarvanIV'),s);});
test('invalid source cannot add an arbitrary placement',()=>{const s=fixture();assert.equal(placeChampion(s,'Zac','b','a'),s);});
test('export/import round trip retains blank edits and unplaced champion notes',()=>{const s=fixture();s.notes.Gragas='';s.notes.Zac='Unplaced but saved';const copy=validateState(JSON.parse(JSON.stringify(s)));assert.deepEqual(copy,s);copy.accounts=[];assert.equal(validateState(copy).notes.Zac,'Unplaced but saved');});
test('malformed backups and duplicate records fail closed',()=>{for(const s of [null,[],{}, {...fixture(),schemaVersion:2},{...fixture(),accounts:[{id:'a',name:'A',champions:['Zac','Zac']}]},{...fixture(),accounts:[{id:'a',name:'',champions:[]}]},{...fixture(),notes:{Zac:42}},JSON.parse('{"schemaVersion":1,"accounts":[],"notes":{"__proto__":"bad"}}')])assert.throws(()=>validateState(s),/valid/);});
test('unknown champion IDs survive import for forward compatibility; HTML remains text',()=>{const s=fixture();s.accounts[0].name='<script>bad()</script>';s.notes.FutureChampion='Do not execute <img onerror=bad()>';assert.deepEqual(validateState(s),s);});
test('storage quota failure reports not saved and preserves in-memory changes',()=>{const s=fixture(),snapshot=structuredClone(s);const r=persistState({setItem(){throw new Error('QuotaExceededError');}},s);assert.equal(r.saved,false);assert.match(r.message,/Export a backup/);assert.deepEqual(s,snapshot);});
test('persisted data restores through the same versioned key',()=>{let saved;assert.equal(persistState({setItem(k,v){assert.equal(k,STORAGE_KEY);saved=v;}},fixture()).saved,true);assert.deepEqual(validateState(JSON.parse(saved)),fixture());});
