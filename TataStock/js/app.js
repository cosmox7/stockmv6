// ================================================================
// TATA STOCK MANAGER — APP.JS v7 (GitHub Pages Edition)
// ================================================================

let _catalog = {};

// ── Utils ────────────────────────────────────────────────────────
function today(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function fmtD(d){if(!d)return"";const[y,m,day]=d.split("-");return`${day}/${m}/${y}`}
function cur(){return window._curSym||"₹"}
function fmt(n){return cur()+parseFloat(n).toFixed(2)}
function pn(e){return Array.isArray(e)?e[0]:e}
function pc(e){return Array.isArray(e)?e[1]:"—"}
function codeOf(name){for(const l of Object.values(_catalog))for(const p of l)if(p.name===name)return p.code||"—";return"—"}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
function showToast(msg,err=false){const t=document.getElementById("toast");t.textContent=msg;t.className="toast show"+(err?" error":"");clearTimeout(t._t);t._t=setTimeout(()=>t.className="toast",2800)}
function showMsg(id,txt,err){const el=document.getElementById(id);if(!el)return;el.textContent=txt;el.className="msg-box "+(err?"err":"ok")}
function dlFile(content,fn,type){const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=fn;a.click();URL.revokeObjectURL(u)}
function setLoading(txt){const o=document.getElementById("loadingOverlay"),lt=document.getElementById("loadingText");if(o)o.style.display=txt?"flex":"none";if(lt&&txt)lt.textContent=txt}

async function addLog(cat,prod,type,qty,bal,amt,note){
  const d=today(),time=new Date().toLocaleTimeString("hi-IN",{hour:"2-digit",minute:"2-digit"});
  await addLogDirect(cat,prod,codeOf(prod),type,qty,bal,amt,note,time,d);
}

// ── APP LOCK ─────────────────────────────────────────────────────
const SESS_KEY="tsm_unlocked";

async function doUnlock(){
  const input=document.getElementById("appLockInput"),msgEl=document.getElementById("appLockMsg"),val=input.value;
  if(!val){msgEl.textContent="Password daalo";msgEl.style.color="var(--red)";return}
  msgEl.textContent="Checking...";msgEl.style.color="var(--muted)";
  try{
    const s=await getSettings();
    const correct=s.appPassword||"1234";
    if(val===correct){
      msgEl.textContent="✅ Access granted!";msgEl.style.color="var(--green)";
      sessionStorage.setItem(SESS_KEY,"yes");
      setTimeout(async()=>{document.getElementById("appLockScreen").style.display="none";await appStart();},300);
    }else{
      msgEl.textContent="❌ Galat password!";msgEl.style.color="var(--red)";
      input.classList.add("shake");
      setTimeout(()=>{input.value="";input.classList.remove("shake");msgEl.textContent="";input.focus();},1200);
    }
  }catch(e){
    // fallback to default
    if(val==="1234"){
      sessionStorage.setItem(SESS_KEY,"yes");
      document.getElementById("appLockScreen").style.display="none";
      await appStart();
    }else{
      msgEl.textContent="❌ Galat password!";msgEl.style.color="var(--red)";
      setTimeout(()=>{input.value="";msgEl.textContent="";input.focus();},1200);
    }
  }
}

// ── INIT ─────────────────────────────────────────────────────────
async function init(){
  if(sessionStorage.getItem(SESS_KEY)==="yes"){
    document.getElementById("appLockScreen").style.display="none";
    await appStart();
  }else{
    document.getElementById("appLockScreen").style.display="flex";
    setTimeout(()=>document.getElementById("appLockInput").focus(),200);
  }
}

async function appStart(){
  setLoading("Loading data...");
  try{
    await runHealthCheck();
    const cat=await getCatalogData();
    _catalog=cat;
    if(!cat||Object.keys(cat).length===0){
      document.getElementById("backupNagBanner").style.display="block";
      document.getElementById("backupNagBanner").innerHTML=`🚨 Catalog missing! Backup import karo. <button onclick="document.getElementById('importFile').click()" style="margin-left:10px;padding:4px 12px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700">Import Backup</button>`;
    }
    rebuildPROD();
    const s=await getSettings();
    window._curSym=s.currency||"₹";
    applyThemeFromSettings(s);
    const tEl=document.getElementById("todayDate");if(tEl)tEl.textContent=fmtD(today());
    if(s.storeName){document.title=s.storeName;const el=document.getElementById("appLogoText");if(el)el.innerHTML=esc(s.storeName);}
    const rf=document.getElementById("reportFrom"),rt=document.getElementById("reportTo");
    if(rf)rf.value=today();if(rt)rt.value=today();
    document.getElementById("historyDate").value=today();
    await refreshDrops();
    await Promise.all([renderDash(),renderHist(),renderWeek()]);
    checkStaff(s);
    await checkAutoExport();
  }catch(e){console.error("appStart error:",e);showToast("Load error — refresh karo",true);}
  finally{setLoading(null);}
}

function rebuildPROD(){
  for(const k of Object.keys(PRODUCTS))delete PRODUCTS[k];
  for(const[cat,items]of Object.entries(_catalog))PRODUCTS[cat]=items.map(p=>[p.name,p.code||"—"]);
}

async function refreshDrops(){
  const cats=Object.keys(PRODUCTS);
  ["dashCatFilter","stockCat","saleCat","historyCat","priceCat","expCat","expFilterCat","bulkPriceCat","resetPriceCat","pricingCatFilter"].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;while(el.options.length>1)el.remove(1);
    cats.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;el.appendChild(o)});
    if(cats.includes(cur))el.value=cur;
  });
}

function checkStaff(s){
  const at=document.querySelector(".admin-tab");
  if(at)at.style.display=s.staffModeActive==="yes"&&s.staffPin?"none":"";
}

// ── THEME ────────────────────────────────────────────────────────
function applyThemeFromSettings(s){
  const r=document.documentElement.style;
  if(s.accentColor)r.setProperty("--accent",s.accentColor);
  if(s.accentLight)r.setProperty("--accent2",s.accentLight);
  if(s.bgColor)r.setProperty("--bg",s.bgColor);
  if(s.bg2Color)r.setProperty("--bg2",s.bg2Color);
  if(s.bg3Color)r.setProperty("--bg3",s.bg3Color);
  if(s.fontSize)document.body.style.fontSize=s.fontSize;
  if(s.fontFamily)document.body.style.fontFamily=s.fontFamily+",sans-serif";
  if(s.borderRadius)r.setProperty("--radius",s.borderRadius);
  const sh=s.cardShadow==="none"?"none":s.cardShadow==="strong"?"0 8px 40px rgba(0,0,0,0.8)":"0 4px 20px rgba(0,0,0,0.5)";
  r.setProperty("--shadow",sh);
  applyTabStyleDirect(s.tabStyle||"default");
}
function applyTabStyleDirect(v){const nav=document.querySelector(".tab-nav");if(!nav)return;nav.className="tab-nav";if(v==="compact")nav.classList.add("tab-nav-compact");if(v==="icons")nav.classList.add("tab-nav-icons");}

