import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const storedTheme = localStorage.getItem("timbo_theme");
// Lo aplicamos acá para que no parpadee el tema al cargar
document.documentElement.dataset.theme = storedTheme === "dark" ? "dark" : "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
