import { defineConfig } from "@sanity/pkg-utils";

export default defineConfig({
  tsconfig: "tsconfig.json",
  extract: {
    rules: {
      "ae-missing-release-tag": "warn",
    },
  },
});
