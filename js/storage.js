// ===================================================================
// TATA STOCK MANAGER — SUPABASE STORAGE ENGINE v7
// Data permanently in cloud — browser clear se kuch nahi hoga
// ===================================================================

const SUPABASE_URL = "https://cmrvgnnifigyrzolzguq.supabase.co";
const SUPABASE_KEY = "sb_publishable_ysAefCRqo3PZL9HYgyBB1g_bQQPgUda";
const SB_H = {
  "Content-Type":"application/json",
  "apikey": SUPABASE_KEY,
  "Authorization":"Bearer "+SUPABASE_KEY
};

let _cache = {};

async function sbQ(table, query=""){
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`,{headers:SB_H});
    if(!r.ok)throw new Error(await r.text());
    return await r.json();
  }catch(e){console.error("sbQ",table,e);return null;}
}

async function sbUps(table,data){
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}`,{
      method:"POST",
      headers:{...SB_H,"Prefer":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify(data)
    });
    if(!r.ok)throw new Error(await r.text());
    return true;
  }catch(e){console.error("sbUps",table,e);return false;}
}

async function sbPatch(table,filter,data){
  try{
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`,{
      method:"PATCH",headers:{...SB_H,"Prefer":"return=minimal"},body:JSON.stringify(data)
    });
    return true;
  }catch(e){console.error("sbPatch",e);return false;}
}

async function sbDel(table,filter){
  try{
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`,{method:"DELETE",headers:SB_H});
    return true;
  }catch(e){console.error("sbDel",e);return false;}
}

// ── DEFAULTS ────────────────────────────────────────────────────
const DEF_SETTINGS={
  storeName:"Tata Stock Manager",tagline:"",lowStockLevel:5,
  currency:"₹",defaultDiscount:0,bulkDiscount:0,bulkMinQty:5,
  maxDiscount:50,showDiscPct:"yes",expCriticalDays:7,expNearDays:30,
  showExpiryAlert:"yes",announcement:"",announcementType:"info",
  accentColor:"#e8a020",accentLight:"#f0c060",
  bgColor:"#0d0f14",bg2Color:"#14171f",bg3Color:"#1c2030",
  fontSize:"15px",fontFamily:"Rajdhani",borderRadius:"10px",
  tabStyle:"default",cardShadow:"normal",borderStyle:"normal",dashCols:"1",
  staffPin:"",staffModeActive:"no",
  staffPerms:{stock:true,sale:true,pricing:true,expiry:true,history:true},
  autoLock:0,lastBackup:"",appPassword:"1234",adminPin:"1234"
};

// ── SETTINGS ────────────────────────────────────────────────────
async function getSettings(){
  if(_cache.settings)return _cache.settings;
  const rows=await sbQ("settings");
  if(!rows||!rows.length)return{...DEF_SETTINGS};
  const s={...DEF_SETTINGS};
  rows.forEach(r=>{try{s[r.key]=JSON.parse(r.value);}catch{s[r.key]=r.value;}});
  if(typeof s.staffPerms==="string"){try{s.staffPerms=JSON.parse(s.staffPerms);}catch{}}
  _cache.settings=s;return s;
}
async function setSettings(obj){
  _cache.settings=obj;
  const rows=Object.entries(obj).map(([key,value])=>({key,value:typeof value==="object"?JSON.stringify(value):String(value)}));
  await sbUps("settings",rows);
}

// ── ADMIN ───────────────────────────────────────────────────────
async function getAdminData(){const s=await getSettings();return{pin:s.adminPin||"1234"};}
async function setAdminData(a){const s=await getSettings();s.adminPin=a.pin;await setSettings(s);}

// ── STOCK ───────────────────────────────────────────────────────
async function getStock(){
  if(_cache.stock)return _cache.stock;
  const rows=await sbQ("stock");
  if(!rows)return{};
  const obj={};rows.forEach(r=>obj[r.product_name]=r.quantity);
  _cache.stock=obj;return obj;
}
async function setStock(obj){
  _cache.stock=obj;
  const rows=Object.entries(obj).map(([product_name,quantity])=>({product_name,quantity,updated_at:new Date().toISOString()}));
  if(rows.length)await sbUps("stock",rows);
}
async function setStockOne(product_name,quantity){
  if(!_cache.stock)_cache.stock={};
  _cache.stock[product_name]=quantity;
  await sbUps("stock",[{product_name,quantity,updated_at:new Date().toISOString()}]);
}

