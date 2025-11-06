import "./App.css";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";

function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

export default App;
