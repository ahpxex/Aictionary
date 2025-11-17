//! Tray icon setup and menu handling for the desktop build.
//!
//! This module wires a Tauri v2 tray icon with a simple menu:
//! - Open: shows and focuses the main window.
//! - Query: shows the main window and focuses the search box (reuses the
//!   existing `new-query` event handled by the React app).
//! - About: shows the main window and navigates to the Settings → About tab
//!   via a dedicated event.
//! - Exit: cleanly exits the application.

#![cfg(desktop)]

use tauri::{
    menu::MenuBuilder,
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

// Stable identifiers so both Rust and JS can rely on them.
pub const TRAY_ID: &str = "main-tray";

pub const MENU_ID_OPEN: &str = "tray-open";
pub const MENU_ID_QUERY: &str = "tray-query";
pub const MENU_ID_ABOUT: &str = "tray-about";
pub const MENU_ID_EXIT: &str = "tray-exit";

/// Creates the tray icon and attaches its menu.
pub fn init_tray(app: &AppHandle) -> tauri::Result<()> {
    let handle = app.clone();

    // Build the tray menu (IDs are used in the global menu handler).
    let menu = MenuBuilder::new(&handle)
        .text(MENU_ID_OPEN, "Open")
        .text(MENU_ID_QUERY, "New query")
        .separator()
        .text(MENU_ID_ABOUT, "About")
        .separator()
        .text(MENU_ID_EXIT, "Exit")
        .build()?;

    // Build the tray icon itself.
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("AIctionary");

    // Try to reuse the default app icon for the tray, if available.
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    // We don't need the returned handle right now; it is kept internally
    // by Tauri's tray manager and accessed later by ID.
    let _tray = builder.build(&handle)?;

    Ok(())
}

/// Registers a global menu event handler that reacts to the tray menu items.
pub fn register_menu_handler(app: &AppHandle) {
    app.on_menu_event(|app_handle, event| {
        let id = event.id();

        if id == MENU_ID_OPEN {
            handle_open(app_handle);
        } else if id == MENU_ID_QUERY {
            handle_query(app_handle);
        } else if id == MENU_ID_ABOUT {
            handle_about(app_handle);
        } else if id == MENU_ID_EXIT {
            app_handle.exit(0);
        }
    });
}

fn handle_open(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn handle_query(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    // Reuse the same event that the global keyboard shortcut emits so
    // the React side doesn't need a special code path for tray clicks.
    let _ = app.emit("new-query", ());
}

fn handle_about(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    // Ask the frontend to navigate to Settings → About.
    let _ = app.emit("open-settings-about", ());
}