// ── HISTORY ─────────────────────────────────────────────────────
async function getHistory(){
  if(_cache.history)return _cache.history;
  const rows=await sbQ("history","order=created_at.asc&limit=10000");
  if(!rows)return{};
  const obj={};
  rows.forEach(r=>{
    if(!obj[r.date])obj[r.date]=[];
    obj[r.date].push({cat:r.category,product:r.product_name,code:r.article_code,type:r.type,qty:r.quantity,balance:r.balance,salePrice:r.sale_price,note:r.note||"",time:r.time});
  });
  _cache.history=obj;return obj;
}
async function setHistory(obj){_cache.history=obj;}
async function addLogDirect(cat,product,code,type,qty,balance,salePrice,note,time,date){
  if(!_cache.history)_cache.history={};
  if(!_cache.history[date])_cache.history[date]=[];
  _cache.history[date].push({cat,product,code,type,qty,balance,salePrice:salePrice||null,note:note||"",time});
  await sbUps("history",[{date,time,category:cat,product_name:product,article_code:code,type,quantity:qty,balance,sale_price:salePrice||null,note:note||""}]);
}

// ── PRICING ─────────────────────────────────────────────────────
async function getPricing(){
  if(_cache.pricing)return _cache.pricing;
  const rows=await sbQ("pricing");
  if(!rows)return{};
  const obj={};
  rows.forEach(r=>obj[r.product_name]={mrp:r.mrp,discountPrice:r.discount_price,discountPct:r.discount_pct,note:r.note||"",updatedAt:r.updated_at});
  _cache.pricing=obj;return obj;
}
async function setPricing(obj){
  _cache.pricing=obj;
  const rows=Object.entries(obj).map(([product_name,p])=>({product_name,mrp:p.mrp,discount_price:p.discountPrice,discount_pct:p.discountPct,note:p.note||"",updated_at:new Date().toISOString()}));
  if(rows.length)await sbUps("pricing",rows);
}
async function setPricingOne(product_name,p){
  if(!_cache.pricing)_cache.pricing={};
  _cache.pricing[product_name]=p;
  await sbUps("pricing",[{product_name,mrp:p.mrp,discount_price:p.discountPrice,discount_pct:p.discountPct,note:p.note||"",updated_at:new Date().toISOString()}]);
}
async function deletePricingOne(product_name){
  if(_cache.pricing)delete _cache.pricing[product_name];
  await sbDel("pricing",`product_name=eq.${encodeURIComponent(product_name)}`);
}

// ── EXPIRY ──────────────────────────────────────────────────────
async function getExpiry(){
  if(_cache.expiry)return _cache.expiry;
  const rows=await sbQ("expiry","order=expiry_date.asc");
  if(!rows)return[];
  _cache.expiry=rows.map(r=>({id:r.id,cat:r.category,product:r.product_name,code:r.article_code,batch:r.batch_no||"",qty:r.quantity,originalQty:r.original_qty,expDate:r.expiry_date,status:r.status,addedOn:r.added_on,disposedOn:r.disposed_on||""}));
  return _cache.expiry;
}
async function setExpiry(arr){_cache.expiry=arr;}
async function addExpiryOne(e){
  _cache.expiry=null;
  return await sbUps("expiry",[{category:e.cat,product_name:e.product,article_code:e.code,batch_no:e.batch||"",quantity:e.qty,original_qty:e.originalQty,expiry_date:e.expDate,status:e.status,added_on:e.addedOn}]);
}
async function updateExpiryOne(id,updates){
  if(_cache.expiry){const idx=_cache.expiry.findIndex(e=>e.id===id);if(idx!==-1)Object.assign(_cache.expiry[idx],updates);}
  const dbU={};
  if(updates.qty!==undefined)dbU.quantity=updates.qty;
  if(updates.status!==undefined)dbU.status=updates.status;
  if(updates.disposedOn!==undefined)dbU.disposed_on=updates.disposedOn;
  await sbPatch("expiry",`id=eq.${id}`,dbU);
}
async function deleteExpiryOne(id){
  if(_cache.expiry)_cache.expiry=_cache.expiry.filter(e=>e.id!==id);
  await sbDel("expiry",`id=eq.${id}`);
}

// ── CATALOG ─────────────────────────────────────────────────────
async function getCatalogData(){
  if(_cache.catalog&&Object.keys(_cache.catalog).length>0)return _cache.catalog;
  const rows=await sbQ("catalog","order=category.asc,sort_order.asc");
  if(rows&&rows.length>0){
    const obj={};
    rows.forEach(r=>{if(!obj[r.category])obj[r.category]=[];obj[r.category].push({name:r.product_name,code:r.article_code||""})});
    _cache.catalog=obj;return obj;
  }
  // First run seed
  const seed={};
  for(const[cat,list]of Object.entries(PRODUCTS))seed[cat]=list.map(e=>({name:Array.isArray(e)?e[0]:e,code:Array.isArray(e)?e[1]:""}));
  await setCatalogData(seed);return seed;
}
async function setCatalogData(obj){
  _cache.catalog=obj;
  await sbDel("catalog","category=neq.___never___");
  const rows=[];
  for(const[category,items]of Object.entries(obj))items.forEach((p,i)=>rows.push({category,product_name:p.name,article_code:p.code||"",sort_order:i}));
  for(let i=0;i<rows.length;i+=100)await sbUps("catalog",rows.slice(i,i+100));
}

