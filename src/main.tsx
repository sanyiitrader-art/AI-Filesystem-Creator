import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

window.addEventListener("contextmenu", (e) => e.preventDefault());

// WebView2 ships a built-in "right-click-drag to pan" gesture with no
// documented settings API to disable it directly (confirmed: this is
// a known, still-open issue for other WebView2-based apps too, not
// something specific to our code). The practical fix is to deny the
// gesture recognizer the mousedown event it needs to start tracking
// the drag at all -- preventDefault on right-button mousedown, before
// any pan can begin, rather than trying to stop it mid-drag.
window.addEventListener("mousedown", (e) => {
  if (e.button === 2) {
    e.preventDefault();
  }
});

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