import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

// Suppresses WebView2's native browser chrome so the app reads as a
// standalone desktop app rather than a webpage -- the default
// right-click menu (Back/Refresh/Save As/Print/...) is a browser
// feature, not something our own UI renders, so it must be blocked
// here rather than per-component.
window.addEventListener("contextmenu", (e) => e.preventDefault());

// Best-effort: blocks the most common devtools/view-source shortcuts.
// Honest caveat: this does not make the app un-decompilable -- a
// webview app's frontend assets are inherently inspectable by anyone
// with access to the installed files, same as any Electron/Tauri app.
// This just removes the casual one-keystroke path to them.
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (
    key === "f12" ||
    (e.ctrlKey && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
    (e.ctrlKey && key === "u")
  ) {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);