import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#e2e8f0",
        signal: "#0ea5e9",
      },
    },
  },
  plugins: [],
};

export default config;
