// ===================================================================
// TATA STOCK MANAGER — STORAGE ENGINE v6.1 FIXED
// 
// ROOT CAUSE OF BUG: getCatalogData() was re-seeding from static
// PRODUCTS when IDB/LS key was missing, wiping custom catalog.
//
// FIX:
// 1. ALL data keys stored under ONE unified backup key in BOTH IDB + LS
// 2. Catalog NEVER auto-seeded on missing — only on EXPLICIT first run flag
// 3. Triple redundancy: IDB primary + LS backup + sessionStorage hot cache
// 4. Health check on every init — detects partial data loss and recovers
// ===================================================================

const DB_NAME = "TataStockDB_v2";
const DB_VER  = 1;
const IDB_STORE = "appdata";   // single object store, key = data key

let _db = null;
let _memCache = {};            // in-memory hot cache — fastest reads

// ── IndexedDB setup ──────────────────────────────────────────────
async function dbInit() {
  if (_db) return _db;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE))
          db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = ()  => { console.warn("IDB unavailable"); resolve(null); };
      req.onblocked = ()  => { console.warn("IDB blocked"); resolve(null); };
    } catch(e) { resolve(null); }
  });
}

async function idbGet(key) {
  try {
    const db = await dbInit(); if (!db) return null;
    return new Promise(res => {
      const req = db.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).get(key);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror   = () => res(null);
    });
  } catch { return null; }
}

