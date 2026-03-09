import { defineConfig } from "orval";

export default defineConfig({
  cryoWiring: {
    input: "./openapi.json",
    output: {
      mode: "tags-split",
      target: "src/api/endpoints",
      schemas: "src/api/models",
      client: "fetch",
      baseUrl: "",
      override: {
        mutator: {
          path: "src/api/fetcher.ts",
          name: "customFetch",
        },
      },
    },
  },
});
