declare module "@tauri-apps/plugin-autostart" {
  /**
   * Register the current application to start automatically with the OS.
   */
  export function enable(): Promise<void>;

  /**
   * Remove the application's autostart registration.
   */
  export function disable(): Promise<void>;

  /**
   * Returns whether the application is currently registered to start
   * automatically with the OS.
   */
  export function isEnabled(): Promise<boolean>;
}