async function setAccent(btn){
  const color=btn.dataset.c,light=btn.dataset.l;
  document.documentElement.style.setProperty("--accent",color);
  document.documentElement.style.setProperty("--accent2",light);
  const s=await getSettings();s.accentColor=color;s.accentLight=light;await setSettings(s);
  document.querySelectorAll(".tswatch").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
  const cp=document.getElementById("customAccentPicker");if(cp)cp.value=color;
  const ch=document.getElementById("customAccentHex");if(ch)ch.value=color;
  showMsg("adminThemeMsg","✅ Color applied!",false);showToast("Theme updated");
}
async function applyCustomAccent(){
  const hex=document.getElementById("customAccentHex").value.trim();
  if(!/^#[0-9a-fA-F]{6}$/.test(hex)){showMsg("adminThemeMsg","Invalid hex",true);return}
  document.documentElement.style.setProperty("--accent",hex);document.documentElement.style.setProperty("--accent2",hex+"cc");
  const s=await getSettings();s.accentColor=hex;s.accentLight=hex+"cc";await setSettings(s);
  showMsg("adminThemeMsg","✅ Applied!",false);
}
async function setBg(bg,bg2,bg3){
  const r=document.documentElement.style;r.setProperty("--bg",bg);r.setProperty("--bg2",bg2);r.setProperty("--bg3",bg3);
  const s=await getSettings();s.bgColor=bg;s.bg2Color=bg2;s.bg3Color=bg3;await setSettings(s);
  showMsg("adminThemeMsg","✅ Background updated!",false);showToast("Background changed");
}
async function applyCustomBg(){const hex=document.getElementById("customBgPicker").value;await setBg(hex,hex+"ee",hex+"dd");}
async function setFontSize(btn,size){
  document.body.style.fontSize=size;const s=await getSettings();s.fontSize=size;await setSettings(s);
  document.querySelectorAll("#fontSizeBtns .grp-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
  showMsg("adminThemeMsg","✅ Font size updated!",false);
}
async function setRadius(btn,r){
  document.documentElement.style.setProperty("--radius",r);const s=await getSettings();s.borderRadius=r;await setSettings(s);
  document.querySelectorAll(".grp-btn[onclick*='setRadius']").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
  showMsg("adminThemeMsg","✅ Radius updated!",false);
}
async function applyTabStyle(){
  const val=document.getElementById("adminTabStyle").value;applyTabStyleDirect(val);
  const s=await getSettings();s.tabStyle=val;await setSettings(s);showMsg("adminThemeMsg","✅ Tab style updated!",false);
}
async function resetTheme(){
  const s=await getSettings();
  Object.assign(s,{accentColor:"#e8a020",accentLight:"#f0c060",bgColor:"#0d0f14",bg2Color:"#14171f",bg3Color:"#1c2030",fontSize:"15px",fontFamily:"Rajdhani",borderRadius:"10px",tabStyle:"default",cardShadow:"normal"});
  await setSettings(s);applyThemeFromSettings(s);showMsg("adminThemeMsg","✅ Theme reset!",false);showToast("Theme reset");
}

// ── TABS ─────────────────────────────────────────────────────────
function showTab(name,btn){
  document.querySelectorAll(".tab-section").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("tab-"+name).classList.add("active");
  if(btn)btn.classList.add("active");
  if(name==="dashboard")renderDash();
  if(name==="history"){renderHist();renderWeek();}
  if(name==="pricing")renderPricingTable();
  if(name==="expiry"){renderExpSummary();renderExpList();}
  if(name==="admin"){loadAdminForms();renderCatList();renderBackupStatus();renderStorageInfo();renderLowStockReport();renderStockHealth();renderRevDashboard();renderTopProds();renderAdminStats();renderCatBreakdown();}
  if(name==="sale")renderRecentSales();
}
function showATab(name,btn){
  document.querySelectorAll(".admin-stab-content").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".admin-stab").forEach(b=>b.classList.remove("active"));
  document.getElementById("astab-"+name).classList.add("active");if(btn)btn.classList.add("active");
  if(name==="alerts"){renderLowStockReport();renderStockHealth();}
  if(name==="reports"){renderRevDashboard();renderTopProds();}
  if(name==="stats"){renderAdminStats();renderCatBreakdown();}
  if(name==="catalog")renderCatList();
  if(name==="data"){renderBackupStatus();renderStorageInfo();}
}

// ── PRODUCT SELECTS ──────────────────────────────────────────────
function popSel(catId,prodId){const cat=document.getElementById(catId).value,sel=document.getElementById(prodId);while(sel.options.length>1)sel.remove(1);if(!cat||!PRODUCTS[cat])return;PRODUCTS[cat].forEach(e=>{const n=pn(e),c=pc(e),o=document.createElement("option");o.value=n;o.textContent=c&&c!=="—"?`[${c}] ${n}`:n;sel.appendChild(o)});}
function filterStockProd(){popSel("stockCat","stockProduct");showCurStock();}
function filterSaleProd(){popSel("saleCat","saleProduct");showSaleInfo();}
function filterPriceProd(){popSel("priceCat","priceProduct");document.getElementById("pricingBox").style.display="none";document.getElementById("priceCodeBadge").style.display="none";}
function filterExpProd(){popSel("expCat","expProduct");showCodeBadge("expCodeBadge","");}
function loadResetProds(){popSel("resetPriceCat","resetPriceProd");}

// ── COPY CODE ────────────────────────────────────────────────────
function copyCode(code,btn){
  if(!code||code==="—")return;
  const done=()=>{const o=btn.textContent;btn.textContent="✅";btn.classList.add("copy-btn-done");setTimeout(()=>{btn.textContent=o;btn.classList.remove("copy-btn-done");},1500);showToast(`Copied: ${code}`);};
  if(navigator.clipboard){navigator.clipboard.writeText(code).then(done).catch(()=>{fallbackCopy(code);done();});}
  else{fallbackCopy(code);done();}
}
function fallbackCopy(text){const el=document.createElement("textarea");el.value=text;el.style.cssText="position:fixed;opacity:0";document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);}

function showCodeBadge(elId,code){
  const el=document.getElementById(elId);if(!el)return;
  if(!code||code==="—"){el.style.display="none";return;}
  el.style.display="flex";
  el.innerHTML=`<span class="badge-code-label">Article Code:</span><span class="badge-code-val">${code}</span><button class="copy-btn always-visible" onclick="copyCode('${code}',this)" title="Copy">📋</button>`;
}

// ── STOCK ────────────────────────────────────────────────────────
async function showCurStock(){
  const prod=document.getElementById("stockProduct").value,prev=document.getElementById("currentStockPreview");
  if(!prod){prev.style.display="none";return;}
  const st=await getStock(),qty=st[prod],code=codeOf(prod);
  prev.style.display="flex";
  const codeHtml=code&&code!=="—"?`<span class="dpc-code-wrap"><span class="dpc-code">${code}</span><button class="copy-btn always-visible" onclick="copyCode('${code}',this)">📋</button></span>`:"";
  prev.innerHTML=`${codeHtml}<span class="cs-label">Stock:</span><span class="cs-qty${qty===undefined?" cs-na":""}">${qty!==undefined?qty+" units":"Not Set"}</span>`;
}
function addQ(n){const i=document.getElementById("stockQty");i.value=(parseInt(i.value)||0)+n;}

async function submitStock(){
  const cat=document.getElementById("stockCat").value,prod=document.getElementById("stockProduct").value,qty=parseInt(document.getElementById("stockQty").value),act=document.getElementById("stockAction").value,note=document.getElementById("stockNote").value;
  if(!cat||!prod){showMsg("stockMsg","Category aur Product select karo",true);return;}
  if(isNaN(qty)||qty<0){showMsg("stockMsg","Valid quantity daalo",true);return;}
  const s=await getStock(),old=s[prod]||0;
  let nq=act==="set"?qty:act==="add"?old+qty:Math.max(0,old-qty);
  const type=act==="set"?"Opening Stock":act==="add"?"Stock Added":"Stock Removed";
  await setStockOne(prod,nq);
  await addLog(cat,prod,type,qty,nq,null,note);
  showMsg("stockMsg",`✅ [${codeOf(prod)}] ${prod} — Stock: ${nq} units`,false);
  showToast(`${prod} → ${nq} units`);
  await renderDash();showCurStock();
  document.getElementById("stockQty").value="";document.getElementById("stockNote").value="";
}

