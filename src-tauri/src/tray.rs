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
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, Manager, PhysicalPosition, Position, Runtime,
};
use std::sync::Mutex;

// Stable identifiers so both Rust and JS can rely on them.
pub const TRAY_ID: &str = "main-tray";

pub const MENU_ID_OPEN: &str = "tray-open";
pub const MENU_ID_SETTINGS: &str = "tray-settings";
pub const MENU_ID_EXIT: &str = "tray-exit";
pub const POPUP_ID: &str = "popup";

const POPUP_GAP: f64 = 8.0;

static LAST_TRAY_POSITION: Mutex<Option<Position>> = Mutex::new(None);

/// Creates the tray icon and attaches its menu.
pub fn init_tray(app: &AppHandle) -> tauri::Result<()> {
    let handle = app.clone();

    // Build the context menu (IDs are used in the global menu handler).
    let menu = MenuBuilder::new(&handle)
        .text(MENU_ID_OPEN, "Main window")
        .text(MENU_ID_SETTINGS, "Settings")
        .text(MENU_ID_EXIT, "Exit")
        .build()?;

    // Build the tray icon itself.
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Down,
                rect,
                ..
            } = event
            {
                if let Ok(mut last_position) = LAST_TRAY_POSITION.lock() {
                    *last_position = Some(rect.position.clone());
                }
                toggle_popup(tray.app_handle(), Some(rect.position));
            }
        })
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
        } else if id == MENU_ID_SETTINGS {
            handle_settings(app_handle);
        } else if id == MENU_ID_EXIT {
            app_handle.exit(0);
        }
    });
}

pub fn focus_window<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn handle_open(app: &AppHandle) {
    focus_window(app, "main");
}

fn handle_settings(app: &AppHandle) {
    focus_window(app, "main");

    let _ = app.emit("open-settings", ());
}

pub fn toggle_popup<R: Runtime>(app: &AppHandle<R>, tray_position: Option<Position>) {
    if let Some(window) = app.get_webview_window(POPUP_ID) {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            return;
        }

        let popup_size = window.outer_size().ok();
        let scale_factor = window.scale_factor().unwrap_or(1.0);
        let tray_position = tray_position
            .or_else(|| LAST_TRAY_POSITION.lock().ok().and_then(|position| position.clone()))
            .or_else(|| {
                app.primary_monitor().ok().flatten().map(|monitor| {
                    let monitor_position = monitor.position();
                    let monitor_size = monitor.size();
                    let popup_width = popup_size
                        .map(|size| size.width as i32)
                        .unwrap_or(315);
                    let popup_height = popup_size
                        .map(|size| size.height as i32)
                        .unwrap_or(360);
                    Position::Physical(PhysicalPosition::new(
                        monitor_position.x + (monitor_size.width as i32 - popup_width) / 2,
                        monitor_position.y + (monitor_size.height as i32 - popup_height) / 2,
                    ))
                })
            });

        let position = tray_position.map(|tray_position| match tray_position {
            Position::Logical(position) => Position::Logical(LogicalPosition::new(
                position.x
                    - popup_size
                        .map(|size| f64::from(size.width) / scale_factor / 2.0)
                        .unwrap_or(157.5),
                position.y + POPUP_GAP,
            )),
            Position::Physical(position) => Position::Physical(PhysicalPosition::new(
                position.x
                    - popup_size
                        .map(|size| size.width as i32 / 2)
                        .unwrap_or(158),
                position.y + POPUP_GAP as i32,
            )),
        });

        if let Some(position) = position {
            let _ = window.set_position(position);
        }
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = app.emit("popup-opened", ());
    }
}
