// ================================================================
// TATA STOCK MANAGER — FIREBASE FIRESTORE STORAGE v7
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBP87gFLcF9dpLkyMZS6u2GLVl8kSAhpkA",
  authDomain: "tata-stock.firebaseapp.com",
  projectId: "tata-stock",
  storageBucket: "tata-stock.firebasestorage.app",
  messagingSenderId: "354812004412",
  appId: "1:354812004412:web:3fa12aedd2ba24b10bdb39"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

let _cache = {};

async function fsGet(key) {
  try { const s = await getDoc(doc(db,"appdata",key)); return s.exists()?s.data().value:null; }
  catch(e) { console.error("fsGet",key,e); return null; }
}
async function fsSet(key,value) {
  try { await setDoc(doc(db,"appdata",key),{value}); return true; }
  catch(e) { console.error("fsSet",key,e); return false; }
}
async function fsDel(key) {
  try { await deleteDoc(doc(db,"appdata",key)); } catch(e) { console.error("fsDel",key,e); }
}

async function dGet(key) {
  if(_cache[key]!==undefined) return _cache[key];
  const val = await fsGet(key);
  if(val!==null) _cache[key]=val;
  return val;
}
async function dSet(key,value) {
  _cache[key]=value;
  const dot=document.getElementById("dataStatusDot");
  if(dot){dot.className="data-status-dot saving";setTimeout(()=>dot.className="data-status-dot",1000);}
  await fsSet(key,value);
}
async function dDel(key) { delete _cache[key]; await fsDel(key); }

const DEF={
  storeName:"Tata Stock Manager",tagline:"",lowStockLevel:5,currency:"₹",
  defaultDiscount:0,bulkDiscount:0,bulkMinQty:5,maxDiscount:50,showDiscPct:"yes",
  expCriticalDays:7,expNearDays:30,showExpiryAlert:"yes",announcement:"",announcementType:"info",
  accentColor:"#e8a020",accentLight:"#f0c060",bgColor:"#0d0f14",bg2Color:"#14171f",bg3Color:"#1c2030",
  fontSize:"15px",fontFamily:"Rajdhani",borderRadius:"10px",tabStyle:"default",cardShadow:"normal",
  borderStyle:"normal",dashCols:"1",staffPin:"",staffModeActive:"no",
  staffPerms:{stock:true,sale:true,pricing:true,expiry:true,history:true},
  autoLock:0,lastBackup:"",appPassword:"1234",adminPin:"1234"
};

async function getSettings(){const s=await dGet("settings");return s?{...DEF,...s}:{...DEF};}
async function setSettings(s){await dSet("settings",s);}
async function getAdminData(){const a=await dGet("admin");return a||{pin:"1234"};}
async function setAdminData(a){await dSet("admin",a);}
async function getStock(){return(await dGet("stock"))||{};}
async function setStock(s){await dSet("stock",s);}
async function setStockOne(name,qty){const s=await getStock();s[name]=qty;await dSet("stock",s);}
async function getHistory(){return(await dGet("history"))||{};}
async function setHistory(h){await dSet("history",h);}
async function addLogDirect(cat,prod,code,type,qty,bal,amt,note,time,date){
  const h=await getHistory();if(!h[date])h[date]=[];
  h[date].push({cat,product:prod,code,type,qty,balance:bal,salePrice:amt||null,note:note||"",time});
  await dSet("history",h);
}
async function getPricing(){return(await dGet("pricing"))||{};}
async function setPricing(p){await dSet("pricing",p);}
async function setPricingOne(name,p){const pr=await getPricing();pr[name]=p;await dSet("pricing",pr);}
async function deletePricingOne(name){const pr=await getPricing();delete pr[name];await dSet("pricing",pr);}
async function getExpiry(){return(await dGet("expiry"))||[];}
async function setExpiry(e){await dSet("expiry",e);}
async function addExpiryOne(entry){const e=await getExpiry();e.push(entry);await dSet("expiry",e);}
async function updateExpiryOne(id,updates){const e=await getExpiry();const idx=e.findIndex(x=>x.id===id);if(idx!==-1){Object.assign(e[idx],updates);await dSet("expiry",e);}}
async function deleteExpiryOne(id){await dSet("expiry",(await getExpiry()).filter(x=>x.id!==id));}

