# New Tab

A Chrome (Manifest V3) extension that replaces your New Tab page with a clean, customizable one. Use an image, animated GIF or video as your wallpaper, and show or hide every element on the page.

**Developed by [Suraj Dev](https://surajdev.com) for [Webot](https://webot.surajdev.com/)**

## Features
- **Wallpapers:** images (JPEG, PNG, WebP, AVIF, BMP, SVG), animated GIFs, and muted looping MP4/WebM video.
- **Easy ways to add media:**
  - Drag and drop a file from your computer onto the page.
  - Drag media straight from any webpage onto the page.
  - Right-click an image or video on a site and choose **Set as wallpaper**.
  - Upload from **Personalize** or the library panel.
- **Clock, date, greeting, Google search, editable quick-launch shortcuts, and a daily focus card.**
- **Show or hide every element:** greeting, date, clock, search, section label, shortcuts, focus card, library button, arrange button, Personalize button, credit line and the drop hint. Manage them in **Personalize → Page elements**, or use the **Hide** button and hidden-elements tray in **Arrange layout**.
- **Arrange layout:** drag and resize elements; positions are saved on your device.
- **Wallpaper controls:** fit, brightness, blur, and a pause-video toggle.
- **Local wallpaper library** with select, delete and clear actions.
- No analytics, accounts, remote services or broad host permissions.

## Install
1. Click **Code → Download ZIP** on this repository and extract it (or clone the repo).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the folder that contains `manifest.json`.
5. Open a new tab.

## Tips
- **Hidden the Personalize button?** Hover the bottom-right corner to bring up a ⚙ button, or click the extension's toolbar icon while a new tab is open.
- **Chrome's bottom footer** ("Managed by your organization | New Tab") is drawn by Chrome, not by this extension, so it can't be removed from code. You can turn it off yourself: click **Customize Chrome** (bottom right) → **Footer** → switch off **Show footer on New Tab page**. "Managed by your organization" comes from a policy on your device or profile; check `chrome://policy`.

## Media notes
- Local uploads and dropped files are stored as blobs in IndexedDB on your device.
- Right-click capture and dropped web media store a URL reference, not a copy. Some sites block embedding or use temporary URLs; if that happens, save the file and upload it instead.
- Video starts muted and loops. MP4/H.264 and WebM/VP9 work well.

## Permissions
- `storage`: saves settings, layout and wallpaper references.
- `contextMenus`: adds the right-click **Set as wallpaper** action.
- No `tabs`, `activeTab`, `scripting`, host permissions or remote code.

## Project structure
```
manifest.json   extension manifest (MV3)
background.js   context menu and toolbar icon handling
newtab.html     New Tab page markup
newtab.js       page logic (wallpapers, settings, layout, hide/show)
styles.css      styles
icons/          16, 48 and 128 px icons
```

## Credit
Developed by [Suraj Dev](https://surajdev.com) for [Webot](https://webot.surajdev.com/).
