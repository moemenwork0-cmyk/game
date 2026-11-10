// Phone features: camera, sharing / saving files, vibration, back button, status bar.
// Each helper also works in a normal browser (for testing on a computer).
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";

export const isNative = Capacitor.isNativePlatform();

function blobToB64(b) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
}
function safeFile(name) { return name.replace(/[\\/:*?"<>|]+/g, "_"); }
async function writeCache(name, blob) {
  const path = "share/" + safeFile(name);
  const r = await Filesystem.writeFile({ path, data: await blobToB64(blob), directory: Directory.Cache, recursive: true });
  return r.uri;
}
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function isAbort(e) { const m = String((e && (e.message || e.name)) || e || ""); return /cancel|abort/i.test(m); }

/* Share / save one file (report, day file, backup, CSV). Returns "shared" | "cancel" | "saved". */
export async function shareFile(name, blob, title) {
  if (isNative) {
    const uri = await writeCache(name, blob);
    try { await Share.share({ title: title || name, files: [uri], dialogTitle: title || name }); return "shared"; }
    catch (e) { if (isAbort(e)) return "cancel"; throw e; }
  }
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return "shared"; }
  } catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  download(blob, name); return "saved";
}
/* Share several photos with a text (WhatsApp etc.) */
export async function shareFiles(list, text) {   // list: [{name, blob}]
  if (isNative) {
    const files = []; for (const f of list) files.push(await writeCache(f.name, f.blob));
    try { await Share.share({ text, files, dialogTitle: "UNIFOOD" }); return "shared"; }
    catch (e) { if (isAbort(e)) return "cancel"; throw e; }
  }
  const files = list.map(f => new File([f.blob], f.name, { type: "image/jpeg" }));
  try { if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, text }); return "shared"; } }
  catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  return "unsupported";
}
/* Open WhatsApp with a ready text */
export function openWhatsApp(text) {
  const url = "https://wa.me/?text=" + encodeURIComponent(text);
  if (isNative) { window.location.href = url; return; }   // the app hands external links to Android (opens WhatsApp)
  window.open(url, "_blank", "noopener");
}
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
  try { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch (e) { return false; }
}

/* Camera / gallery. Returns an array of Blobs (empty if cancelled). */
export async function takePhotos(source, max) {
  if (!isNative) return null;        // the browser uses a normal file input instead
  try {
    if (source === "camera") {
      const p = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: 90, correctOrientation: true, saveToGallery: false });
      return [await (await fetch(p.webPath)).blob()];
    }
    const r = await Camera.pickImages({ quality: 90, limit: Math.max(1, max), correctOrientation: true });
    const out = []; for (const p of r.photos.slice(0, max)) out.push(await (await fetch(p.webPath)).blob());
    return out;
  } catch (e) {
    if (isAbort(e) || /no image|no photo/i.test(String(e && e.message))) return [];
    throw e;
  }
}

export function tap() { if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); }
export function alarm() {
  if (isNative) { Haptics.vibrate({ duration: 250 }).catch(() => {}); setTimeout(() => Haptics.vibrate({ duration: 250 }).catch(() => {}), 380); return; }
  try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
}

export function onBack(handler) {
  if (!isNative) return;
  App.addListener("backButton", () => { if (!handler()) App.minimizeApp(); });
}
export function onResume(handler) { if (isNative) App.addListener("resume", handler); }
export function setBars(dark) {
  if (!isNative) return;
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});   // light icons on the green top bar
}