async function getCatalogData(){
  const existing=await dGet("catalog");
  if(existing&&Object.keys(existing).length>0)return existing;
  const seed={};
  for(const[cat,list]of Object.entries(PRODUCTS))seed[cat]=list.map(e=>({name:Array.isArray(e)?e[0]:e,code:Array.isArray(e)?e[1]:""}));
  await dSet("catalog",seed);await dSet("initDone",true);return seed;
}
async function setCatalogData(c){await dSet("catalog",c);}

async function runHealthCheck(){
  try{
    await fsGet("settings");
    const dot=document.getElementById("dataStatusDot");
    if(dot){dot.className="data-status-dot";dot.title="✅ Firebase connected";}
  }catch(e){
    const dot=document.getElementById("dataStatusDot");
    if(dot){dot.className="data-status-dot error";dot.title="❌ Firebase error";}
  }
}

async function exportFullBackup(silent=false){
  const data={version:7,exportedAt:new Date().toISOString(),stock:await getStock(),history:await getHistory(),pricing:await getPricing(),settings:await getSettings(),expiry:await getExpiry(),catalog:await getCatalogData()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  const d=new Date();a.href=url;a.download=`tata_backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}.json`;
  a.click();URL.revokeObjectURL(url);
  const s=await getSettings();s.lastBackup=new Date().toISOString();await setSettings(s);
  if(!silent)window.showToast("✅ Backup downloaded!");
}

async function importBackup(jsonStr){
  try{
    const data=JSON.parse(jsonStr);if(!data||typeof data!=="object")return false;
    _cache={};
    if(data.settings)await dSet("settings",{...DEF,...data.settings});
    if(data.stock)await dSet("stock",data.stock);
    if(data.history)await dSet("history",data.history);
    if(data.pricing)await dSet("pricing",data.pricing);
    if(data.expiry)await dSet("expiry",data.expiry);
    if(data.catalog)await dSet("catalog",data.catalog);
    await dSet("initDone",true);return true;
  }catch(e){console.error("Import failed:",e);return false;}
}

async function resetTable(key){
  delete _cache[key];
  const defaults={stock:{},history:{},pricing:{},expiry:[],catalog:{}};
  const val=defaults[key]!==undefined?defaults[key]:null;
  if(val!==null)await dSet(key,val);else await dDel(key);
}

async function getStorageInfo(){return{idbInfo:"☁️ Firebase Firestore",lsInfo:"✅ Cloud — browser clear se safe"};}

async function checkAutoExport(){
  const s=await getSettings(),nagEl=document.getElementById("backupNagBanner");if(!nagEl)return;
  if(!s.lastBackup){nagEl.style.display="block";nagEl.innerHTML=`⚠️ Backup abhi tak nahi hua! <button onclick="exportFullBackup()" style="margin-left:10px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display='none'" style="margin-left:6px;padding:4px 8px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>`;return;}
  const days=Math.round((Date.now()-new Date(s.lastBackup).getTime())/864e5);
  if(days>=7){nagEl.style.display="block";nagEl.innerHTML=`⚠️ ${days} din se backup nahi hua! <button onclick="exportFullBackup()" style="margin-left:10px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display='none'" style="margin-left:6px;padding:4px 8px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>`;}
}

// Expose all to window
Object.assign(window,{getSettings,setSettings,getAdminData,setAdminData,getStock,setStock,setStockOne,getHistory,setHistory,addLogDirect,getPricing,setPricing,setPricingOne,deletePricingOne,getExpiry,setExpiry,addExpiryOne,updateExpiryOne,deleteExpiryOne,getCatalogData,setCatalogData,runHealthCheck,exportFullBackup,importBackup,resetTable,getStorageInfo,checkAutoExport});

// Signal ready
document.getElementById("fbInitOverlay").style.display = "none";
window._firebaseReady = true;
window.dispatchEvent(new Event("firebaseReady"));
