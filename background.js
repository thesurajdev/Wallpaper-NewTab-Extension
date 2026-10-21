const MENU_ID = "wallpaper-newtab-set-wallpaper";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Set as wallpaper",
      contexts: ["image", "video"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;
  const url = info.srcUrl;
  const kind = /\.(gif)(?:$|[?#])/i.test(url) ? "gif"
    : /\.(mp4|webm|ogv|mov)(?:$|[?#])/i.test(url) ? "video"
    : info.mediaType === "video" ? "video" : "image";
  chrome.storage.local.set({
    wallpaperPendingMedia: {
      id: "remote-" + Date.now(),
      type: kind,
      url,
      name: url.split("/").pop().split(/[?#]/)[0] || "Web media",
      createdAt: Date.now()
    }
  });
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
});

chrome.action.onClicked.addListener(() => {
  const openTab = () => chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
  // If a new tab page is already visible, open its Personalize panel; otherwise open a new tab.
  chrome.runtime.sendMessage({ type: "open-settings" })
    .then((res) => { if (!res || !res.ok) openTab(); })
    .catch(openTab);
});