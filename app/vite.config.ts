import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: el panell es pot penjar a qualsevol carpeta del subdomini de l'hotel.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
