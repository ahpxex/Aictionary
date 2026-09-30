//! The popup lookup window: a small always-on-top panel summoned from the
//! tray icon or a global shortcut, for a lookup that does not drag the main
//! window in front of whatever the user is doing.
//!
//! The window is built here rather than listed in `tauri.conf.json`, because
//! the config's window list applies to every platform and the mobile hosts
//! have exactly one webview. It is created hidden at startup so the first
//! toggle shows a page that has already loaded, and it hides itself whenever
//! it loses focus - it is a glance, not a place to work.

#![cfg(desktop)]

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{
    AppHandle, Emitter, LogicalPosition, Manager, PhysicalPosition, Position, Rect, Runtime,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

pub const LABEL: &str = "popup";

/// Emitted to the popup each time it is shown, so the query bar takes the
/// caret even though the page itself never reloads.
const SHOWN_EVENT: &str = "popup-shown";

/// Logical size of the panel.
const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 440.0;
/// Logical space between the tray icon and the panel.
const TRAY_GAP: f64 = 6.0;

/// How long after a focus-loss hide a toggle still means "close".
///
/// Clicking the tray icon while the panel is open takes focus away from the
/// panel before the click itself is delivered, so the panel has already
/// hidden by the time the toggle runs. Read naively, "hidden" would open it
/// straight back up, and the icon could never close what it opened.
const BLUR_TOGGLE_GRACE: Duration = Duration::from_millis(300);

#[derive(Default)]
struct PopupState {
    hidden_on_blur_at: Mutex<Option<Instant>>,
}

/// Build the hidden panel and wire its focus handling.
pub fn init<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    app.manage(PopupState::default());

    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("popup.html".into()))
        .title("Aictionary")
        .inner_size(WIDTH, HEIGHT)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        // Follow the user across spaces instead of yanking them back to the
        // one the panel was first opened on.
        .visible_on_all_workspaces(true)
        .visible(false)
        .focused(false)
        .build()?;

    let handle = window.clone();
    window.on_window_event(move |event| match event {
        // Closing only ever means "go away"; the page stays loaded for next time.
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = handle.hide();
        }
        WindowEvent::Focused(false) => hide_on_blur(&handle),
        _ => {}
    });

    Ok(())
}

/// Hide the panel, e.g. because the main window is taking over.
pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.hide();
    }
}

/// Toggle from a tray icon click, hanging the panel off the icon.
pub fn toggle_from_tray<R: Runtime>(app: &AppHandle<R>, icon: Rect) {
    toggle(app, |app| {
        // The pointer is on the icon when it is clicked, so its screen is the
        // one whose scale the icon's rectangle was measured with.
        let screen = pointer_screen(app)?;
        let position = icon.position.to_physical::<f64>(screen.scale);
        let size = icon.size.to_physical::<f64>(screen.scale);
        let icon = Area::from_physical(
            position.x,
            position.y,
            size.width,
            size.height,
            screen.scale,
        );
        Some(beside_tray(
            icon,
            screen.work,
            screen.panel_size(),
            screen.logical_length(TRAY_GAP),
        ))
    });
}

/// Toggle from the global shortcut, on the screen the pointer is on.
pub fn toggle_from_shortcut<R: Runtime>(app: &AppHandle<R>) {
    toggle(app, |app| {
        let screen = pointer_screen(app)?;
        Some(launcher_position(screen.work, screen.panel_size()))
    });
}

fn toggle<R: Runtime>(app: &AppHandle<R>, place: impl FnOnce(&AppHandle<R>) -> Option<(f64, f64)>) {
    let Some(window) = app.get_webview_window(LABEL) else {
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    if hidden_by_this_click(app) {
        return;
    }

    // Without a monitor to measure against the panel opens where it last was,
    // which beats refusing to open at all.
    if let Some((x, y)) = place(app) {
        let position: Position = if LOGICAL_DESKTOP {
            LogicalPosition::new(x, y).into()
        } else {
            PhysicalPosition::new(x.round() as i32, y.round() as i32).into()
        };
        let _ = window.set_position(position);
    }
    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit_to(LABEL, SHOWN_EVENT, ());
}

fn hide_on_blur<R: Runtime>(window: &WebviewWindow<R>) {
    // Hiding a focused window also blurs it; only a panel that was still on
    // screen was dismissed by the click that took its focus.
    if !window.is_visible().unwrap_or(false) {
        return;
    }
    let _ = window.hide();
    if let Ok(mut hidden_at) = window.state::<PopupState>().hidden_on_blur_at.lock() {
        *hidden_at = Some(Instant::now());
    }
}

/// Whether the panel was just hidden by the same click that is toggling it.
/// The mark is consumed, so it can swallow at most one toggle.
fn hidden_by_this_click<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.state::<PopupState>()
        .hidden_on_blur_at
        .lock()
        .ok()
        .and_then(|mut hidden_at| hidden_at.take())
        .is_some_and(|at| at.elapsed() < BLUR_TOGGLE_GRACE)
}