// ── SALE ─────────────────────────────────────────────────────────
async function showSaleInfo(){
  const prod=document.getElementById("saleProduct").value,card=document.getElementById("salePriceCard"),warn=document.getElementById("saleExpiryWarn");
  document.getElementById("saleTotalRow").style.display="none";
  if(!prod){card.style.display="none";warn.style.display="none";showCodeBadge("saleCodeBadge","");return;}
  showCodeBadge("saleCodeBadge",codeOf(prod));
  const s=await getSettings(),exp=(await getExpiry()).filter(e=>e.product===prod&&e.status==="active");
  if(exp.length>0){
    const sn=exp.sort((a,b)=>new Date(a.expDate)-new Date(b.expDate))[0],days=Math.round((new Date(sn.expDate)-new Date())/864e5);
    if(days<=(s.expNearDays||30)){warn.style.display="block";warn.innerHTML=days<0?`⚠️ Batch <strong>EXPIRED</strong> hai!`:`⏰ FIFO: Batch <strong>${days} din</strong> mein expire (${fmtD(sn.expDate)})`;warn.className="sale-exp-warn "+(days<=7?"warn-critical":"warn-near");}
    else warn.style.display="none";
  }else warn.style.display="none";
  const pr=(await getPricing())[prod];if(!pr||(!pr.mrp&&!pr.discountPrice)){card.style.display="none";return;}
  card.style.display="block";
  document.getElementById("salePreviewMrp").textContent=pr.mrp?fmt(pr.mrp):"—";
  document.getElementById("salePreviewDisc").textContent=(pr.discountPrice&&pr.mrp)?`${(((pr.mrp-pr.discountPrice)/pr.mrp)*100).toFixed(1)}% off`:"—";
  document.getElementById("salePreviewFinal").textContent=pr.discountPrice?fmt(pr.discountPrice):(pr.mrp?fmt(pr.mrp):"—");
  updateTotal();
}
async function updateTotal(){
  const prod=document.getElementById("saleProduct").value,qty=parseInt(document.getElementById("saleQty").value)||0,tr=document.getElementById("saleTotalRow");
  if(!prod||qty<1){tr.style.display="none";return;}
  const pr=(await getPricing())[prod];if(!pr){tr.style.display="none";return;}
  const price=pr.discountPrice||pr.mrp;if(!price){tr.style.display="none";return;}
  const s=await getSettings(),bmq=parseInt(s.bulkMinQty)||5;
  let total=price*qty,lbl=fmt(total);
  if(s.bulkDiscount>0&&qty>=bmq){total*=(1-s.bulkDiscount/100);lbl=`${fmt(total)} (${s.bulkDiscount}% bulk)`;}
  document.getElementById("saleTotalAmt").textContent=lbl;tr.style.display="flex";
}
async function submitSale(){
  const cat=document.getElementById("saleCat").value,prod=document.getElementById("saleProduct").value,qty=parseInt(document.getElementById("saleQty").value),note=document.getElementById("saleNote").value;
  if(!cat||!prod){showMsg("saleMsg","Category aur Product select karo",true);return;}
  if(isNaN(qty)||qty<1){showMsg("saleMsg","Valid quantity daalo",true);return;}
  const s=await getStock(),cur=s[prod]||0;
  if(qty>cur){showMsg("saleMsg",`Stock kam hai! Current: ${cur} units`,true);return;}
  const nq=cur-qty;await setStockOne(prod,nq);
  const pr=(await getPricing())[prod],price=pr?(pr.discountPrice||pr.mrp):null;
  const settings=await getSettings(),bmq=parseInt(settings.bulkMinQty)||5;
  let fp=price;if(price&&settings.bulkDiscount>0&&qty>=bmq)fp=price*(1-settings.bulkDiscount/100);
  await addLog(cat,prod,"Sale",qty,nq,fp?fp*qty:null,note);
  showMsg("saleMsg",`✅ ${qty} units sold. Remaining: ${nq}`+(fp?` | Total: ${fmt(fp*qty)}`:""),false);
  showToast(`Sold ${qty} × ${prod}`);await renderDash();renderRecentSales();
  document.getElementById("saleQty").value="";document.getElementById("saleTotalRow").style.display="none";document.getElementById("saleNote").value="";
}
async function renderRecentSales(){
  const wrap=document.getElementById("recentSalesWrap");if(!wrap)return;
  const logs=((await getHistory())[today()]||[]).filter(l=>l.type==="Sale").slice(-5).reverse();
  if(!logs.length){wrap.innerHTML="";return;}
  let h=`<div class="cat-block"><div class="cat-title">Aaj ki Recent Sales</div><div style="overflow-x:auto"><table class="stock-table full"><thead><tr><th>Time</th><th>Product</th><th>Qty</th><th>Amount</th></tr></thead><tbody>`;
  logs.forEach(l=>{h+=`<tr><td>${l.time}</td><td class="p-name">${l.product}</td><td>${l.qty}</td><td style="color:var(--green);font-weight:700">${l.salePrice?fmt(l.salePrice):"—"}</td></tr>`;});
  h+=`</tbody></table></div></div>`;wrap.innerHTML=h;
}

// ── DASHBOARD ────────────────────────────────────────────────────
async function renderDash(){
  const[st,pricing,s]=await Promise.all([getStock(),getPricing(),getSettings()]);
  const low=s.lowStockLevel||5,all=Object.values(PRODUCTS).flat().map(e=>pn(e));
  const todayLogs=((await getHistory())[today()]||[]).filter(l=>l.type==="Sale"&&l.salePrice),ts=todayLogs.reduce((a,l)=>a+l.salePrice,0);
  const el=document.getElementById("dashSummaryCards");
  if(el)el.innerHTML=`<div class="sum-card"><div class="sum-val">${all.length}</div><div class="sum-label">Products</div></div><div class="sum-card sum-green"><div class="sum-val">${all.filter(p=>st[p]>0).length}</div><div class="sum-label">In Stock</div></div><div class="sum-card sum-red"><div class="sum-val">${all.filter(p=>st[p]===0).length}</div><div class="sum-label">Out</div></div><div class="sum-card sum-yellow"><div class="sum-val">${all.filter(p=>st[p]>0&&st[p]<=low).length}</div><div class="sum-label">Low</div></div><div class="sum-card sum-accent"><div class="sum-val">${ts>0?fmt(ts):"—"}</div><div class="sum-label">Today Sales</div></div>`;
  renderBanners(s);
  const catF=document.getElementById("dashCatFilter").value,srch=(document.getElementById("dashSearch").value||"").toLowerCase(),grid=document.getElementById("dashboardGrid");
  grid.innerHTML="";
  const cats=catF?[catF]:Object.keys(PRODUCTS);
  cats.forEach(cat=>{
    const flt=PRODUCTS[cat].filter(e=>!srch||pn(e).toLowerCase().includes(srch));if(!flt.length)return;
    const blk=document.createElement("div");blk.className="cat-block";
    const ttl=document.createElement("div");ttl.className="cat-title";ttl.textContent=cat;blk.appendChild(ttl);
    const sd=s.showDiscPct==="yes",cw=document.createElement("div");cw.className="dash-card-wrap";
    flt.forEach(entry=>{
      const n=pn(entry),c=pc(entry),qty=st[n]!==undefined?st[n]:null,stat=qty===null?"na":qty===0?"out":qty<=low?"low":"ok",sl=qty===null?"Not Set":qty===0?"Out":qty<=low?"Low":"Good";
      const p=pricing[n],hm=p&&p.mrp,hd=p&&p.discountPrice,dp=p&&p.discountPct>0?p.discountPct:null;
      const card=document.createElement("div");card.className="dash-prod-card";
      const codeHtml=c&&c!=="—"?`<span class="dpc-code-wrap"><span class="dpc-code">${c}</span><button class="copy-btn always-visible" onclick="copyCode('${c}',this)" title="Copy">📋</button></span>`:"";
      let ph="";if(sd&&(hm||hd)){ph=`<div class="dpc-pricing">`;if(hm)ph+=`<span class="dpc-mrp${hd?" striked":""}">${fmt(p.mrp)}</span>`;if(hd)ph+=`<span class="dpc-sale">${fmt(p.discountPrice)}</span>`;if(dp)ph+=`<span class="dpc-pct">${dp}%</span>`;ph+=`</div>`;}
      card.innerHTML=`<div class="dpc-left">${codeHtml}<span class="dpc-name">${n}</span>${ph}</div><div class="dpc-right"><span class="dpc-qty">${qty!==null?qty:"—"}</span><span class="dpc-unit">units</span><span class="badge ${stat}">${sl}</span></div>`;
      cw.appendChild(card);
    });blk.appendChild(cw);grid.appendChild(blk);
  });
  if(!grid.innerHTML)grid.innerHTML=`<div class="empty-msg">Koi product nahi mila 🔍</div>`;
}
async function renderBanners(s){
  if(!s)s=await getSettings();
  const ab=document.getElementById("announcementBanner");
  if(ab){if(s.announcement){const tm={info:"banner-info",warning:"banner-warning",success:"banner-success",danger:"banner-danger"};ab.className="announcement-banner "+(tm[s.announcementType||"info"]||"banner-info");ab.textContent=s.announcement;ab.style.display="block";}else ab.style.display="none";}
  if(s.showExpiryAlert!=="yes"){document.getElementById("expiryAlertBanner").style.display="none";return;}
  const crit=parseInt(s.expCriticalDays)||7,soon=(await getExpiry()).filter(e=>e.status==="active"&&Math.round((new Date(e.expDate)-new Date())/864e5)<=crit);
  const eb=document.getElementById("expiryAlertBanner");
  if(eb){if(soon.length>0){eb.style.display="block";const expired=soon.filter(e=>Math.round((new Date(e.expDate)-new Date())/864e5)<0);eb.innerHTML=expired.length>0?`🔴 ${expired.length} batches EXPIRED! <a href="#" onclick="showTab('expiry',null);return false">Dekhein →</a>`:`🟠 ${soon.length} batches expire hongi. <a href="#" onclick="showTab('expiry',null);return false">Dekhein →</a>`;}else eb.style.display="none";}
}

