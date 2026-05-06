// ================================================================
// TATA STOCK MANAGER — FIREBASE STORAGE ENGINE v8
// Cloud: Firestore + Firebase Auth
// GitHub Pages compatible — Data browser clear se safe!
// ================================================================

let _currentUser = null;
let _userDocRef = null;

// ── Auth State Listener ────────────────────────────────────────
auth.onAuthStateChanged(user => {
  _currentUser = user;
  if (user) {
    _userDocRef = db.collection("users").doc(user.uid);
    console.log("Logged in:", user.email);
    // Auto-init app after auth
    if (typeof init === 'function') {
      setTimeout(init, 100);
    }
  } else {
    _userDocRef = null;
    console.log("Not logged in");
    showLoginScreen();
  }
});

// ── Auth Functions ─────────────────────────────────────────────
async function signUp(email, password, storeName) {
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    _currentUser = cred.user;
    _userDocRef = db.collection("users").doc(cred.user.uid);

    // Create user document with defaults
    const defaults = {
      storeName: storeName || "Tata Stock Manager",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      email: email,
      stock: {},
      history: {},
      pricing: {},
      expiry: [],
      catalog: null,
      settings: getDefaultSettings()
    };

    await _userDocRef.set(defaults);
    return { success: true, user: cred.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function signIn(email, password) {
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, user: cred.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function signOut() {
  await auth.signOut();
  _currentUser = null;
  _userDocRef = null;
  showLoginScreen();
}

function getCurrentUser() {
  return _currentUser;
}

function isLoggedIn() {
  return !!_currentUser;
}

// ── Firestore Helpers ──────────────────────────────────────────
async function fsGet(key) {
  if (!_userDocRef) return null;
  try {
    const doc = await _userDocRef.get();
    if (!doc.exists) return null;
    const data = doc.data();
    return data[key] !== undefined ? data[key] : null;
  } catch (e) {
    console.error("fsGet error:", e);
    return null;
  }
}

async function fsSet(key, value) {
  if (!_userDocRef) return;
  try {
    await _userDocRef.update({ [key]: value });
    // Flash status dot
    const dot = document.getElementById("dataStatusDot");
    if (dot) { 
      dot.className = "data-status-dot saving"; 
      setTimeout(() => dot.className = "data-status-dot", 800); 
    }
  } catch (e) {
    console.error("fsSet error:", e);
  }
}

// ── Default Settings ───────────────────────────────────────────
function getDefaultSettings() {
  return {
    storeName: "Tata Stock Manager",
    tagline: "",
    lowStockLevel: 5,
    currency: "₹",
    defaultDiscount: 0,
    bulkDiscount: 0,
    bulkMinQty: 5,
    maxDiscount: 50,
    showDiscPct: "yes",
    expCriticalDays: 7,
    expNearDays: 30,
    showExpiryAlert: "yes",
    announcement: "",
    announcementType: "info",
    accentColor: "#e8a020",
    accentLight: "#f0c060",
    bgColor: "#0d0f14",
    bg2Color: "#14171f",
    bg3Color: "#1c2030",
    fontSize: "15px",
    fontFamily: "Rajdhani",
    borderRadius: "10px",
    tabStyle: "default",
    cardShadow: "normal",
    borderStyle: "normal",
    dashCols: "1",
    staffPin: "",
    staffModeActive: "no",
    staffPerms: { stock: true, sale: true, pricing: true, expiry: true, history: true },
    autoLock: 0,
    lastBackup: "",
    appPassword: "",
    adminPin: "1234"
  };
}

// ── Public API (same as before, but Firestore backed) ──────────
async function getSettings() {
  const s = await fsGet("settings");
  return s ? { ...getDefaultSettings(), ...s } : { ...getDefaultSettings() };
}

async function setSettings(s) {
  await fsSet("settings", s);
}

async function getAdminData() {
  const s = await getSettings();
  return { pin: s.adminPin || "1234" };
}

async function setAdminData(a) {
  const s = await getSettings();
  s.adminPin = a.pin;
  await setSettings(s);
}

async function getStock() {
  return (await fsGet("stock")) || {};
}

async function setStock(s) {
  await fsSet("stock", s);
}

async function setStockOne(name, qty) {
  const s = await getStock();
  s[name] = qty;
  await fsSet("stock", s);
}

async function getHistory() {
  return (await fsGet("history")) || {};
}

async function setHistory(h) {
  await fsSet("history", h);
}

async function addLogDirect(cat, prod, code, type, qty, bal, amt, note, time, date) {
  const h = await getHistory();
  if (!h[date]) h[date] = [];
  h[date].push({
    cat, product: prod, code, type, qty,
    balance: bal, salePrice: amt || null,
    note: note || "", time
  });
  await fsSet("history", h);
}

async function getPricing() {
  return (await fsGet("pricing")) || {};
}

async function setPricing(p) {
  await fsSet("pricing", p);
}

async function setPricingOne(name, p) {
  const pr = await getPricing();
  pr[name] = p;
  await fsSet("pricing", pr);
}

async function deletePricingOne(name) {
  const pr = await getPricing();
  delete pr[name];
  await fsSet("pricing", pr);
}

async function getExpiry() {
  return (await fsGet("expiry")) || [];
}

async function setExpiry(e) {
  await fsSet("expiry", e);
}

async function addExpiryOne(entry) {
  const e = await getExpiry();
  e.push(entry);
  await fsSet("expiry", e);
}

async function updateExpiryOne(id, updates) {
  const e = await getExpiry();
  const idx = e.findIndex(x => x.id === id);
  if (idx !== -1) {
    Object.assign(e[idx], updates);
    await fsSet("expiry", e);
  }
}

async function deleteExpiryOne(id) {
  await fsSet("expiry", (await getExpiry()).filter(x => x.id !== id));
}

// ── Catalog ────────────────────────────────────────────────────
async function getCatalogData() {
  const existing = await fsGet("catalog");
  if (existing && Object.keys(existing).length > 0) return existing;

  // First run — seed from PRODUCTS
  const seed = {};
  for (const [cat, list] of Object.entries(PRODUCTS)) {
    seed[cat] = list.map(e => ({
      name: Array.isArray(e) ? e[0] : e,
      code: Array.isArray(e) ? e[1] : ""
    }));
  }
  await fsSet("catalog", seed);
  return seed;
}

async function setCatalogData(c) {
  await fsSet("catalog", c);
}

// ── Backup / Restore (JSON file) ─────────────────────────────
async function exportFullBackup(silent = false) {
  const data = {
    version: 8,
    exportedAt: new Date().toISOString(),
    userEmail: _currentUser?.email || "unknown",
    stock: await getStock(),
    history: await getHistory(),
    pricing: await getPricing(),
    settings: await getSettings(),
    expiry: await getExpiry(),
    catalog: await getCatalogData()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `tata_backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}.json`;
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
    if (!data || typeof data !== "object") return false;

    if (data.settings) await fsSet("settings", { ...getDefaultSettings(), ...data.settings });
    if (data.stock) await fsSet("stock", data.stock);
    if (data.history) await fsSet("history", data.history);
    if (data.pricing) await fsSet("pricing", data.pricing);
    if (data.expiry) await fsSet("expiry", data.expiry);
    if (data.catalog) await fsSet("catalog", data.catalog);

    return true;
  } catch (e) {
    console.error("Import failed:", e);
    return false;
  }
}

// ── Reset ─────────────────────────────────────────────────────
async function resetTable(key) {
  const defaults = {
    stock: {},
    history: {},
    pricing: {},
    expiry: [],
    catalog: {}
  };
  const val = defaults[key] !== undefined ? defaults[key] : null;
  if (val !== null) await fsSet(key, val);
}

// ── Storage info (mock for Firebase) ──────────────────────────
async function getStorageInfo() {
  return {
    idbInfo: "Cloud (Firestore)",
    lsInfo: "Authenticated"
  };
}

async function checkAutoExport() {
  const s = await getSettings();
  const nagEl = document.getElementById("backupNagBanner");
  if (!nagEl) return;

  if (!s.lastBackup) {
    nagEl.style.display = "block";
    nagEl.innerHTML = `⚠️ Backup abhi tak nahi hua! <button onclick="exportFullBackup()" style="margin-left:10px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display='none'" style="margin-left:6px;padding:4px 8px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>`;
    return;
  }

  const days = Math.round((Date.now() - new Date(s.lastBackup).getTime()) / 864e5);
  if (days >= 7) {
    nagEl.style.display = "block";
    nagEl.innerHTML = `⚠️ ${days} din se backup nahi hua! <button onclick="exportFullBackup()" style="margin-left:10px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Backup Now</button> <button onclick="this.parentElement.style.display='none'" style="margin-left:6px;padding:4px 8px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">Later</button>`;
  }
}

async function runHealthCheck() {
  // Firestore mein health check ki zaroorat nahi — cloud reliable hai
  return true;
}
