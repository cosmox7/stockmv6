// ================================================================
// TATA STOCK MANAGER — LOCAL STORAGE ENGINE
// Dual: IndexedDB (primary) + localStorage (backup)
// Same GitHub Pages URL = data kabhi nahi jayega
// ================================================================

const DB_NAME = "TataStockDB_v3";
const STORE   = "data";
let _db = null;
let _mem = {};  // memory cache — fastest reads

// ── IndexedDB ──────────────────────────────────────────────────
async function dbOpen() {
  if (_db) return _db;
  return new Promise(res => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    r.onsuccess = e => { _db = e.target.result; res(_db); };
    r.onerror   = ()  => res(null);
  });
}
async function iGet(k) {
  try {
    const db = await dbOpen(); if (!db) return null;
    return new Promise(res => {
      const r = db.transaction(STORE).objectStore(STORE).get(k);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror   = () => res(null);
    });
  } catch { return null; }
}
async function iSet(k, v) {
  try {
    const db = await dbOpen(); if (!db) return;
    return new Promise(res => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(v, k);
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
  } catch {}
}
async function iDel(k) {
  try {
    const db = await dbOpen(); if (!db) return;
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(k);
  } catch {}
}

// ── localStorage backup ────────────────────────────────────────
const LP = "tsm_";
function lGet(k) { try { const v = localStorage.getItem(LP+k); return v ? JSON.parse(v) : null; } catch { return null; } }
function lSet(k, v) { try { localStorage.setItem(LP+k, JSON.stringify(v)); } catch(e) { try { pruneLS(); localStorage.setItem(LP+k, JSON.stringify(v)); } catch {} } }
function lDel(k) { try { localStorage.removeItem(LP+k); } catch {} }
function pruneLS() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(LP)).sort();
  keys.slice(0, Math.ceil(keys.length/2)).forEach(k => localStorage.removeItem(k));
}

// ── Universal get/set (memory → IDB → LS) ─────────────────────
async function dGet(k) {
  if (_mem[k] !== undefined) return _mem[k];
  const v = await iGet(k) ?? lGet(k);
  if (v !== null) { _mem[k] = v; if (!(await iGet(k))) await iSet(k, v); if (!lGet(k)) lSet(k, v); }
  return v;
}
async function dSet(k, v) {
  _mem[k] = v;
  lSet(k, v);
  await iSet(k, v);
  // Flash status dot green
  const dot = document.getElementById("dataStatusDot");
  if (dot) { dot.className = "data-status-dot saving"; setTimeout(() => dot.className = "data-status-dot", 800); }
}
async function dDel(k) { delete _mem[k]; lDel(k); await iDel(k); }
function clearMem() { _mem = {}; }

// ── Health check — sync IDB ↔ LS ──────────────────────────────
async function runHealthCheck() {
  const keys = ["stock","history","pricing","settings","expiry","catalog","admin","initDone"];
  for (const k of keys) {
    const idb = await iGet(k), ls = lGet(k);
    if (!idb && ls)  await iSet(k, ls);
    if (idb && !ls)  lSet(k, idb);
  }
}

// ── Defaults ───────────────────────────────────────────────────
const DEF = {
  storeName:"Tata Stock Manager", tagline:"", lowStockLevel:5,
  currency:"₹", defaultDiscount:0, bulkDiscount:0, bulkMinQty:5,
  maxDiscount:50, showDiscPct:"yes",
  expCriticalDays:7, expNearDays:30, showExpiryAlert:"yes",
  announcement:"", announcementType:"info",
  accentColor:"#e8a020", accentLight:"#f0c060",
  bgColor:"#0d0f14", bg2Color:"#14171f", bg3Color:"#1c2030",
  fontSize:"15px", fontFamily:"Rajdhani", borderRadius:"10px",
  tabStyle:"default", cardShadow:"normal", borderStyle:"normal", dashCols:"1",
  staffPin:"", staffModeActive:"no",
  staffPerms:{stock:true,sale:true,pricing:true,expiry:true,history:true},
  autoLock:0, lastBackup:"", appPassword:"1234", adminPin:"1234"
};

// ── Public API ─────────────────────────────────────────────────
async function getSettings() { const s = await dGet("settings"); return s ? {...DEF,...s} : {...DEF}; }
async function setSettings(s) { await dSet("settings", s); }

async function getAdminData() { const a = await dGet("admin"); return a || {pin:"1234"}; }
async function setAdminData(a) { await dSet("admin", a); }

async function getStock()    { return (await dGet("stock"))   || {}; }
async function setStock(s)   { await dSet("stock", s); }
async function setStockOne(name, qty) {
  const s = await getStock(); s[name] = qty; await dSet("stock", s);
}

async function getHistory()  { return (await dGet("history")) || {}; }
async function setHistory(h) { await dSet("history", h); }
async function addLogDirect(cat, prod, code, type, qty, bal, amt, note, time, date) {
  const h = await getHistory();
  if (!h[date]) h[date] = [];
  h[date].push({cat, product:prod, code, type, qty, balance:bal, salePrice:amt||null, note:note||"", time});
  await dSet("history", h);
}