// ── PRICING ──────────────────────────────────────────────────────
async function loadProdPricing(){
  const prod=document.getElementById("priceProduct").value,box=document.getElementById("pricingBox");
  if(!prod){box.style.display="none";showCodeBadge("priceCodeBadge","");return;}
  box.style.display="block";showCodeBadge("priceCodeBadge",codeOf(prod));
  const p=(await getPricing())[prod];
  if(p){document.getElementById("priceMrp").value=p.mrp||"";document.getElementById("priceDiscount").value=p.discountPrice||"";document.getElementById("priceNote").value=p.note||"";calcDisc();}
  else{["priceMrp","priceDiscount","priceNote"].forEach(id=>document.getElementById(id).value="");document.getElementById("calcPanel").style.display="none";}
}
async function calcDisc(){
  const mrp=parseFloat(document.getElementById("priceMrp").value),disc=parseFloat(document.getElementById("priceDiscount").value),panel=document.getElementById("calcPanel");
  if(isNaN(mrp)||mrp<=0){panel.style.display="none";return;}panel.style.display="block";
  document.getElementById("calcMrp").textContent=fmt(mrp);
  if(!isNaN(disc)&&disc>0){const sv=mrp-disc,pct=((sv/mrp)*100).toFixed(1);document.getElementById("calcFinal").textContent=fmt(disc);document.getElementById("calcSaving").textContent=fmt(sv);const pe=document.getElementById("calcPct");pe.textContent=`${pct}%`;const s=await getSettings();pe.style.color=s.maxDiscount>0&&parseFloat(pct)>s.maxDiscount?"var(--red)":"";}
  else{["calcFinal","calcSaving"].forEach(id=>document.getElementById(id).textContent="—");document.getElementById("calcPct").textContent="0%";}
}
async function savePricing(){
  const prod=document.getElementById("priceProduct").value,mrp=parseFloat(document.getElementById("priceMrp").value),disc=parseFloat(document.getElementById("priceDiscount").value),note=document.getElementById("priceNote").value;
  if(!prod){showMsg("priceMsg","Product select karo",true);return;}if(isNaN(mrp)||mrp<=0){showMsg("priceMsg","Valid MRP daalo",true);return;}
  if(!isNaN(disc)&&disc>mrp){showMsg("priceMsg","Discount price MRP se zyada nahi!",true);return;}
  const s=await getSettings(),pct=!isNaN(disc)?((mrp-disc)/mrp*100):0;
  if(s.maxDiscount>0&&pct>s.maxDiscount){showMsg("priceMsg",`Max discount ${s.maxDiscount}% exceed ho raha!`,true);return;}
  const pObj={mrp,discountPrice:!isNaN(disc)&&disc>0?disc:null,discountPct:!isNaN(disc)&&disc>0?parseFloat(((mrp-disc)/mrp*100).toFixed(2)):0,note:note||"",updatedAt:new Date().toLocaleString("hi-IN")};
  await setPricingOne(prod,pObj);showMsg("priceMsg",`✅ ${prod} — MRP: ${fmt(mrp)}`,false);showToast("Pricing saved");await renderDash();renderPricingTable();
}
async function renderPricingTable(){
  const wrap=document.getElementById("pricingTableWrap");if(!wrap)return;
  const p=await getPricing(),srch=(document.getElementById("pricingSearch")?.value||"").toLowerCase(),catF=(document.getElementById("pricingCatFilter")?.value||"");
  let keys=Object.keys(p).filter(k=>!srch||k.toLowerCase().includes(srch));
  if(catF){const cats=(PRODUCTS[catF]||[]).map(e=>pn(e));keys=keys.filter(k=>cats.includes(k));}
  if(!keys.length){wrap.innerHTML=`<div class="empty-msg">Koi pricing set nahi</div>`;return;}
  let h=`<div class="cat-block"><div class="cat-title">Pricing List (${keys.length})</div><div style="overflow-x:auto"><table class="stock-table"><thead><tr><th>Product</th><th>MRP</th><th>Sale Price</th><th>Disc%</th><th>Note</th><th></th></tr></thead><tbody>`;
  keys.forEach(n=>{const pr=p[n];const code=codeOf(n);h+=`<tr><td><div class="dpc-code-wrap">${code&&code!=="—"?`<span class="dpc-code">${code}</span><button class="copy-btn always-visible" onclick="copyCode('${code}',this)">📋</button>`:""}</div><span class="p-name">${n}</span></td><td style="color:var(--muted);${pr.discountPrice?"text-decoration:line-through":""}">${pr.mrp?fmt(pr.mrp):"—"}</td><td class="p-qty">${pr.discountPrice?fmt(pr.discountPrice):(pr.mrp?fmt(pr.mrp):"—")}</td><td>${pr.discountPct>0?`<span class="badge ok">${pr.discountPct}%</span>`:`<span class="badge na">—</span>`}</td><td style="color:var(--muted);font-size:12px">${pr.note||"—"}</td><td><button class="icon-btn red" onclick="delPricing('${esc(n)}')">✕</button></td></tr>`;});
  h+=`</tbody></table></div></div>`;wrap.innerHTML=h;
}
async function delPricing(n){if(!confirm(`"${n}" ki pricing delete karna chahte ho?`))return;await deletePricingOne(n);renderPricingTable();await renderDash();showToast("Pricing removed");}

// ── HISTORY ──────────────────────────────────────────────────────
async function renderWeek(){
  const el=document.getElementById("weekSummary");if(!el)return;
  const h=await getHistory(),days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);}
  const bars=days.map(d=>{const logs=(h[d]||[]).filter(l=>l.type==="Sale");return{d,total:logs.filter(l=>l.salePrice).reduce((a,l)=>a+l.salePrice,0)};});
  const mx=Math.max(...bars.map(b=>b.total),1);
  let html=`<div class="week-wrap"><div class="week-title">Last 7 Days</div><div class="week-bars">`;
  bars.forEach(b=>{const ht=Math.round((b.total/mx)*60),isT=b.d===today();html+=`<div class="week-bar-col"><div class="week-bar-val">${b.total>0?fmt(b.total):""}</div><div class="week-bar" style="height:${Math.max(ht,2)}px${isT?";background:var(--accent)":""}"></div><div class="week-bar-label">${fmtD(b.d).slice(0,5)}</div></div>`;});
  html+=`</div></div>`;el.innerHTML=html;
}
async function renderHist(){
  const date=document.getElementById("historyDate").value,catF=document.getElementById("historyCat").value,wrap=document.getElementById("historyTable");
  const logs=(await getHistory())[date]||[],flt=catF?logs.filter(l=>l.cat===catF):logs;
  if(!flt.length){wrap.innerHTML=`<div class="empty-msg">📭 ${fmtD(date)} ke liye koi data nahi</div>`;return;}
  const st=flt.filter(l=>l.type==="Sale"&&l.salePrice).reduce((s,l)=>s+l.salePrice,0),ut=flt.filter(l=>l.type==="Sale").reduce((s,l)=>s+l.qty,0);
  let html=`<div class="hist-date-label">📅 ${fmtD(date)} — ${flt.length} entries`;
  if(ut>0)html+=` &nbsp;|&nbsp; <span style="color:var(--accent)">📦 ${ut} units</span>`;
  if(st>0)html+=` &nbsp;|&nbsp; <span style="color:var(--green)">💰 ${fmt(st)}</span>`;
  html+=`</div><div style="overflow-x:auto"><table class="stock-table full"><thead><tr><th>Time</th><th>Code</th><th>Category</th><th>Product</th><th>Type</th><th>Qty</th><th>Bal</th><th>Amount</th></tr></thead><tbody>`;
  flt.forEach(l=>{html+=`<tr><td>${l.time}</td><td>${l.code&&l.code!=="—"?`<span class="dpc-code-wrap"><span class="dpc-code">${l.code}</span><button class="copy-btn always-visible small" onclick="copyCode('${l.code}',this)">📋</button></span>`:"—"}</td><td>${l.cat}</td><td class="p-name">${l.product}</td><td><span class="${l.type==="Sale"?"badge out":l.type.includes("Added")?"badge ok":"badge low"}">${l.type}</span></td><td>${l.qty}</td><td><strong>${l.balance}</strong></td><td>${l.salePrice?`<strong style="color:var(--green)">${fmt(l.salePrice)}</strong>`:"—"}</td></tr>`;});
  html+=`</tbody></table></div>`;wrap.innerHTML=html;
}
async function dlHistCSV(){
  const date=document.getElementById("historyDate").value,logs=(await getHistory())[date]||[];
  if(!logs.length){showToast("Koi data nahi",true);return;}
  let csv="Time,Code,Category,Product,Type,Qty,Balance,Amount,Note\n";
  logs.forEach(l=>{csv+=`"${l.time}","${l.code||""}","${l.cat}","${l.product}","${l.type}",${l.qty},${l.balance},"${l.salePrice?fmt(l.salePrice):""}","${l.note||""}"\n`;});
  dlFile(csv,`stock_${date}.csv`,"text/csv");showToast("CSV downloaded ✅");
}

