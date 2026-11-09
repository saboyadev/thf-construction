<h1 style="text-align: center">THF Construction LLC</h1>

<img width="1440" alt="Screen Shot 2024-03-12 at 4 51 49 AM" src="https://github.com/SaboyaTech/thf-construction/assets/16430662/cd85399c-add8-48c9-a014-9f01eead80c8">

## Google reviews (Phase A complete; Phase B not started)

The Reviews section is a permanent `#reviews` wrapper holding a deferred server
island (`GoogleReviews.astro`) followed by the static charcoal invitation
(`ReviewInvitation.astro`). The island renders nothing unless it has a
populated result, so the invitation is the only thing visible until the Google
Business Profile integration is connected.

Server-only code lives in `src/server/reviews/` and must never be imported from
a client script:

| Module                              | Role                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `types.ts`                          | raw Google review shape, `ReviewsResult` (not-connected / ok / error), card model                 |
| `env.ts`                            | the only reader of secrets (`astro:env/server`)                                                   |
| `cache.ts`                          | freshness (12h), stale-serving limit (7d), deletion (14d) rules; pure, store injected             |
| `blob-store.ts` / `memory-store.ts` | Netlify Blobs store (Netlify only) / in-memory store (dev, tests)                                 |
| `provider.ts`                       | provider interface; Phase A placeholder that never contacts Google                                |
| `present.ts`                        | raw review → card: newest-updated first, six max, no rating filter, verbatim text                 |
| `fixtures.ts`, `gate.ts`            | synthetic local fixtures and the rule that allows them (dev server, off Netlify, explicit toggle) |
| `loader.ts`, `index.ts`             | orchestration and runtime wiring                                                                  |

Google fetching is **not implemented**: `provider.ts` is a placeholder and production renders the permanent invitation only, with no fixture reviews. Phase B (live Business Profile fetch, OAuth, cleanup enablement) has not started; eligibility is unconfirmed under Google Business Profile support case 8-8189000041674.

`netlify/functions/reviews-cache-cleanup.mts` is a daily scheduled function
that purges cache entries 14+ days old. It is a no-op unless
`REVIEWS_CLEANUP_ENABLED=true` is set in Netlify; Phase A leaves it unset.

### Environment variables (names only; values live in Netlify, never in the repo)

`GOOGLE_BP_CLIENT_ID`, `GOOGLE_BP_CLIENT_SECRET`, `GOOGLE_BP_REFRESH_TOKEN`,
`GOOGLE_BP_ACCOUNT_ID`, `GOOGLE_BP_LOCATION_ID` (secrets; all five required
to leave the not-connected state), `REVIEWS_CACHE_TTL_SECONDS` (default 43200),
`REVIEWS_CLEANUP_ENABLED` (scheduled function switch), `REVIEWS_FIXTURE`
(local dev only).

### Local fixtures

With the dev server only, and only when not running under Netlify:

```sh
REVIEWS_FIXTURE=populated pnpm dev   # eight synthetic reviews → six cards
REVIEWS_FIXTURE=empty pnpm dev       # successful empty → nothing rendered
REVIEWS_FIXTURE=error pnpm dev       # error state → nothing rendered (fixture bypasses the provider path, so no log line)
```

Production builds drop the fixture code path entirely.

### Tests and checks

```sh
pnpm test                                   # node:test, no framework
npx astro build && grep -rlE "GOOGLE_BP_|astro:env/server|mybusiness\.googleapis\.com|oauth2\.googleapis\.com|FIXTURE" dist/_astro dist/index.html dist/thanks/index.html   # must print nothing (fonts.googleapis.com is expected and excluded)
```

### Reconnect (Phase B)

If the refresh token is revoked: the profile owner repeats the OAuth consent in
the same OAuth client, replaces `GOOGLE_BP_REFRESH_TOKEN` in Netlify, and
triggers a new deploy (environment changes take effect on the next deploy).
Before disabling or removing the integration, purge the `google-reviews` Blobs
store manually so no review content outlives the integration.