async function getPricing()  { return (await dGet("pricing")) || {}; }
async function setPricing(p) { await dSet("pricing", p); }
async function setPricingOne(name, p) {
  const pr = await getPricing(); pr[name] = p; await dSet("pricing", pr);
}
async function deletePricingOne(name) {
  const pr = await getPricing(); delete pr[name]; await dSet("pricing", pr);
}

async function getExpiry()   { return (await dGet("expiry"))  || []; }
async function setExpiry(e)  { await dSet("expiry", e); }
async function addExpiryOne(entry) {
  const e = await getExpiry(); e.push(entry); await dSet("expiry", e);
}
async function updateExpiryOne(id, updates) {
  const e = await getExpiry();
  const idx = e.findIndex(x => x.id === id);
  if (idx !== -1) { Object.assign(e[idx], updates); await dSet("expiry", e); }
}
async function deleteExpiryOne(id) {
  await dSet("expiry", (await getExpiry()).filter(x => x.id !== id));
}

// ── Catalog — first run seed only ──────────────────────────────
async function getCatalogData() {
  const existing = await dGet("catalog");
  if (existing && Object.keys(existing).length > 0) return existing;
  const initDone = await dGet("initDone");
  if (initDone) {
    // Not first run but catalog gone — try recovery
    const ls = lGet("catalog");
    if (ls && Object.keys(ls).length > 0) { await dSet("catalog", ls); return ls; }
    return {}; // user must import backup
  }
  // First run — seed
  const seed = {};
  for (const [cat, list] of Object.entries(PRODUCTS))
    seed[cat] = list.map(e => ({name: Array.isArray(e)?e[0]:e, code: Array.isArray(e)?e[1]:""}));
  await dSet("catalog", seed);
  await dSet("initDone", true);
  return seed;
}
async function setCatalogData(c) { await dSet("catalog", c); }

// ── Backup / Restore ───────────────────────────────────────────
async function exportFullBackup(silent = false) {
  const data = {
    version:7, exportedAt: new Date().toISOString(),
    stock:    await getStock(),
    history:  await getHistory(),
    pricing:  await getPricing(),
    settings: await getSettings(),
    expiry:   await getExpiry(),
    catalog:  await getCatalogData()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const d    = new Date();
  a.href = url;
  a.download = `tata_backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}.json`;
  a.click(); URL.revokeObjectURL(url);
  const s = await getSettings(); s.lastBackup = new Date().toISOString(); await setSettings(s);
  if (!silent) showToast("✅ Backup downloaded!");
}

async function importBackup(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== "object") return false;
    clearMem();
    if (data.settings) await dSet("settings", {...DEF,...data.settings});
    if (data.stock)    await dSet("stock",    data.stock);
    if (data.history)  await dSet("history",  data.history);
    if (data.pricing)  await dSet("pricing",  data.pricing);
    if (data.expiry)   await dSet("expiry",   data.expiry);
    if (data.catalog)  await dSet("catalog",  data.catalog);
    await dSet("initDone", true);
    return true;
  } catch(e) { console.error("Import failed:", e); return false; }
}

// ── Reset ──────────────────────────────────────────────────────
async function resetTable(key) {
  delete _mem[key];
  const defaults = {stock:{}, history:{}, pricing:{}, expiry:[], catalog:{}};
  const val = defaults[key] !== undefined ? defaults[key] : null;
  if (val !== null) { lSet(key, val); await iSet(key, val); }
  else { lDel(key); await iDel(key); }
}

// ── Storage info ───────────────────────────────────────────────
async function getStorageInfo() {
  let idbInfo = "—", lsInfo = "—";
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      idbInfo = `${(e.usage/1024/1024).toFixed(2)} MB / ${(e.quota/1024/1024).toFixed(0)} MB`;
    }
  } catch {}
  try {
    let b = 0;
    for (const k of Object.keys(localStorage)) if (k.startsWith(LP)) b += (localStorage[k]||"").length*2;
    lsInfo = `${(b/1024).toFixed(1)} KB`;
  } catch {}
  return {idbInfo, lsInfo};
}

async function checkAutoExport() {
  const s = await getSettings();
  const nagEl = document.getElementById("backupNagBanner");
  if (!nagEl) return;
  if (!s.lastBackup) {
    nagEl.style.display="block";
    nagEl.innerHTML=`⚠️ Backup abhi tak nahi hua! <button onclick="exportFullBackup()" style="margin-left:10px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display='none'" style="margin-left:6px;padding:4px 8px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>`;
    return;
  }
  const days = Math.round((Date.now() - new Date(s.lastBackup).getTime()) / 864e5);
  if (days >= 7) {
    nagEl.style.display="block";
    nagEl.innerHTML=`⚠️ ${days} din se backup nahi hua! <button onclick="exportFullBackup()" style="margin-left:10px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display='none'" style="margin-left:6px;padding:4px 8px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>`;
  }
}
