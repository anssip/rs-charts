interface Config {
  apiBaseUrl: string;
}

// Use import.meta.env for Bun's build-time environment variables
export const config: Config = {
  apiBaseUrl: import.meta.env.API_BASE_URL || "http://localhost:8080",
};