// ── BACKUP / RESTORE ─────────────────────────────────────────────
async function exportFullBackup(silent=false){
  const data={version:7,exportedAt:new Date().toISOString(),stock:await getStock(),history:await getHistory(),pricing:await getPricing(),settings:await getSettings(),expiry:await getExpiry(),catalog:await getCatalogData()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;const d=new Date();
  a.download=`tata_backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}.json`;
  a.click();URL.revokeObjectURL(url);
  const s=await getSettings();s.lastBackup=new Date().toISOString();await setSettings(s);
  if(!silent)showToast("✅ Backup downloaded!");
}

async function importBackup(jsonStr){
  try{
    const data=JSON.parse(jsonStr);if(!data||typeof data!=="object")return false;
    _cache={};
    if(data.settings){await setSettings({...DEF_SETTINGS,...data.settings});}
    if(data.catalog)await setCatalogData(data.catalog);
    if(data.stock){const rows=Object.entries(data.stock).map(([product_name,quantity])=>({product_name,quantity,updated_at:new Date().toISOString()}));if(rows.length)await sbUps("stock",rows);}
    if(data.pricing){const rows=Object.entries(data.pricing).map(([product_name,p])=>({product_name,mrp:p.mrp,discount_price:p.discountPrice,discount_pct:p.discountPct,note:p.note||"",updated_at:new Date().toISOString()}));if(rows.length)await sbUps("pricing",rows);}
    if(data.expiry&&data.expiry.length){
      await sbDel("expiry","id=gte.0");
      const rows=data.expiry.map(e=>({category:e.cat,product_name:e.product,article_code:e.code,batch_no:e.batch||"",quantity:e.qty,original_qty:e.originalQty,expiry_date:e.expDate,status:e.status,added_on:e.addedOn,disposed_on:e.disposedOn||null}));
      for(let i=0;i<rows.length;i+=100)await sbUps("expiry",rows.slice(i,i+100));
    }
    if(data.history){
      const allLogs=[];
      for(const[date,logs]of Object.entries(data.history))logs.forEach(l=>allLogs.push({date,time:l.time,category:l.cat,product_name:l.product,article_code:l.code,type:l.type,quantity:l.qty,balance:l.balance,sale_price:l.salePrice||null,note:l.note||""}));
      if(allLogs.length){await sbDel("history","id=gte.0");for(let i=0;i<allLogs.length;i+=100)await sbUps("history",allLogs.slice(i,i+100));}
    }
    return true;
  }catch(e){console.error("Import failed:",e);return false;}
}

// ── RESET ────────────────────────────────────────────────────────
async function resetTable(table){
  _cache[table]=null;
  const f={stock:"product_name=neq.___x___",history:"id=gte.0",pricing:"product_name=neq.___x___",expiry:"id=gte.0",settings:"key=neq.___x___",catalog:"category=neq.___x___"};
  if(f[table])await sbDel(table,f[table]);
}

// ── MISC ─────────────────────────────────────────────────────────
async function getStorageInfo(){return{idbInfo:"☁️ Supabase Cloud",lsInfo:"✅ Browser clear se safe"};}
async function runHealthCheck(){
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/settings?limit=1`,{headers:SB_H});
    const dot=document.getElementById("dataStatusDot");
    if(dot){dot.className="data-status-dot";dot.title="✅ Supabase connected";}
  }catch(e){
    const dot=document.getElementById("dataStatusDot");
    if(dot){dot.className="data-status-dot error";dot.title="❌ Connection error";}
  }
}
async function checkAutoExport(){
  const s=await getSettings();
  if(!s.lastBackup){showNagBanner("⚠️ Pehla backup abhi tak nahi hua!");return;}
  const days=Math.round((Date.now()-new Date(s.lastBackup).getTime())/864e5);
  if(days>=7)showNagBanner(`⚠️ ${days} din se backup nahi hua!`);
}
function showNagBanner(text){
  const b=document.getElementById("backupNagBanner");if(!b)return;
  b.style.display="block";
  b.innerHTML=`${text} <button onclick="exportFullBackup()" style="margin-left:12px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display='none'" style="margin-left:6px;padding:4px 10px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>`;
}