// ── EXPIRY ───────────────────────────────────────────────────────
async function expStat(ds){
  const s=await getSettings(),cr=parseInt(s.expCriticalDays)||7,nr=parseInt(s.expNearDays)||30;
  const ex=new Date(ds),td=new Date();ex.setHours(0,0,0,0);td.setHours(0,0,0,0);const days=Math.round((ex-td)/864e5);
  if(days<0)return{key:"expired",label:"Expired",cls:"exp-expired"};if(days<=cr)return{key:"critical",label:`${days}d left`,cls:"exp-critical"};if(days<=nr)return{key:"near",label:`${days}d left`,cls:"exp-near"};return{key:"safe",label:`${days}d left`,cls:"exp-safe"};
}
function onExpProductChange(){const prod=document.getElementById("expProduct").value;showCodeBadge("expCodeBadge",prod?codeOf(prod):"");}
async function saveExpiry(){
  const cat=document.getElementById("expCat").value,prod=document.getElementById("expProduct").value,batch=document.getElementById("expBatch").value.trim(),qty=parseInt(document.getElementById("expQty").value),date=document.getElementById("expDate").value;
  if(!cat||!prod){showMsg("expMsg","Category aur Product select karo",true);return;}if(isNaN(qty)||qty<1){showMsg("expMsg","Valid quantity daalo",true);return;}if(!date){showMsg("expMsg","Expiry date daalo",true);return;}
  const entry={id:Date.now(),cat,product:prod,code:codeOf(prod),batch:batch||"",qty,originalQty:qty,expDate:date,status:"active",addedOn:today()};
  await addExpiryOne(entry);showMsg("expMsg",`✅ Batch saved! ${prod} — ${qty} units`,false);showToast(`Batch added: ${prod}`);
  ["expBatch","expQty","expDate"].forEach(id=>document.getElementById(id).value="");
  await renderExpList();await renderExpSummary();await renderBanners();
}
async function renderExpSummary(){
  const el=document.getElementById("expirySummary");if(!el)return;
  const entries=(await getExpiry()).filter(e=>e.status!=="disposed");let ex=0,cr=0,nr=0,sf=0;
  for(const e of entries){const s=await expStat(e.expDate);if(s.key==="expired")ex++;else if(s.key==="critical")cr++;else if(s.key==="near")nr++;else sf++;}
  el.innerHTML=`<div class="exp-badge exp-expired" onclick="fltExp('expired')">Expired <strong>${ex}</strong></div><div class="exp-badge exp-critical" onclick="fltExp('critical')">Critical <strong>${cr}</strong></div><div class="exp-badge exp-near" onclick="fltExp('near')">Near <strong>${nr}</strong></div><div class="exp-badge exp-safe" onclick="fltExp('safe')">Safe <strong>${sf}</strong></div>`;
}
function fltExp(val){document.getElementById("expFilterStatus").value=val;renderExpList();}
async function renderExpList(){
  const wrap=document.getElementById("expiryList");if(!wrap)return;
  const fS=document.getElementById("expFilterStatus").value,fC=document.getElementById("expFilterCat").value;
  let entries=await getExpiry();
  if(fC)entries=entries.filter(e=>e.cat===fC);
  if(fS==="disposed")entries=entries.filter(e=>e.status==="disposed");
  else{entries=entries.filter(e=>e.status!=="disposed");if(fS){const filtered=[];for(const e of entries){const s=await expStat(e.expDate);if(s.key===fS)filtered.push(e);}entries=filtered;}}
  entries.sort((a,b)=>new Date(a.expDate)-new Date(b.expDate));
  if(!entries.length){wrap.innerHTML=`<div class="empty-msg">Koi entry nahi mili</div>`;return;}
  const grp={};entries.forEach(e=>{if(!grp[e.cat])grp[e.cat]=[];grp[e.cat].push(e);});
  let html="";
  for(const[cat,items]of Object.entries(grp)){
    html+=`<div class="cat-block" style="margin-bottom:14px"><div class="cat-title">${cat}</div>`;
    const act=items.filter(i=>i.status==="active");const fifoId=act.length>1?act.reduce((a,b)=>new Date(a.expDate)<new Date(b.expDate)?a:b).id:null;
    for(const e of items){
      const s=e.status==="disposed"?{key:"disposed",label:"Disposed",cls:"exp-disposed"}:await expStat(e.expDate),isFifo=e.id===fifoId;
      const codeHtml=e.code&&e.code!=="—"?`<span class="dpc-code-wrap"><span class="dpc-code">${e.code}</span><button class="copy-btn always-visible" onclick="copyCode('${e.code}',this)">📋</button></span>`:"";
      html+=`<div class="exp-entry-row"><div class="exp-entry-left">${codeHtml}<span class="exp-prod-name">${e.product}</span>${e.batch?`<span class="exp-batch">Batch: ${e.batch}</span>`:""}${isFifo?`<span class="fifo-badge">🔁 Sell First</span>`:""}<span class="exp-date-txt">Exp: <span class="${s.cls}" style="font-weight:700">${fmtD(e.expDate)}</span> | Added: ${fmtD(e.addedOn)}</span></div><div class="exp-entry-right"><span class="exp-qty">${e.qty}</span><span class="dpc-unit">units</span><span class="exp-status-badge ${s.cls}">${s.label}</span>${e.status!=="disposed"?`<div class="exp-actions"><button class="icon-btn" onclick="openExpEdit(${e.id},${e.qty})">✏️</button><button class="icon-btn" onclick="disposeExp(${e.id})">🗑️</button><button class="icon-btn red" onclick="delExp(${e.id})">✕</button></div>`:`<div class="exp-actions"><button class="icon-btn red" onclick="delExp(${e.id})">✕</button></div>`}</div></div>`;
    }
    html+=`</div>`;
  }
  wrap.innerHTML=html;
}
function openExpEdit(id,qty){document.getElementById("expEditId").value=id;document.getElementById("expEditQty").value=qty;document.getElementById("expEditModal").style.display="flex";}
function closeExpEdit(){document.getElementById("expEditModal").style.display="none";}
async function saveExpEdit(){const id=parseInt(document.getElementById("expEditId").value),qty=parseInt(document.getElementById("expEditQty").value);if(isNaN(qty)||qty<0){showToast("Valid quantity daalo",true);return;}await updateExpiryOne(id,{qty});closeExpEdit();await renderExpList();await renderExpSummary();showToast("Qty updated");}
async function disposeExp(id){if(!confirm("Batch disposed mark karna chahte ho?"))return;await updateExpiryOne(id,{status:"disposed",disposedOn:today()});await renderExpList();await renderExpSummary();showToast("Batch disposed");}
async function delExp(id){if(!confirm("Entry delete karna chahte ho?"))return;await deleteExpiryOne(id);await renderExpList();await renderExpSummary();showToast("Entry deleted");}
async function dlExpiryCSV(){
  const entries=await getExpiry();if(!entries.length){showToast("Koi data nahi",true);return;}
  let csv="Product,Code,Category,Batch,Qty,Expiry,Status,Added\n";
  for(const e of entries){const s=e.status==="disposed"?"Disposed":(await expStat(e.expDate)).key;csv+=`"${e.product}","${e.code||""}","${e.cat}","${e.batch||""}",${e.qty},"${fmtD(e.expDate)}","${s}","${fmtD(e.addedOn)}"\n`;}
  dlFile(csv,`expiry_${today()}.csv`,"text/csv");showToast("Expiry CSV downloaded");
}

// ── ADMIN ────────────────────────────────────────────────────────
async function checkAdminPin(){
  const inp=document.getElementById("adminPinInput").value,adm=await getAdminData(),m=document.getElementById("adminPinMsg");
  if(inp===adm.pin){m.textContent="✅ Access granted!";m.style.color="var(--green)";setTimeout(()=>{document.getElementById("adminLockScreen").style.display="none";document.getElementById("adminContent").style.display="block";loadAdminForms();renderCatList();renderBackupStatus();renderStorageInfo();renderLowStockReport();renderStockHealth();renderRevDashboard();renderTopProds();renderAdminStats();renderCatBreakdown();},400);}
  else if(inp.length>=(adm.pin||"1234").length){m.textContent="❌ Wrong PIN!";m.style.color="var(--red)";setTimeout(()=>{document.getElementById("adminPinInput").value="";m.textContent="";},1200);}
}
function lockAdmin(){document.getElementById("adminLockScreen").style.display="";document.getElementById("adminContent").style.display="none";document.getElementById("adminPinInput").value="";document.getElementById("adminPinMsg").textContent="";}

