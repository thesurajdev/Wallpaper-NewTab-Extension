const $ = (s) => document.querySelector(s);
const DB_NAME = "wallpaper-newtab-media-v1";
const STORE_NAME = "media";
const DEFAULTS = {
  hidden: {},
  fit: "cover", brightness: 75, blur: 0, pauseVideo: false,
  focusText: "",
  shortcuts: [
    {title:"Google", url:"https://www.google.com", icon:"G", cls:"google"},
    {title:"YouTube", url:"https://www.youtube.com", icon:"▶", cls:"youtube"},
    {title:"Gmail", url:"https://mail.google.com", icon:"✉", cls:"mail"}
  ]
};
let settings = {...DEFAULTS};
let library = [];
let activeId = null;
let toastTimer;
const objectUrls = new Map();

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, {keyPath:"id"});
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAll() {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const req = db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(item) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const req = db.transaction(STORE_NAME,"readwrite").objectStore(STORE_NAME).put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const req = db.transaction(STORE_NAME,"readwrite").objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
function mediaUrl(item) {
  if (item.blob) {
    if (!objectUrls.has(item.id)) objectUrls.set(item.id, URL.createObjectURL(item.blob));
    return objectUrls.get(item.id);
  }
  return item.url || "";
}
function typeFor(fileOrUrl, mime="") {
  if (mime.startsWith("video/") || /\.(mp4|webm|ogv|mov)(?:$|[?#])/i.test(fileOrUrl)) return "video";
  if (mime === "image/gif" || /\.gif(?:$|[?#])/i.test(fileOrUrl)) return "gif";
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|avif|bmp|svg)(?:$|[?#])/i.test(fileOrUrl)) return "image";
  return null;
}
function showToast(message) {
  const node = $("#toast"); node.textContent = message; node.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>node.classList.remove("show"),2600);
}
function applySettings() {
  $("#fitSelect").value = settings.fit;
  $("#brightness").value = settings.brightness;
  $("#brightnessValue").textContent = `${settings.brightness}%`;
  $("#blur").value = settings.blur;
  $("#blurValue").textContent = `${settings.blur} px`;
  applyHidden();
  $("#pauseVideo").checked = settings.pauseVideo;
  const wall = $("#wallpaper");
  wall.style.filter = `brightness(${settings.brightness/100}) blur(${settings.blur}px)`;
  wall.style.transform = settings.blur ? "scale(1.04)" : "";
  renderShortcuts();
}
async function saveSettings() { await chrome.storage.local.set({wallpaperSettings:settings}); }
function updateClock() {
  const now = new Date();
  $("#clock").textContent = now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false});
  $("#date").textContent = now.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"});
  const h = now.getHours();
  $("#greeting").textContent = h < 12 ? "Good morning. Make it a good one." : h < 18 ? "A little space, just for you" : "Slow down. You're right where you need to be.";
}
function renderWallpaper(item) {
  const wall = $("#wallpaper");
  wall.replaceChildren();
  if (!item) {
    wall.style.backgroundImage = "linear-gradient(135deg,#202d3b,#526f76 48%,#b8a58a)";
    wall.style.filter = `brightness(${settings.brightness/100}) blur(${settings.blur}px)`;
    return;
  }
  const src = mediaUrl(item);
  if (!src) return;
  if (item.type === "video") {
    const video = document.createElement("video");
    video.src = src; video.autoplay = !settings.pauseVideo; video.loop = true;
    video.muted = true; video.playsInline = true; video.controls = false;
    video.style.objectFit = settings.fit === "auto" ? "none" : settings.fit;
    if (settings.pauseVideo) video.pause();
    else video.play().catch(()=>showToast("Video playback was blocked. Click the page to try again."));
    wall.append(video);
  } else {
    const img = document.createElement("img");
    img.src = src; img.alt = ""; img.draggable = false;
    img.style.objectFit = settings.fit;
    img.onerror = () => showToast("This media could not be loaded. Try downloading it first.");
    wall.append(img);
  }
  wall.style.backgroundImage = "none";
  wall.style.filter = `brightness(${settings.brightness/100}) blur(${settings.blur}px)`;
}
async function activate(item, save=true) {
  if (save && !library.some(x=>x.id===item.id)) {
    library.unshift(item);
    try { await dbPut(item); }
    catch(e) { showToast("Storage is full. Remove some wallpapers and try again."); library = library.filter(x=>x.id!==item.id); return; }
  }
  activeId = item.id;
  await chrome.storage.local.set({wallpaperActiveId:activeId});
  renderWallpaper(item); renderLibrary(); updateEmptyHint();
  showToast("Wallpaper updated");
}
async function addLocalFile(file) {
  const type = typeFor(file.name, file.type);
  if (!type) { showToast("Choose an image, GIF, MP4 or WebM file."); return; }
  const item = {id:"local-"+crypto.randomUUID(),type,name:file.name,blob:file,createdAt:Date.now()};
  await activate(item);
}
async function addRemote(url, typeHint) {
  let parsed;
  try { parsed = new URL(url); } catch { showToast("That media link doesn't look valid."); return; }
  if (!["http:","https:","blob:"].includes(parsed.protocol)) return;
  const type = typeHint || typeFor(url);
  if (!type) { showToast("Couldn't identify that media type. Save the file and upload it instead."); return; }
  const item = {id:"remote-"+crypto.randomUUID(),type,url:parsed.href,name:decodeURIComponent(parsed.pathname.split("/").pop() || "Web media"),createdAt:Date.now()};
  await activate(item);
}
function updateEmptyHint() {
  const hint=$("#emptyMediaHint");
  if(hint) hint.classList.toggle("visible", !activeId && library.length===0);
}
function renderLibrary() {
  const grid = $("#libraryGrid"); grid.replaceChildren();
  $("#emptyLibrary").style.display = library.length ? "none" : "block";
  for (const item of library.slice().sort((a,b)=>b.createdAt-a.createdAt)) {
    const card = document.createElement("div"); card.className = "wall-card"+(item.id===activeId?" active":"");
    const src = mediaUrl(item);
    const media = item.type==="video" ? document.createElement("video") : document.createElement("img");
    media.src = src; media.muted = true; media.playsInline = true;
    if (item.type==="video") { media.autoplay = true; media.loop = true; }
    card.append(media);
    const tag = document.createElement("span"); tag.className="media-tag"; tag.textContent=item.type==="video"?"VIDEO":item.type==="gif"?"GIF":"IMAGE"; card.append(tag);
    const name = document.createElement("div"); name.className="wall-name"; name.textContent=item.name || "Wallpaper"; card.append(name);
    const del = document.createElement("button"); del.className="delete-wall"; del.textContent="×"; del.title="Remove wallpaper";
    del.addEventListener("click", async e=>{e.stopPropagation(); await removeItem(item.id);}); card.append(del);
    card.addEventListener("click",()=>activate(item,false));
    grid.append(card);
  }
}
async function removeItem(id) {
  await dbDelete(id);
  const url = objectUrls.get(id); if (url) {URL.revokeObjectURL(url); objectUrls.delete(id);}
  library = library.filter(x=>x.id!==id);
  if (activeId===id) {
    activeId = library[0]?.id || null;
    await chrome.storage.local.set({wallpaperActiveId:activeId});
    renderWallpaper(library[0] || null);
  }
  renderLibrary(); updateEmptyHint(); showToast("Wallpaper removed");
}
function renderShortcuts() {
  const container = $("#shortcuts");
  container.querySelectorAll(".shortcut:not(.add-shortcut)").forEach(el=>el.remove());
  settings.shortcuts.forEach((s,index)=>{
    const a=document.createElement("a"); a.className="shortcut"; a.href=s.url;
    const icon=document.createElement("span"); icon.className="shortcut-icon "+(s.cls||""); icon.textContent=s.icon||new URL(s.url).hostname[0].toUpperCase();
    const label=document.createElement("span"); label.textContent=s.title;
    a.append(icon,label);
    a.title=s.url;
    container.insertBefore(a,$("#addShortcut"));
  });
}
function openPanel(id) { document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("open",p.id===id)); }
function closePanels() { document.querySelectorAll(".panel").forEach(p=>p.classList.remove("open")); }
function wireSettings() {
  const pairs = [["pauseVideo","pauseVideo"]];
  pairs.forEach(([id,key])=>$("#"+id).addEventListener("change",async e=>{settings[key]=e.target.checked;applySettings();await saveSettings();if(key==="pauseVideo"&&$("#wallpaper video")){const v=$("#wallpaper video");if(settings.pauseVideo)v.pause();else v.play().catch(()=>{});}}));
  $("#fitSelect").addEventListener("change",async e=>{settings.fit=e.target.value;applySettings();renderWallpaper(library.find(x=>x.id===activeId));await saveSettings();});
  $("#brightness").addEventListener("input",async e=>{settings.brightness=Number(e.target.value);applySettings();await saveSettings();});
  $("#blur").addEventListener("input",async e=>{settings.blur=Number(e.target.value);applySettings();await saveSettings();});
  $("#resetSettings").addEventListener("click",async()=>{settings={...DEFAULTS,hidden:{},shortcuts:DEFAULTS.shortcuts.map(x=>({...x}))};applySettings();await saveSettings();showToast("Settings reset");});
}
function addShortcut() {
  const title=prompt("Name this shortcut (e.g. Notion):"); if(!title)return;
  const raw=prompt("Website URL (e.g. https://notion.so):"); if(!raw)return;
  let url; try{url=new URL(/^https?:\/\//i.test(raw)?raw:"https://"+raw);if(!["http:","https:"].includes(url.protocol))throw 0;}catch{showToast("Enter a valid http or https URL.");return;}
  settings.shortcuts.push({title:title.slice(0,28),url:url.href,icon:url.hostname.replace(/^www\./,"")[0].toUpperCase(),cls:""});
  applySettings();saveSettings();showToast("Shortcut added");
}
function wireDrop() {
  let depth=0; const overlay=$("#dropOverlay");
  window.addEventListener("dragenter",e=>{e.preventDefault();depth++;overlay.classList.add("active");});
  window.addEventListener("dragover",e=>e.preventDefault());
  window.addEventListener("dragleave",e=>{e.preventDefault();depth=Math.max(0,depth-1);if(!depth)overlay.classList.remove("active");});
  window.addEventListener("drop",async e=>{
    e.preventDefault();depth=0;overlay.classList.remove("active");
    const files=[...(e.dataTransfer?.files||[])];
    if(files.length){for(const file of files)await addLocalFile(file);return;}
    const dt=e.dataTransfer;
    let html=dt?.getData("text/html")||"";
    let url=dt?.getData("text/uri-list")||dt?.getData("text/plain")||"";
    const match=html.match(/<(?:img|video|source)[^>]+(?:src|poster)=["']([^"']+)/i);
    if(match)url=match[1];
    url=(url||"").split("\n").find(line=>line.trim()&&!line.trim().startsWith("#"))?.trim();
    if(url && /^https?:\/\//i.test(url)) await addRemote(url);
    else showToast("Drop a media file here, or use right-click → Set as wallpaper on a webpage.");
  });
}


// ---- Element visibility (hide / add back) ----
const ELEMENTS = [
  {key:"greeting", label:"Greeting", desc:"Time-of-day message"},
  {key:"dateChip", label:"Date", desc:"Today, at a glance"},
  {key:"clockWrap", label:"Clock", desc:"Keep the time in view"},
  {key:"search", label:"Search bar", desc:"Search from your new tab"},
  {key:"sectionLabel", label:"Section label", desc:"Your space / Quick launch divider"},
  {key:"shortcuts", label:"Quick launch", desc:"Your favorite destinations"},
  {key:"focusCard", label:"Focus card", desc:"A daily intention"},
  {key:"libraryToggle", label:"Library button", desc:"Top-left wallpaper library"},
  {key:"arrangeButton", label:"Arrange layout button", desc:"Also available inside Personalize"},
  {key:"editButton", label:"Personalize button", desc:"Reopen via bottom-right corner or toolbar icon"},
  {key:"webotCredit", label:"Webot credit", desc:"Footer credit"},
  {key:"emptyMediaHint", label:"Wallpaper drop hint", desc:"Shown when no wallpaper is set"}
];
function elementFor(key) { return document.querySelector(`[data-layout-item="${key}"],[data-hide-key="${key}"]`); }
function applyHidden() {
  const hidden = settings.hidden || (settings.hidden = {});
  ELEMENTS.forEach(({key}) => {
    elementFor(key)?.classList.toggle("el-hidden", !!hidden[key]);
    const box = document.getElementById("el-" + key); if (box) box.checked = !hidden[key];
  });
  document.body.classList.toggle("editor-hidden", !!hidden.editButton);
  renderHiddenTray();
}
function setElementHidden(key, isHidden, {silent=false} = {}) {
  settings.hidden = settings.hidden || {};
  if (isHidden) settings.hidden[key] = true; else delete settings.hidden[key];
  applyHidden(); saveSettings().catch(()=>{});
  const label = ELEMENTS.find(e=>e.key===key)?.label || "Element";
  if (!silent) showToast(isHidden ? `${label} hidden` : `${label} added back`);
}
function renderElementToggles() {
  const wrap = $("#elementToggles"); wrap.replaceChildren();
  ELEMENTS.forEach(({key,label,desc}) => {
    const row = document.createElement("label"); row.className = "setting-row";
    const text = document.createElement("span");
    const b = document.createElement("b"); b.textContent = label;
    const s = document.createElement("small"); s.textContent = desc;
    text.append(b, s);
    const box = document.createElement("input"); box.type = "checkbox"; box.id = "el-" + key;
    box.checked = !settings.hidden?.[key];
    box.addEventListener("change", () => {
      setElementHidden(key, !box.checked);
      if (key === "editButton" && !box.checked) showToast("Personalize hidden. Hover the bottom-right corner to reopen it.");
    });
    row.append(text, box); wrap.append(row);
  });
}
function renderHiddenTray() {
  const tray = $("#hiddenTray"), list = $("#hiddenTrayList"); if (!tray) return;
  list.replaceChildren();
  ELEMENTS.filter(e => settings.hidden?.[e.key]).forEach(({key,label}) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = "＋ " + label;
    b.addEventListener("click", () => setElementHidden(key, false));
    list.append(b);
  });
  tray.hidden = !(layoutMode && list.children.length);
}

const LAYOUT_STORAGE_KEY = "wallpaperNewTabLayoutV1";
let layoutPositions = {};
let selectedLayoutItem = null;
let layoutMode = false;
let dragState = null;
let layoutSaveTimer = null;
function layoutLabel(el) {
  const labels = {libraryToggle:"Wallpaper library",dateChip:"Date",greeting:"Greeting",clockWrap:"Clock",search:"Search bar",sectionLabel:"Section label",shortcuts:"Quick launch",focusCard:"Focus card",emptyMediaHint:"Wallpaper drop hint",webotCredit:"Webot credit",editButton:"Personalize button"};
  return labels[el?.dataset.layoutItem] || "Page element";
}
function applyLayoutPositions() {
  document.querySelectorAll("[data-layout-item]").forEach(el => {
    const pos = layoutPositions[el.dataset.layoutItem];
    el.style.setProperty("--layout-x", `${pos?.x || 0}px`);
    el.style.setProperty("--layout-y", `${pos?.y || 0}px`);
    el.style.setProperty("--layout-scale", String(pos?.scale || 1));
  });
}
function saveLayoutPositions() {
  clearTimeout(layoutSaveTimer);
  layoutSaveTimer = setTimeout(() => chrome.storage.local.set({[LAYOUT_STORAGE_KEY]: layoutPositions}).catch(()=>{}), 120);
}
function placeLayoutTools(el) {
  const tools = $("#layoutTools");
  if (!el || !layoutMode) { tools.hidden = true; return; }
  const rect = el.getBoundingClientRect();
  tools.hidden = false;
  $("#layoutToolsLabel").textContent = layoutLabel(el);
  // Measure after showing, then keep the controls inside the viewport.
  requestAnimationFrame(() => {
    const w = tools.offsetWidth || 250, h = tools.offsetHeight || 43;
    const left = Math.max(10, Math.min(window.innerWidth - w - 10, rect.left));
    const top = rect.top > h + 12 ? rect.top - h - 10 : Math.min(window.innerHeight - h - 10, rect.bottom + 10);
    tools.style.left = `${left}px`; tools.style.top = `${Math.max(10, top)}px`;
  });
}
function selectLayoutItem(el) {
  document.querySelectorAll("[data-layout-item].layout-selected").forEach(n=>n.classList.remove("layout-selected"));
  selectedLayoutItem = el;
  if (el) el.classList.add("layout-selected");
  placeLayoutTools(el);
}
function setLayoutMode(on) {
  layoutMode = on;
  document.body.classList.toggle("layout-mode", on);
  $("#arrangeToggle").setAttribute("aria-pressed", String(on));
  $("#arrangeToggle").innerHTML = on ? "<span>✓</span> Done arranging" : "<span>↗</span> Arrange layout";
  renderHiddenTray();
  if (!on) { selectLayoutItem(null); showToast("Layout saved on this device"); }
  else showToast("Drag any outlined element. Select it to resize.");
}
function resetLayoutItem(el) {
  if (!el) return;
  delete layoutPositions[el.dataset.layoutItem];
  applyLayoutPositions(); saveLayoutPositions(); selectLayoutItem(el); showToast(`${layoutLabel(el)} reset`);
}
function wireFreeformLayout() {
  const tools = $("#layoutTools");
  $("#arrangeToggle").addEventListener("click",()=>setLayoutMode(!layoutMode));
  $("#resetLayout").addEventListener("click",()=>{layoutPositions={};applyLayoutPositions();saveLayoutPositions();selectLayoutItem(null);showToast("All element positions reset");});
  document.querySelectorAll("[data-layout-item]").forEach(el=>{
    el.addEventListener("pointerdown",e=>{
      if (!layoutMode || e.button !== 0 || e.target.closest(".layout-tools")) return;
      if (e.target.closest("input,select,textarea") && e.target !== el) return;
      e.preventDefault();
      selectLayoutItem(el);
      const key=el.dataset.layoutItem, saved=layoutPositions[key]||{x:0,y:0,scale:1};
      dragState={el,key,startX:e.clientX,startY:e.clientY,baseX:saved.x||0,baseY:saved.y||0,moved:false};
      el.classList.add("layout-dragging");
      try{el.setPointerCapture(e.pointerId);}catch{}
    });
    el.addEventListener("pointermove",e=>{
      if(!dragState||dragState.el!==el)return;
      const dx=e.clientX-dragState.startX,dy=e.clientY-dragState.startY;
      if(Math.abs(dx)+Math.abs(dy)>3)dragState.moved=true;
      layoutPositions[dragState.key]={...(layoutPositions[dragState.key]||{scale:1}),x:Math.round(dragState.baseX+dx),y:Math.round(dragState.baseY+dy)};
      applyLayoutPositions();placeLayoutTools(el);
    });
    const finish=()=>{
      if(!dragState||dragState.el!==el)return;
      el.classList.remove("layout-dragging");
      if(dragState.moved)saveLayoutPositions();
      dragState=null;placeLayoutTools(selectedLayoutItem);
    };
    el.addEventListener("pointerup",finish);el.addEventListener("pointercancel",finish);
    el.addEventListener("click",e=>{
      if(!layoutMode)return;
      e.preventDefault();e.stopPropagation();selectLayoutItem(el);
    },true);
  });
  tools.addEventListener("pointerdown",e=>e.stopPropagation());
  tools.addEventListener("click",e=>{
    const action=e.target.closest("[data-layout-action]")?.dataset.layoutAction;
    if(!action)return;
    e.preventDefault();e.stopPropagation();
    if(action==="done"){setLayoutMode(false);return;}
    if(action==="hide"){if(selectedLayoutItem){const k=selectedLayoutItem.dataset.layoutItem;selectLayoutItem(null);setElementHidden(k,true);}return;}
    if(!selectedLayoutItem)return;
    const key=selectedLayoutItem.dataset.layoutItem,current=layoutPositions[key]||{x:0,y:0,scale:1};
    if(action==="reset"){resetLayoutItem(selectedLayoutItem);return;}
    current.scale=Math.max(.55,Math.min(1.8,Math.round(((current.scale||1)+(action==="larger"?.1:-.1))*100)/100));
    layoutPositions[key]=current;applyLayoutPositions();saveLayoutPositions();placeLayoutTools(selectedLayoutItem);
  });
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&layoutMode){setLayoutMode(false);return;}
    if(!layoutMode||!selectedLayoutItem||["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
    const step=e.shiftKey?10:2;
    const key=selectedLayoutItem.dataset.layoutItem,current=layoutPositions[key]||{x:0,y:0,scale:1};
    const map={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
    if(map[e.key]){e.preventDefault();current.x=(current.x||0)+map[e.key][0];current.y=(current.y||0)+map[e.key][1];layoutPositions[key]=current;applyLayoutPositions();saveLayoutPositions();placeLayoutTools(selectedLayoutItem);}
  });
  window.addEventListener("resize",()=>placeLayoutTools(selectedLayoutItem));
  applyLayoutPositions();
}

async function init() {
  const saved=await chrome.storage.local.get(["wallpaperSettings","wallpaperActiveId","wallpaperPendingMedia","tipsDismissed"]);
  if(saved.wallpaperSettings){
    const s=saved.wallpaperSettings;
    settings={...DEFAULTS,...s,hidden:{...(s.hidden||{})}};
    // migrate old on/off switches
    if(s.showClock===false)settings.hidden.clockWrap=true;
    if(s.showDate===false)settings.hidden.dateChip=true;
    if(s.showSearch===false)settings.hidden.search=true;
    if(s.showShortcuts===false)settings.hidden.shortcuts=true;
    ["showClock","showDate","showSearch","showShortcuts"].forEach(k=>delete settings[k]);
  } else settings={...DEFAULTS,hidden:{}};
  try { library=await dbAll(); } catch(e){showToast("Local media storage could not be opened.");}
  activeId=saved.wallpaperActiveId || null;
  if(saved.wallpaperPendingMedia){
    const pending=saved.wallpaperPendingMedia;
    await chrome.storage.local.remove("wallpaperPendingMedia");
    if(!library.some(x=>x.id===pending.id)){
      library.unshift(pending);
      // Remote references are stored in extension storage so they can be reloaded.
      if(pending.url) await chrome.storage.local.set({wallpaperRemoteItems:library.filter(x=>x.url)});
    }
    activeId=pending.id;
    await chrome.storage.local.set({wallpaperActiveId:activeId});
  }
  const remotes=(await chrome.storage.local.get("wallpaperRemoteItems")).wallpaperRemoteItems||[];
  remotes.forEach(r=>{if(!library.some(x=>x.id===r.id))library.push(r);});
  // A URL-based wallpaper needs persistent metadata; reconcile active selection.
  if(activeId && !library.some(x=>x.id===activeId))activeId=library[0]?.id||null;
  renderElementToggles(); applySettings(); updateClock(); setInterval(updateClock,1000);
  renderWallpaper(library.find(x=>x.id===activeId)||null);renderLibrary();updateEmptyHint();
  $("#emptyUpload").addEventListener("click",()=>$("#fileInput").click());
  $("#fileInput").addEventListener("change",async e=>{for(const f of e.target.files)await addLocalFile(f);e.target.value="";});
  $("#libraryToggle").addEventListener("click",()=>openPanel("libraryPanel"));
  $("#editButton").addEventListener("click",()=>openPanel("settingsPanel"));
  $("#addShortcut").addEventListener("click",addShortcut);$("#manageShortcuts").addEventListener("click",addShortcut);
  $("#searchForm").addEventListener("submit",e=>{e.preventDefault();const q=$("#searchInput").value.trim();if(q)location.href="https://www.google.com/search?q="+encodeURIComponent(q);});
  const focusInput=$("#focusInput");
  focusInput.value=settings.focusText||"";
  focusInput.addEventListener("input",()=>{settings.focusText=focusInput.value;saveSettings().catch(()=>{});});
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closePanels));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanels();});
  $("#clearLibrary").addEventListener("click",async()=>{if(!confirm("Remove all saved wallpapers from this device?"))return;for(const item of [...library])await dbDelete(item.id);objectUrls.forEach(URL.revokeObjectURL);objectUrls.clear();library=[];activeId=null;await chrome.storage.local.set({wallpaperActiveId:null,wallpaperRemoteItems:[]});renderWallpaper(null);renderLibrary();updateEmptyHint();showToast("Library cleared");});
  layoutPositions = (await chrome.storage.local.get(LAYOUT_STORAGE_KEY))[LAYOUT_STORAGE_KEY] || {};
  wireFreeformLayout();
  wireSettings();wireDrop();
  const tip=$("#welcomeTip");
  tip.hidden=!!saved.tipsDismissed;
  $("#tipDismiss").addEventListener("click",()=>{tip.hidden=true;chrome.storage.local.set({tipsDismissed:true});});
  $("#showTipAgain").addEventListener("click",()=>{closePanels();tip.hidden=false;});
  $("#showAllElements").addEventListener("click",()=>{settings.hidden={};applyHidden();saveSettings().catch(()=>{});showToast("All elements shown");});
  $("#arrangeFromPanel").addEventListener("click",()=>{closePanels();setLayoutMode(true);});
  $("#revealHotspot").addEventListener("click",()=>openPanel("settingsPanel"));
  chrome.runtime.onMessage.addListener((msg,_s,sendResponse)=>{
    if(msg?.type==="open-settings"&&document.visibilityState==="visible"){openPanel("settingsPanel");sendResponse({ok:true});}
  });
}
init().catch(err=>{console.error(err);showToast("Wallpaper page could not initialize. Reload this tab and try again.");});