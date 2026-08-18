import "./App.css";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { PopupPage } from "@/features/popup";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const isPopupWindow = getCurrentWebviewWindow().label === "popup";

function App() {
  return (
    <AppProviders>
      {isPopupWindow ? <PopupPage /> : <AppRouter />}
    </AppProviders>
  );
}

export default App;