async function loadAdminForms(){
  const s=await getSettings();
  const sv=(id,val)=>{const el=document.getElementById(id);if(el){if(el.tagName==="TEXTAREA")el.value=val||"";else el.value=val||"";}};
  sv("adminStoreName",s.storeName);sv("adminLowStock",s.lowStockLevel||5);sv("adminCurrency",s.currency||"₹");sv("adminDefDisc",s.defaultDiscount||0);
  sv("adminBulkDisc",s.bulkDiscount||0);sv("adminBulkMinQty",s.bulkMinQty||5);sv("adminMaxDisc",s.maxDiscount||50);sv("adminShowDisc",s.showDiscPct||"yes");
  sv("adminExpCrit",s.expCriticalDays||7);sv("adminExpNear",s.expNearDays||30);sv("adminShowExpAlert",s.showExpiryAlert||"yes");
  sv("adminAnnouncement",s.announcement||"");sv("adminAnnouncementType",s.announcementType||"info");
  sv("adminTabStyle",s.tabStyle||"default");sv("staffPin",s.staffPin||"");sv("staffMode",s.staffModeActive||"no");
  updateAnnouncePrev();
  const cp=document.getElementById("customAccentPicker");if(cp)cp.value=s.accentColor||"#e8a020";
  const ch=document.getElementById("customAccentHex");if(ch)ch.value=s.accentColor||"#e8a020";
  const bp=document.getElementById("customBgPicker");if(bp)bp.value=s.bgColor||"#0d0f14";
  if(s.staffPerms){["stock","sale","pricing","expiry","history"].forEach(k=>{const el=document.getElementById("perm_"+k);if(el)el.checked=s.staffPerms[k]!==false;});}
}
function updateAnnouncePrev(){
  const msg=document.getElementById("adminAnnouncement"),type=document.getElementById("adminAnnouncementType"),prev=document.getElementById("announcementPreview");
  if(!prev)return;const tm={info:"banner-info",warning:"banner-warning",success:"banner-success",danger:"banner-danger"};
  prev.className="announcement-banner "+(tm[(type&&type.value)||"info"]||"banner-info");prev.textContent=(msg&&(msg.value||msg.textContent))||"Preview...";
}
async function saveAppSettings(){const s=await getSettings();s.storeName=document.getElementById("adminStoreName").value||"Tata Stock Manager";s.lowStockLevel=parseInt(document.getElementById("adminLowStock").value)||5;s.currency=document.getElementById("adminCurrency").value||"₹";s.defaultDiscount=parseInt(document.getElementById("adminDefDisc").value)||0;await setSettings(s);showMsg("adminSettingsMsg","✅ Saved!",false);showToast("Settings updated");document.title=s.storeName;window._curSym=s.currency;await renderDash();}
async function saveAnnouncement(){const s=await getSettings();s.announcement=document.getElementById("adminAnnouncement").value;s.announcementType=document.getElementById("adminAnnouncementType").value;await setSettings(s);showMsg("adminAnnouncementMsg","✅ Published!",false);showToast("Announcement published");await renderBanners(s);}
async function clearAnnouncement(){const s=await getSettings();s.announcement="";await setSettings(s);document.getElementById("adminAnnouncement").value="";showMsg("adminAnnouncementMsg","✅ Cleared",false);await renderBanners(s);}
async function savePricingRules(){const s=await getSettings();s.bulkDiscount=parseInt(document.getElementById("adminBulkDisc").value)||0;s.bulkMinQty=parseInt(document.getElementById("adminBulkMinQty").value)||5;s.maxDiscount=parseInt(document.getElementById("adminMaxDisc").value)||50;s.showDiscPct=document.getElementById("adminShowDisc").value;await setSettings(s);showMsg("adminPricingMsg","✅ Saved!",false);showToast("Updated");await renderDash();}
async function saveExpConfig(){const s=await getSettings();s.expCriticalDays=parseInt(document.getElementById("adminExpCrit").value)||7;s.expNearDays=parseInt(document.getElementById("adminExpNear").value)||30;s.showExpiryAlert=document.getElementById("adminShowExpAlert").value;await setSettings(s);showMsg("adminExpiryMsg","✅ Saved!",false);showToast("Updated");}
async function saveStaffSettings(){const s=await getSettings();s.staffPin=document.getElementById("staffPin").value;s.staffModeActive=document.getElementById("staffMode").value;if(!s.staffPerms)s.staffPerms={};["stock","sale","pricing","expiry","history"].forEach(k=>{const el=document.getElementById("perm_"+k);if(el)s.staffPerms[k]=el.checked;});await setSettings(s);showMsg("staffPinMsg","✅ Saved!",false);showToast("Staff updated");checkStaff(s);}
async function changePin(){const cur=document.getElementById("curPin").value,np=document.getElementById("newPin").value,cf=document.getElementById("cfmPin").value,adm=await getAdminData();if(cur!==adm.pin){showMsg("adminPinChangeMsg","Current PIN galat hai",true);return;}if(np.length<4){showMsg("adminPinChangeMsg","PIN min 4 digits",true);return;}if(np!==cf){showMsg("adminPinChangeMsg","PIN match nahi karta",true);return;}adm.pin=np;await setAdminData(adm);showMsg("adminPinChangeMsg","✅ PIN changed!",false);showToast("PIN changed");["curPin","newPin","cfmPin"].forEach(id=>document.getElementById(id).value="");}
async function changeAppPassword(){const cur=document.getElementById("curAppPass").value,np=document.getElementById("newAppPass").value,cf=document.getElementById("cfmAppPass").value;const s=await getSettings(),correct=s.appPassword||"1234";if(cur!==correct){showMsg("appPassMsg","Current password galat hai",true);return;}if(np.length<4){showMsg("appPassMsg","Min 4 characters",true);return;}if(np!==cf){showMsg("appPassMsg","Passwords match nahi karte",true);return;}s.appPassword=np;await setSettings(s);showMsg("appPassMsg","✅ Password changed!",false);showToast("App password changed ✅");["curAppPass","newAppPass","cfmAppPass"].forEach(id=>document.getElementById(id).value="");}
async function applyBulkPricing(){const cat=document.getElementById("bulkPriceCat").value,pct=parseFloat(document.getElementById("bulkDiscPct").value);if(!cat){showMsg("bulkPricingMsg","Category select karo",true);return;}if(isNaN(pct)||pct<=0||pct>=100){showMsg("bulkPricingMsg","Valid discount % daalo",true);return;}const p=await getPricing();let updated=0;(PRODUCTS[cat]||[]).forEach(entry=>{const n=pn(entry),ex=p[n];if(ex&&ex.mrp){p[n]={...ex,discountPrice:parseFloat((ex.mrp*(1-pct/100)).toFixed(2)),discountPct:parseFloat(pct.toFixed(2)),updatedAt:new Date().toLocaleString("hi-IN")};updated++;}});await setPricing(p);showMsg("bulkPricingMsg",`✅ ${updated} products updated`,false);showToast(`Bulk: ${cat}`);renderPricingTable();await renderDash();}
async function resetCatPricing(){const cat=document.getElementById("resetPriceCat").value,prod=document.getElementById("resetPriceProd").value;if(!cat){showMsg("resetPricingMsg","Category select karo",true);return;}const p=await getPricing();if(prod){if(!confirm(`"${prod}" ki pricing delete?`))return;delete p[prod];}else{const prods=(PRODUCTS[cat]||[]).map(e=>pn(e));if(!confirm(`"${cat}" ke ${prods.length} products ki pricing reset?`))return;prods.forEach(n=>delete p[n]);}await setPricing(p);showMsg("resetPricingMsg","✅ Reset done!",false);renderPricingTable();await renderDash();showToast("Pricing reset");}
async function renderLowStockReport(){const el=document.getElementById("lowStockReport");if(!el)return;const st=await getStock(),s=await getSettings(),low=s.lowStockLevel||5,items=[];Object.values(PRODUCTS).flat().forEach(e=>{const n=pn(e),qty=st[n]||0;if(qty<=low)items.push({name:n,code:pc(e),qty,out:qty===0});});if(!items.length){el.innerHTML=`<div style="color:var(--green);font-size:13px;padding:6px 0">✅ Sab products ka stock theek hai!</div>`;return;}let html=`<div style="max-height:200px;overflow-y:auto">`;items.forEach(i=>{html+=`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px"><span class="p-name">${i.name}</span><span class="badge ${i.out?"out":"low"}">${i.qty} units</span></div>`;});html+=`</div><div style="font-size:12px;color:var(--muted);margin-top:6px">${items.length} products need reorder</div>`;el.innerHTML=html;}
async function renderStockHealth(){const el=document.getElementById("stockHealthChart");if(!el)return;const st=await getStock(),s=await getSettings(),low=s.lowStockLevel||5,all=Object.values(PRODUCTS).flat().map(e=>pn(e));const inSt=all.filter(p=>st[p]>low).length,lowSt=all.filter(p=>st[p]>0&&st[p]<=low).length,outSt=all.filter(p=>!st[p]||st[p]===0).length,tot=all.length;const bar=(n,cls,lbl)=>{const pct=tot>0?Math.round((n/tot)*100):0;return`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>${lbl}</span><span>${n} (${pct}%)</span></div><div style="background:var(--bg3);border-radius:4px;height:8px;overflow:hidden"><div style="height:100%;border-radius:4px;background:${cls};width:${pct}%;transition:width 0.5s"></div></div></div>`;};el.innerHTML=bar(inSt,"var(--green)","✅ In Stock")+bar(lowSt,"var(--yellow)","⚠️ Low")+bar(outSt,"var(--red)","❌ Out/Not Set");}
async function dlLowStockCSV(){const st=await getStock(),s=await getSettings(),low=s.lowStockLevel||5,items=[];Object.values(PRODUCTS).flat().forEach(e=>{const n=pn(e),qty=st[n]||0;if(qty<=low)items.push({name:n,code:pc(e),qty});});if(!items.length){showToast("Sab theek hai!");return;}let csv="Product,Code,Stock,Status\n";items.forEach(i=>csv+=`"${i.name}","${i.code||""}",${i.qty},"${i.qty===0?"Out":"Low"}"\n`);dlFile(csv,`order_list_${today()}.csv`,"text/csv");showToast("Order list downloaded");}
async function renderRevDashboard(){const el=document.getElementById("revenueDashboard");if(!el)return;const h=await getHistory(),allLogs=Object.values(h).flat().filter(l=>l.type==="Sale");const todayR=((h[today()]||[]).filter(l=>l.type==="Sale"&&l.salePrice)).reduce((a,l)=>a+l.salePrice,0);const w=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;w.push(((h[k]||[]).filter(l=>l.type==="Sale"&&l.salePrice)).reduce((a,l)=>a+l.salePrice,0));}const weekR=w.reduce((a,v)=>a+v,0),totalR=allLogs.filter(l=>l.salePrice).reduce((a,l)=>a+l.salePrice,0);el.innerHTML=`<div class="admin-stats-grid"><div class="admin-stat"><div class="stat-val green">${fmt(todayR)}</div><div class="stat-label">Today</div></div><div class="admin-stat"><div class="stat-val accent">${fmt(weekR)}</div><div class="stat-label">This Week</div></div><div class="admin-stat"><div class="stat-val">${fmt(totalR)}</div><div class="stat-label">All Time</div></div><div class="admin-stat"><div class="stat-val">${allLogs.reduce((a,l)=>a+l.qty,0)}</div><div class="stat-label">Units Sold</div></div></div>`;}
async function renderTopProds(){const el=document.getElementById("topProductsReport");if(!el)return;const h=await getHistory(),allLogs=Object.values(h).flat().filter(l=>l.type==="Sale"),pm={};allLogs.forEach(l=>{if(!pm[l.product])pm[l.product]={qty:0,rev:0};pm[l.product].qty+=l.qty;pm[l.product].rev+=l.salePrice||0;});const sorted=Object.entries(pm).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);if(!sorted.length){el.innerHTML=`<div class="empty-msg" style="padding:16px">Koi sales nahi</div>`;return;}let html=`<div style="overflow-x:auto"><table class="stock-table"><thead><tr><th>#</th><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>`;sorted.forEach(([n,d],i)=>{html+=`<tr><td>${i+1}</td><td class="p-name">${n}</td><td>${d.qty}</td><td style="color:var(--green);font-weight:700">${fmt(d.rev)}</td></tr>`;});html+=`</tbody></table></div>`;el.innerHTML=html;}
async function genSalesReport(){const from=document.getElementById("reportFrom").value,to=document.getElementById("reportTo").value,el=document.getElementById("salesReportResult"),btn=document.getElementById("exportSalesBtn");if(!from||!to){el.innerHTML=`<div style="color:var(--red);font-size:13px;margin-top:8px">Date range select karo</div>`;return;}const h=await getHistory();let rev=0,units=0,trans=0,days=0;const d=new Date(from);while(d<=new Date(to)){const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,logs=(h[k]||[]).filter(l=>l.type==="Sale");if(logs.length){rev+=logs.filter(l=>l.salePrice).reduce((a,l)=>a+l.salePrice,0);units+=logs.reduce((a,l)=>a+l.qty,0);trans+=logs.length;days++;}d.setDate(d.getDate()+1);}el.innerHTML=`<div class="admin-stats-grid" style="margin-top:10px"><div class="admin-stat"><div class="stat-val green">${fmt(rev)}</div><div class="stat-label">Revenue</div></div><div class="admin-stat"><div class="stat-val">${units}</div><div class="stat-label">Units</div></div><div class="admin-stat"><div class="stat-val accent">${days}</div><div class="stat-label">Days</div></div><div class="admin-stat"><div class="stat-val">${trans}</div><div class="stat-label">Transactions</div></div></div>`;btn.style.display=days>0?"block":"none";}
async function dlSalesReport(){const from=document.getElementById("reportFrom").value,to=document.getElementById("reportTo").value,h=await getHistory();let csv="Date,Product,Category,Type,Qty,Balance,Amount\n";const d=new Date(from);while(d<=new Date(to)){const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;(h[k]||[]).filter(l=>l.type==="Sale").forEach(l=>{csv+=`"${fmtD(k)}","${l.product}","${l.cat}","${l.type}",${l.qty},${l.balance},"${l.salePrice?fmt(l.salePrice):""}"\n`;});d.setDate(d.getDate()+1);}dlFile(csv,`sales_${from}_to_${to}.csv`,"text/csv");showToast("Sales report downloaded");}
async function dlStockSnapshot(){const filter=document.getElementById("snapshotFilter").value,st=await getStock(),s=await getSettings(),low=s.lowStockLevel||5,all=[];Object.entries(PRODUCTS).forEach(([cat,items])=>items.forEach(e=>{const n=pn(e),qty=st[n]||0;all.push({cat,name:n,code:pc(e),qty});}));let flt=all;if(filter==="stocked")flt=all.filter(p=>p.qty>0);else if(filter==="low")flt=all.filter(p=>p.qty<=low);else if(filter==="out")flt=all.filter(p=>p.qty===0);if(!flt.length){showMsg("snapshotMsg","Koi data nahi",true);return;}let csv="Category,Product,Code,Stock,Status\n";flt.forEach(p=>{const st2=p.qty===0?"Out":p.qty<=low?"Low":"In Stock";csv+=`"${p.cat}","${p.name}","${p.code||""}",${p.qty},"${st2}"\n`;});dlFile(csv,`snapshot_${today()}.csv`,"text/csv");showMsg("snapshotMsg",`✅ ${flt.length} products exported`,false);showToast("Snapshot downloaded");}
async function renderBackupStatus(){const el=document.getElementById("backupStatus");if(!el)return;const s=await getSettings(),last=s.lastBackup;if(!last){el.innerHTML=`<div class="backup-warn">⚠️ Koi backup nahi hua! Zaroor backup lo.</div>`;return;}const days=Math.round((new Date()-new Date(last))/864e5);el.innerHTML=`<div class="${days>7?"backup-warn":"backup-ok"}">Last: ${fmtD(last.slice(0,10))} (${days} din pehle)${days>7?" — Backup karo!":""}</div>`;}
async function renderStorageInfo(){const el=document.getElementById("storageInfo");if(!el)return;const info=await getStorageInfo();el.innerHTML=`<div style="font-size:12px;color:var(--muted);margin-top:6px">IndexedDB: ${info.idbInfo} | LS: ${info.lsInfo}</div>`;}
async function renderAdminStats(){const[st,pr,s,h,exp]=await Promise.all([getStock(),getPricing(),getSettings(),getHistory(),getExpiry()]);const allLogs=Object.values(h).flat(),saleLogs=allLogs.filter(l=>l.type==="Sale"),rev=saleLogs.filter(l=>l.salePrice).reduce((a,l)=>a+l.salePrice,0),all=Object.values(PRODUCTS).flat().map(e=>pn(e)),low=s.lowStockLevel||5;const el=document.getElementById("adminStatsGrid");if(!el)return;el.innerHTML=`<div class="admin-stat"><div class="stat-val">${all.length}</div><div class="stat-label">Products</div></div><div class="admin-stat"><div class="stat-val ok">${all.filter(p=>st[p]>0).length}</div><div class="stat-label">In Stock</div></div><div class="admin-stat"><div class="stat-val red">${all.filter(p=>st[p]===0).length}</div><div class="stat-label">Out</div></div><div class="admin-stat"><div class="stat-val yellow">${all.filter(p=>st[p]>0&&st[p]<=low).length}</div><div class="stat-label">Low</div></div><div class="admin-stat"><div class="stat-val accent">${Object.keys(pr).length}</div><div class="stat-label">Priced</div></div><div class="admin-stat"><div class="stat-val">${exp.filter(e=>e.status==="active").length}</div><div class="stat-label">Batches</div></div><div class="admin-stat"><div class="stat-val">${saleLogs.reduce((a,l)=>a+l.qty,0)}</div><div class="stat-label">Units Sold</div></div><div class="admin-stat"><div class="stat-val green">${rev>0?fmt(rev):"—"}</div><div class="stat-label">Revenue</div></div><div class="admin-stat"><div class="stat-val">${Object.keys(PRODUCTS).length}</div><div class="stat-label">Categories</div></div><div class="admin-stat"><div class="stat-val">${allLogs.length}</div><div class="stat-label">Logs</div></div>`;}
async function renderCatBreakdown(){const el=document.getElementById("catBreakdown");if(!el)return;const[st,pr,s]=await Promise.all([getStock(),getPricing(),getSettings()]);const low=s.lowStockLevel||5;let html=`<div style="overflow-x:auto"><table class="stock-table"><thead><tr><th>Category</th><th>Products</th><th>In Stock</th><th>Low</th><th>Out</th><th>Priced</th></tr></thead><tbody>`;Object.entries(PRODUCTS).forEach(([cat,items])=>{const names=items.map(e=>pn(e));html+=`<tr><td class="p-name">${cat}</td><td>${names.length}</td><td style="color:var(--green)">${names.filter(n=>st[n]>low).length}</td><td style="color:var(--yellow)">${names.filter(n=>st[n]>0&&st[n]<=low).length}</td><td style="color:var(--red)">${names.filter(n=>!st[n]||st[n]===0).length}</td><td style="color:var(--accent)">${names.filter(n=>pr[n]).length}</td></tr>`;});html+=`</tbody></table></div>`;el.innerHTML=html;}
async function dlPricingCSV(){const p=await getPricing(),keys=Object.keys(p);if(!keys.length){showToast("Koi pricing set nahi");return;}let csv="Product,MRP,Sale Price,Disc%,Note\n";keys.forEach(n=>{const pr=p[n];csv+=`"${n}",${pr.mrp||""},${pr.discountPrice||""},${pr.discountPct||0},"${pr.note||""}"\n`;});dlFile(csv,`pricing_${today()}.csv`,"text/csv");showToast("Pricing CSV downloaded");}
async function doImport(event){const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=async function(e){const ok=await importBackup(e.target.result);if(ok){showMsg("importMsg","✅ Import successful! Reloading...",false);setTimeout(()=>location.reload(),2000);}else showMsg("importMsg","❌ Invalid backup file",true);};reader.readAsText(file);}
async function doReset(type){const msgs={history:"Poora history delete karna chahte ho?",stock:"Sab ka stock 0 karna chahte ho?",pricing:"Sab ki pricing delete karna chahte ho?",expiry:"Sab expiry entries delete karna chahte ho?",everything:"⚠️ SAB KUCH DELETE HOGA! Pakka?"};if(!confirm(msgs[type]||"Sure?"))return;if(type==="everything"&&!confirm("Are you 100% sure? Undo nahi hoga!"))return;if(type==="everything"){await Promise.all(["stock","history","pricing","expiry"].map(k=>resetTable(k)));}else await resetTable(type);showToast(`${type} reset done!`);await renderDash();await renderHist();renderPricingTable();await renderExpSummary();await renderExpList();}

