import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  site: "https://www.thfconstruction.com",

  vite: {
    plugins: [tailwindcss()],
  },

  devToolbar: {
    enabled: false,
  },

  // Google Reviews data layer (src/server/reviews). All server-only. The five
  // secrets are optional so a checkout without them builds and renders the
  // "not connected" state. REVIEWS_FIXTURE is honoured only by the dev server
  // off Netlify (see src/server/reviews/gate.ts).
  env: {
    schema: {
      GOOGLE_BP_CLIENT_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GOOGLE_BP_CLIENT_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GOOGLE_BP_REFRESH_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GOOGLE_BP_ACCOUNT_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GOOGLE_BP_LOCATION_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      REVIEWS_CACHE_TTL_SECONDS: envField.number({
        context: "server",
        access: "public",
        optional: true,
        default: 43200,
      }),
      REVIEWS_FIXTURE: envField.string({
        context: "server",
        access: "public",
        optional: true,
      }),
    },
  },

  // Serve Poppins locally with a metric-adjusted fallback while it loads.
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Poppins",
      cssVariable: "--font-poppins",
      weights: [400, 500, 600, 700, 800],
      styles: ["normal"],
      subsets: ["latin"],
    },
  ],

  // Adapter is required for the deferred reviews island (server:defer).
  // imageCDN stays off so hero images keep build-time optimization as before.
  adapter: netlify({
    imageCDN: false,
    devFeatures: {
      images: false,
      environmentVariables: false,
      edgeFunctions: false,
    },
  }),
});
