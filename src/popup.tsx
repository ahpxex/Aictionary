import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import "@/shared/services/i18n";
import { WindowProviders } from "@/app/providers";
import { PopupPage } from "@/features/popup";

// Entry point of the popup lookup window (popup.html), which the desktop
// build creates in Rust. It shares the main window's state through local
// storage but none of its routing or app-wide sync duties.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <WindowProviders>
      <PopupPage />
    </WindowProviders>
  </React.StrictMode>
);