// ── CATALOG ──────────────────────────────────────────────────────
let _sCat=null;
async function renderCatList(){const list=document.getElementById("catList");if(!list)return;const cats=Object.keys(_catalog);if(!cats.length){list.innerHTML=`<div class="cat-empty">Koi category nahi</div>`;return;}list.innerHTML=cats.map(c=>{const count=_catalog[c].length,active=c===_sCat?" active":"";return`<div class="cat-list-item${active}" onclick="selCat('${esc(c)}')"><span class="cat-item-name">${esc(c)}</span><span class="cat-item-count">${count}</span><span class="cat-item-actions"><button class="icon-btn" onclick="event.stopPropagation();openRenameCat('${esc(c)}')">✏️</button><button class="icon-btn red" onclick="event.stopPropagation();delCat('${esc(c)}')">🗑️</button></span></div>`;}).join("");}
function selCat(c){_sCat=c;renderCatList();renderProdList(c);document.getElementById("prodColTitle").textContent=`📂 ${c}`;document.getElementById("addProdBtn").style.display="";}
function renderProdList(cat){const list=document.getElementById("prodList");if(!list)return;const items=_catalog[cat]||[];if(!items.length){list.innerHTML=`<div class="cat-empty">Koi product nahi</div>`;return;}list.innerHTML=items.map((p,i)=>`<div class="prod-list-item"><div class="prod-item-info"><span class="prod-item-name">${esc(p.name)}</span>${p.code?`<span class="prod-item-code">${esc(p.code)}</span>`:""}</div><span class="cat-item-actions"><button class="icon-btn" onclick="moveProd('${esc(cat)}',${i},-1)" ${i===0?"disabled":""}>▲</button><button class="icon-btn" onclick="moveProd('${esc(cat)}',${i},1)" ${i===items.length-1?"disabled":""}>▼</button><button class="icon-btn" onclick="openEditProd('${esc(cat)}',${i})">✏️</button><button class="icon-btn red" onclick="delProd('${esc(cat)}',${i})">🗑️</button></span></div>`).join("");}
function openAddCat(){document.getElementById("catModalTitle").textContent="New Category";document.getElementById("catModalInput").value="";document.getElementById("catModalOld").value="";document.getElementById("catModalMsg").className="msg-box";document.getElementById("catModal").style.display="flex";setTimeout(()=>document.getElementById("catModalInput").focus(),100);}
function openRenameCat(cat){document.getElementById("catModalTitle").textContent="Rename Category";document.getElementById("catModalInput").value=cat;document.getElementById("catModalOld").value=cat;document.getElementById("catModalMsg").className="msg-box";document.getElementById("catModal").style.display="flex";setTimeout(()=>document.getElementById("catModalInput").focus(),100);}
function closeCatModal(){document.getElementById("catModal").style.display="none";}
async function saveCatModal(){const newN=document.getElementById("catModalInput").value.trim(),oldN=document.getElementById("catModalOld").value;if(!newN){showMsg("catModalMsg","Name daalo",true);return;}if(oldN){if(newN===oldN){closeCatModal();return;}if(_catalog[newN]){showMsg("catModalMsg","Name pehle se hai",true);return;}_catalog[newN]=_catalog[oldN];delete _catalog[oldN];if(_sCat===oldN)_sCat=newN;showToast("Renamed ✅");}else{if(_catalog[newN]){showMsg("catModalMsg","Category pehle se hai",true);return;}_catalog[newN]=[];_sCat=newN;showToast(`"${newN}" added ✅`);}await setCatalogData(_catalog);rebuildPROD();await refreshDrops();closeCatModal();renderCatList();if(_sCat)selCat(_sCat);showMsg("catalogMsg",`✅ "${newN}" saved!`,false);}
async function delCat(cat){if(!confirm(`"${cat}" mein ${(_catalog[cat]||[]).length} products hain. Delete?`))return;delete _catalog[cat];if(_sCat===cat){_sCat=null;document.getElementById("prodList").innerHTML="";document.getElementById("prodColTitle").textContent="← Select category";document.getElementById("addProdBtn").style.display="none";}await setCatalogData(_catalog);rebuildPROD();await refreshDrops();showToast(`"${cat}" deleted`);showMsg("catalogMsg","✅ Deleted",false);renderCatList();}
function openAddProd(){if(!_sCat)return;document.getElementById("prodModalTitle").textContent=`New Product in "${_sCat}"`;["prodModalName","prodModalCode","prodModalOld"].forEach(id=>document.getElementById(id).value="");document.getElementById("prodModalCat").value=_sCat;document.getElementById("prodModalMsg").className="msg-box";document.getElementById("prodModal").style.display="flex";setTimeout(()=>document.getElementById("prodModalName").focus(),100);}
function openEditProd(cat,idx){const p=_catalog[cat][idx];document.getElementById("prodModalTitle").textContent="Edit Product";document.getElementById("prodModalName").value=p.name;document.getElementById("prodModalCode").value=p.code||"";document.getElementById("prodModalOld").value=p.name;document.getElementById("prodModalCat").value=cat;document.getElementById("prodModalMsg").className="msg-box";document.getElementById("prodModal").style.display="flex";setTimeout(()=>document.getElementById("prodModalName").focus(),100);}
function closeProdModal(){document.getElementById("prodModal").style.display="none";}
async function saveProdModal(){const cat=document.getElementById("prodModalCat").value,newN=document.getElementById("prodModalName").value.trim(),code=document.getElementById("prodModalCode").value.trim(),oldN=document.getElementById("prodModalOld").value;if(!newN){showMsg("prodModalMsg","Product name daalo",true);return;}const items=_catalog[cat]||[];if(oldN){const idx=items.findIndex(p=>p.name===oldN);if(idx===-1){showMsg("prodModalMsg","Product nahi mila",true);return;}items[idx]={name:newN,code};showToast("Updated ✅");}else{if(items.find(p=>p.name===newN)){showMsg("prodModalMsg","Product pehle se hai",true);return;}items.push({name:newN,code});showToast("Added ✅");}_catalog[cat]=items;await setCatalogData(_catalog);rebuildPROD();await refreshDrops();closeProdModal();renderProdList(cat);showMsg("catalogMsg",`✅ "${newN}" saved!`,false);}
async function delProd(cat,idx){const p=_catalog[cat][idx];if(!confirm(`"${p.name}" delete?`))return;_catalog[cat].splice(idx,1);await setCatalogData(_catalog);rebuildPROD();await refreshDrops();renderProdList(cat);showToast("Deleted");}
async function moveProd(cat,idx,dir){const items=_catalog[cat],ni=idx+dir;if(ni<0||ni>=items.length)return;[items[idx],items[ni]]=[items[ni],items[idx]];_catalog[cat]=items;await setCatalogData(_catalog);rebuildPROD();renderProdList(cat);}

window.addEventListener("DOMContentLoaded", init);
