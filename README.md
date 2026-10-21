# New Tab

A Chrome Manifest V3 extension that lets you customize the New Tab page with image, animated GIF, and video wallpapers.

**Built by Webot:** https://webot.surajdev.com/

## Features
- Image backgrounds: JPEG, PNG, WebP, AVIF, BMP, SVG and other browser-supported image formats.
- Animated GIF backgrounds.
- Muted, looping MP4/WebM (and browser-supported video) backgrounds.
- Right-click an image or video on a webpage and choose **Set as wallpaper**.
- Upload media from your computer.
- Drag and drop media files or media URLs onto the New Tab page.
- Clock, date, Google search, editable shortcuts.
- Every element (greeting, date, clock, search, shortcuts, focus card, buttons, credit) can be hidden and added back from **Personalize → Page elements**, or from **Arrange layout** (Hide button + hidden-elements tray).
- If you hide the Personalize button, hover the bottom-right corner or click the extension toolbar icon to reopen it.
- Wallpaper fit, brightness and blur controls; pause video toggle.
- Local wallpaper library with select/delete/clear actions.
- No analytics, account, remote service or broad host permissions.

## Install in Chrome
1. Download and extract `wallpaper-newtab-extension.zip`.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `wallpaper-newtab` folder containing `manifest.json`.
6. Open a new tab.
7. To set media from a website, right-click the image or video and select **Set as wallpaper**.

## Media capture notes
- Local uploads/dropped files are stored as blobs in IndexedDB.
- Right-click capture stores a URL reference, not a downloaded copy. Some sites block embedding or use temporary URLs; upload a local copy if that happens.
- Cross-tab dragging is browser-dependent; local file drag-and-drop and the right-click action are alternatives.
- Video starts muted and loops. MP4/H.264 and WebM/VP9 are good choices.

## Permissions
- `storage`: save settings and pending context-menu media metadata.
- `contextMenus`: add the right-click wallpaper action.
- No broad host permissions, activeTab, scripting, tabs, or remote code.

## Project structure
`manifest.json`, `background.js`, `newtab.html`, `newtab.js`, `styles.css`, `README.md`, and `icons/`.

## Credit
Built by [Webot](https://webot.surajdev.com/).