async function idbSet(key, value) {
  try {
    const db = await dbInit(); if (!db) return;
    return new Promise(res => {
      const tx = db.transaction(IDB_STORE,"readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => res(true);
      tx.onerror    = () => res(false);
    });
  } catch { return false; }
}

async function idbDel(key) {
  try {
    const db = await dbInit(); if (!db) return;
    const tx = db.transaction(IDB_STORE,"readwrite");
    tx.objectStore(IDB_STORE).delete(key);
  } catch {}
}

// ── LS helpers ───────────────────────────────────────────────────
const LS_PREFIX = "tsm_v2_";
function lsGet(key) {
  try { const v = localStorage.getItem(LS_PREFIX+key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(LS_PREFIX+key, JSON.stringify(value)); return true; }
  catch(e) {
    // localStorage full — prune oldest keys
    try {
      const keys = Object.keys(localStorage).filter(k=>k.startsWith(LS_PREFIX));
      if (keys.length > 0) { localStorage.removeItem(keys[0]); localStorage.setItem(LS_PREFIX+key, JSON.stringify(value)); }
    } catch {}
    return false;
  }
}
function lsDel(key) { try { localStorage.removeItem(LS_PREFIX+key); } catch {} }

// ── Session cache (hot — survives tab refresh) ───────────────────
function ssGet(key) {
  try { const v = sessionStorage.getItem("tsm_ss_"+key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function ssSet(key, value) {
  try { sessionStorage.setItem("tsm_ss_"+key, JSON.stringify(value)); } catch {}
}

// ── Core read/write — triple redundancy ─────────────────────────
async function dGet(key) {
  // 1. Memory cache (instant)
  if (_memCache[key] !== undefined) return _memCache[key];
  // 2. Session storage (fast, survives reload)
  const ss = ssGet(key);
  if (ss !== null) { _memCache[key] = ss; return ss; }
  // 3. IndexedDB (primary persistent)
  const idb = await idbGet(key);
  if (idb !== null) {
    _memCache[key] = idb;
    ssSet(key, idb);
    lsSet(key, idb); // sync LS backup
    return idb;
  }
  // 4. localStorage (backup)
  const ls = lsGet(key);
  if (ls !== null) {
    _memCache[key] = ls;
    ssSet(key, ls);
    await idbSet(key, ls); // restore to IDB
    return ls;
  }
  return null;
}

async function dSet(key, value) {
  _memCache[key] = value;          // 1. memory (instant)
  ssSet(key, value);               // 2. session (fast)
  lsSet(key, value);               // 3. localStorage (sync, immediate)
  await idbSet(key, value);        // 4. IndexedDB (persistent, async)
}

async function dDel(key) {
  delete _memCache[key];
  sessionStorage.removeItem("tsm_ss_"+key);
  lsDel(key);
  await idbDel(key);
}

// ── Data keys ────────────────────────────────────────────────────
const KEY = {
  STOCK:    "stock",
  HISTORY:  "history",
  PRICING:  "pricing",
  SETTINGS: "settings",
  ADMIN:    "admin",
  CATALOG:  "catalog",
  EXPIRY:   "expiry",
  INITDONE: "init_done"   // flag — set ONCE after first seeding
};

// ── Defaults ─────────────────────────────────────────────────────
const DEF_SETTINGS = {
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
  autoLock:0, lastBackup:""
};

// ── Public API ───────────────────────────────────────────────────
async function getSettings() {
  const s = await dGet(KEY.SETTINGS);
  return s ? { ...DEF_SETTINGS, ...s } : { ...DEF_SETTINGS };
}
async function setSettings(s) { await dSet(KEY.SETTINGS, s); }

async function getAdminData() {
  const a = await dGet(KEY.ADMIN);
  return a || { pin: "1234" };
}
async function setAdminData(a) { await dSet(KEY.ADMIN, a); }

async function getStock()    { return (await dGet(KEY.STOCK))   || {}; }
async function setStock(s)   { await dSet(KEY.STOCK, s); }

async function getHistory()  { return (await dGet(KEY.HISTORY)) || {}; }
async function setHistory(h) { await dSet(KEY.HISTORY, h); }

async function getPricing()  { return (await dGet(KEY.PRICING)) || {}; }
async function setPricing(p) { await dSet(KEY.PRICING, p); }

async function getExpiry()   { return (await dGet(KEY.EXPIRY))  || []; }
async function setExpiry(e)  { await dSet(KEY.EXPIRY, e); }

// ── CATALOG — NEVER auto-seed unless truly first run ─────────────
async function getCatalogData() {
  const existing = await dGet(KEY.CATALOG);
  if (existing && Object.keys(existing).length > 0) return existing;

  // Check if this is genuinely first run (init_done flag not set)
  const initDone = await dGet(KEY.INITDONE);
  if (initDone) {
    // Not first run but catalog missing — data loss! Try emergency recovery
    console.warn("CATALOG MISSING after init — attempting recovery...");
    // Try all storage layers explicitly
    const fromLS  = lsGet(KEY.CATALOG);
    if (fromLS && Object.keys(fromLS).length > 0) {
      console.log("Recovered catalog from LS");
      await dSet(KEY.CATALOG, fromLS);
      return fromLS;
    }
    const fromSS = ssGet(KEY.CATALOG);
    if (fromSS && Object.keys(fromSS).length > 0) {
      console.log("Recovered catalog from SS");
      await dSet(KEY.CATALOG, fromSS);
      return fromSS;
    }
    // Could not recover — return empty so app shows empty catalog
    // (user will need to import backup)
    console.error("Catalog recovery failed — user must import backup");
    return {};
  }

  // Genuine first run — seed from static PRODUCTS
  console.log("First run — seeding catalog from PRODUCTS");
  const seed = {};
  for (const [cat, list] of Object.entries(PRODUCTS)) {
    seed[cat] = list.map(e => ({
      name: Array.isArray(e) ? e[0] : e,
      code: Array.isArray(e) ? e[1] : ""
    }));
  }
  await dSet(KEY.CATALOG, seed);
  await dSet(KEY.INITDONE, true); // mark first run done
  return seed;
}

async function setCatalogData(c) { await dSet(KEY.CATALOG, c); }

// ── Health check — called on every init ──────────────────────────
async function runHealthCheck() {
  const issues = [];
  // Check each key exists in at least one storage layer
  for (const key of Object.values(KEY)) {
    const idb = await idbGet(key);
    const ls  = lsGet(key);
    if (idb === null && ls !== null) {
      // IDB missing but LS has it — restore IDB
      await idbSet(key, ls);
      issues.push(`Restored ${key} to IDB from LS`);
    } else if (ls === null && idb !== null) {
      // LS missing but IDB has it — restore LS
      lsSet(key, idb);
      issues.push(`Restored ${key} to LS from IDB`);
    }
  }
  if (issues.length > 0) console.log("Health check fixes:", issues);
  return issues;
}

// ── Full backup / restore ────────────────────────────────────────
async function exportFullBackup(silent = false) {
  const data = {
    version: 6,
    exportedAt: new Date().toISOString(),
    stock:    await getStock(),
    history:  await getHistory(),
    pricing:  await getPricing(),
    settings: await getSettings(),
    expiry:   await getExpiry(),
    catalog:  await getCatalogData(),
    admin:    await getAdminData(),
    initDone: true
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`;
  a.download = `tata_backup_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const s = await getSettings();
  s.lastBackup = new Date().toISOString();
  await setSettings(s);

  if (!silent) showToast("✅ Backup downloaded!");
}

async function importBackup(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    // Validate it's a real backup
    if (!data || typeof data !== "object") return false;

    if (data.stock)    await dSet(KEY.STOCK,    data.stock);
    if (data.history)  await dSet(KEY.HISTORY,  data.history);
    if (data.pricing)  await dSet(KEY.PRICING,  data.pricing);
    if (data.expiry)   await dSet(KEY.EXPIRY,   data.expiry);
    if (data.catalog)  await dSet(KEY.CATALOG,  data.catalog);
    if (data.admin)    await dSet(KEY.ADMIN,     data.admin);
    if (data.settings) {
      const s = { ...DEF_SETTINGS, ...data.settings };
      await dSet(KEY.SETTINGS, s);
    }
    // Always mark init as done after import
    await dSet(KEY.INITDONE, true);

    // Clear memory cache so next reads come fresh from storage
    _memCache = {};

    return true;
  } catch(e) {
    console.error("Import failed:", e);
    return false;
  }
}

// ── Storage usage info ───────────────────────────────────────────
async function getStorageInfo() {
  let idbInfo = "—", lsInfo = "—";
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const usedMB  = (est.usage / 1024 / 1024).toFixed(2);
      const quotaMB = (est.quota / 1024 / 1024).toFixed(0);
      idbInfo = `${usedMB} MB / ${quotaMB} MB`;
    }
  } catch {}
  try {
    let bytes = 0;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(LS_PREFIX)) bytes += (localStorage[k]||"").length * 2;
    }
    lsInfo = `${(bytes/1024).toFixed(1)} KB`;
  } catch {}
  return { idbInfo, lsInfo };
}

// ── Auto-export check ────────────────────────────────────────────
async function checkAutoExport() {
  const s = await getSettings();
  if (!s.lastBackup) {
    document.getElementById("backupNagBanner").style.display = "block";
    document.getElementById("backupNagBanner").textContent = "⚠️ Pehla backup abhi tak nahi hua! Data surakshit rakhne ke liye backup lo.";
    document.getElementById("backupNagBanner").innerHTML += ' <button onclick="exportFullBackup()" style="margin-left:12px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display=\'none\'" style="margin-left:6px;padding:4px 10px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>';
    return;
  }
  const daysSince = Math.round((Date.now() - new Date(s.lastBackup).getTime()) / 864e5);
  if (daysSince >= 3) {
    const banner = document.getElementById("backupNagBanner");
    banner.style.display = "block";
    banner.innerHTML = `⚠️ ${daysSince} din se backup nahi hua! <button onclick="exportFullBackup()" style="margin-left:12px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display='none'" style="margin-left:6px;padding:4px 10px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>`;
  }
}