/// Whether the desktop is laid out in logical units.
///
/// tao reports every position as "physical", but only Windows lays the
/// desktop out in physical pixels. macOS lays it out in points and GTK in
/// application pixels; there tao's "physical" value is the logical one times
/// the scale of whichever screen it came from, so a pointer on a Retina
/// display and the bounds of the display it is on disagree by a factor of
/// two until each is divided by its own screen's scale again. Comparing them
/// raw left the panel unplaced: the click fell outside every monitor.
const LOGICAL_DESKTOP: bool = cfg!(not(target_os = "windows"));

/// What a physical value on a screen of `scale` is multiplied by to land in
/// desktop coordinates.
fn desktop_factor(scale: f64) -> f64 {
    if LOGICAL_DESKTOP {
        1.0 / scale
    } else {
        1.0
    }
}

/// The screen under the pointer, or the primary one when the pointer cannot
/// be located (Wayland reports no position).
fn pointer_screen<R: Runtime>(app: &AppHandle<R>) -> Option<Screen> {
    let primary = app.primary_monitor().ok().flatten();
    // tao scales the pointer by the primary monitor, whichever screen it is on.
    let pointer_factor = desktop_factor(primary.as_ref().map_or(1.0, |m| m.scale_factor()));
    let screens: Vec<Screen> = app
        .available_monitors()
        .map(|monitors| monitors.iter().map(Screen::new).collect())
        .unwrap_or_default();

    app.cursor_position()
        .ok()
        .and_then(|pointer| {
            screen_at(
                screens,
                pointer.x * pointer_factor,
                pointer.y * pointer_factor,
            )
        })
        .or_else(|| primary.as_ref().map(Screen::new))
}

fn screen_at(screens: Vec<Screen>, x: f64, y: f64) -> Option<Screen> {
    screens
        .into_iter()
        .find(|screen| screen.bounds.contains(x, y))
}

/// One monitor, measured in desktop coordinates.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Screen {
    bounds: Area,
    /// The part not covered by the menu bar, dock or taskbar.
    work: Area,
    scale: f64,
}

impl Screen {
    fn new(monitor: &tauri::Monitor) -> Self {
        let scale = monitor.scale_factor();
        let (position, size, work) = (monitor.position(), monitor.size(), monitor.work_area());
        Self {
            bounds: Area::from_physical(
                f64::from(position.x),
                f64::from(position.y),
                f64::from(size.width),
                f64::from(size.height),
                scale,
            ),
            work: Area::from_physical(
                f64::from(work.position.x),
                f64::from(work.position.y),
                f64::from(work.size.width),
                f64::from(work.size.height),
                scale,
            ),
            scale,
        }
    }

    /// A length given in logical pixels, in desktop units on this screen.
    fn logical_length(&self, logical: f64) -> f64 {
        logical * self.scale * desktop_factor(self.scale)
    }

    fn panel_size(&self) -> (f64, f64) {
        (self.logical_length(WIDTH), self.logical_length(HEIGHT))
    }
}

/// A rectangle in desktop coordinates.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Area {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl Area {
    /// A rectangle tao reported as physical on a screen of `scale`.
    fn from_physical(x: f64, y: f64, width: f64, height: f64, scale: f64) -> Self {
        let factor = desktop_factor(scale);
        Self {
            x: x * factor,
            y: y * factor,
            width: width * factor,
            height: height * factor,
        }
    }

    fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && x < self.x + self.width && y >= self.y && y < self.y + self.height
    }
}

/// Centre the panel on the tray icon, on whichever side of it faces the
/// middle of the screen: below an icon in the macOS menu bar, above one in a
/// Windows taskbar, where "below" would be off the bottom of the screen.
fn beside_tray(icon: Area, work: Area, (width, height): (f64, f64), gap: f64) -> (f64, f64) {
    let x = icon.x + icon.width / 2.0 - width / 2.0;
    let y = if icon.y + icon.height / 2.0 < work.y + work.height / 2.0 {
        icon.y + icon.height + gap
    } else {
        icon.y - height - gap
    };
    clamp_into(x, y, (width, height), work)
}

