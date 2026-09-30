//! Tray icon setup and menu handling for the desktop build.
//!
//! A left click toggles the popup lookup window next to the icon. The menu,
//! on a right click, covers the rest:
//! - Main window: shows and focuses the main window.
//! - Settings: shows the main window on its settings page via a dedicated
//!   event.
//! - Exit: cleanly exits the application.
//!
//! Linux delivers no tray click events, so there the icon always opens the
//! menu and the popup is reached through its global shortcut.

#![cfg(desktop)]

use tauri::{
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

use crate::popup;

// Stable identifiers so both Rust and JS can rely on them.
pub const TRAY_ID: &str = "main-tray";

pub const MENU_ID_OPEN: &str = "tray-open";
pub const MENU_ID_SETTINGS: &str = "tray-settings";
pub const MENU_ID_EXIT: &str = "tray-exit";

/// Creates the tray icon and attaches its menu.
pub fn init_tray(app: &AppHandle) -> tauri::Result<()> {
    let handle = app.clone();

    // Build the tray menu (IDs are used in the global menu handler).
    let menu = MenuBuilder::new(&handle)
        .text(MENU_ID_OPEN, "Main window")
        .text(MENU_ID_SETTINGS, "Settings")
        .separator()
        .text(MENU_ID_EXIT, "Exit")
        .build()?;

    // Build the tray icon itself. The left button belongs to the popup; the
    // menu moves to the right button.
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            // Act on release, the way a button does: the press is what takes
            // focus away from an open panel.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                popup::toggle_from_tray(tray.app_handle(), rect);
            }
        })
        .tooltip("AIctionary");

    // Template alpha is tinted by macOS for either menu-bar appearance.
    #[cfg(target_os = "macos")]
    {
        builder = builder.icon(template_icon()).icon_as_template(true);
    }
    #[cfg(not(target_os = "macos"))]
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
            show_main_window(app_handle);
        } else if id == MENU_ID_SETTINGS {
            handle_settings(app_handle);
        } else if id == MENU_ID_EXIT {
            app_handle.exit(0);
        }
    });
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn handle_settings(app: &AppHandle) {
    show_main_window(app);

    // Ask the frontend to navigate to the settings page.
    let _ = app.emit_to("main", "open-settings", ());
}

/// A small open book with a transparent background. The app icon's filled
/// blue tile cannot serve as a template: its alpha would become a solid box.
#[cfg(target_os = "macos")]
fn template_icon() -> tauri::image::Image<'static> {
    let mut rgba = vec![0; 22 * 22 * 4];
    for y in 4..18 {
        for x in 3..19 {
            let edge = x == 3 || x == 10 || x == 11 || x == 18 || y == 4 || y == 17;
            let text = (y == 8 || y == 11) && ((5..9).contains(&x) || (13..17).contains(&x));
            if edge || text {
                rgba[(y * 22 + x) * 4 + 3] = 255;
            }
        }
    }
    tauri::image::Image::new_owned(rgba, 22, 22)
}