/// Where a launcher sits: centred horizontally, a fifth of the way down.
fn launcher_position(work: Area, (width, height): (f64, f64)) -> (f64, f64) {
    let x = work.x + (work.width - width) / 2.0;
    let y = work.y + work.height / 5.0;
    clamp_into(x, y, (width, height), work)
}

/// Keep the whole panel inside the work area. A work area smaller than the
/// panel pins it to the top-left corner so the query bar stays reachable.
fn clamp_into(x: f64, y: f64, (width, height): (f64, f64), work: Area) -> (f64, f64) {
    let max_x = (work.x + work.width - width).max(work.x);
    let max_y = (work.y + work.height - height).max(work.y);
    (x.clamp(work.x, max_x), y.clamp(work.y, max_y))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PANEL: (f64, f64) = (680.0, 880.0);

    fn area(x: f64, y: f64, width: f64, height: f64) -> Area {
        Area {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn opens_below_a_menu_bar_icon() {
        // A 2x MacBook: menu bar 50px tall, icon at x = 2400.
        let icon = area(2400.0, 0.0, 44.0, 50.0);
        let work = area(0.0, 50.0, 3024.0, 1914.0);
        assert_eq!(beside_tray(icon, work, PANEL, 12.0), (2082.0, 62.0));
    }

    #[test]
    fn opens_above_a_taskbar_icon() {
        // 1080p Windows with a 48px taskbar at the bottom.
        let icon = area(1700.0, 1032.0, 40.0, 48.0);
        let work = area(0.0, 0.0, 1920.0, 1032.0);
        let (_, y) = beside_tray(icon, work, (340.0, 440.0), 6.0);
        assert_eq!(y, 1032.0 - 440.0 - 6.0);
    }

    #[test]
    fn stays_on_screen_for_an_icon_in_the_corner() {
        let icon = area(3000.0, 0.0, 24.0, 50.0);
        let work = area(0.0, 50.0, 3024.0, 1914.0);
        let (x, _) = beside_tray(icon, work, PANEL, 12.0);
        assert_eq!(x, 3024.0 - PANEL.0);
    }

    #[test]
    fn respects_a_secondary_monitor_origin() {
        // A monitor to the left of the primary one has negative coordinates.
        let work = area(-1920.0, 0.0, 1920.0, 1040.0);
        let (x, y) = launcher_position(work, (340.0, 440.0));
        assert_eq!((x, y), (-1920.0 + 790.0, 208.0));
    }

    /// A 2x built-in display with a 1x external one to its right, as tao
    /// reports them: each rectangle is logical × its own screen's scale.
    #[cfg(not(target_os = "windows"))]
    fn retina_with_external() -> Vec<Screen> {
        let screen = |x: f64, width: f64, height: f64, scale: f64| Screen {
            bounds: Area::from_physical(x * scale, 0.0, width * scale, height * scale, scale),
            work: Area::from_physical(
                x * scale,
                24.0 * scale,
                width * scale,
                (height - 24.0) * scale,
                scale,
            ),
            scale,
        };
        vec![
            screen(0.0, 1512.0, 982.0, 2.0),
            screen(1512.0, 1920.0, 1080.0, 1.0),
        ]
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn finds_the_retina_screen_under_the_pointer() {
        // tao reports the pointer at (1400, 10) points as (2800, 20). Compared
        // raw against physical bounds, x = 2800 falls inside the external
        // display's 1512..3432 instead; in desktop units it is on the laptop.
        let screen = screen_at(
            retina_with_external(),
            2800.0 * desktop_factor(2.0),
            20.0 * desktop_factor(2.0),
        )
        .unwrap();
        assert_eq!(screen.scale, 2.0);
        assert_eq!(screen.bounds, area(0.0, 0.0, 1512.0, 982.0));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn places_the_panel_under_a_retina_menu_bar_icon() {
        let screen = retina_with_external().remove(0);
        // tray-icon reports a 22x24 point icon at (1000, 0) points, times 2.
        let icon = Area::from_physical(2000.0, 0.0, 44.0, 48.0, screen.scale);
        let placed = beside_tray(
            icon,
            screen.work,
            screen.panel_size(),
            screen.logical_length(6.0),
        );
        assert_eq!(placed, (1011.0 - 170.0, 30.0));
    }

    #[test]
    fn pins_an_oversized_panel_to_the_top_left() {
        let work = area(100.0, 100.0, 300.0, 300.0);
        assert_eq!(clamp_into(250.0, 250.0, PANEL, work), (100.0, 100.0));
    }
}
