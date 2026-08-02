# Website integration

PoppyShuffle ships a public-facing catalog + wishlist widget in `embed/` so a marketing site (e.g. poppycreates.com) can show rentals and collect quote requests without any backend.

## Embed the catalog

`embed/catalog.html` is a standalone page. Drop it into any website with an iframe:

```html
<iframe
  src="https://bryanhempstead.github.io/katelynn/poppyshuffle/embed/catalog.html"
  title="The Poppy Creative — rental catalog"
  style="width:100%; min-height:900px; border:0;"
  loading="lazy"></iframe>
```

Self-hosting the app? Point `src` at your own `/poppyshuffle/embed/catalog.html`. You can also link to the page directly instead of framing it.

## Wishlist → quote flow

1. A visitor browses the embedded catalog and adds items to a **wishlist** (name, email, event date, items + quantities).
2. The widget produces a **wishlist JSON** blob (download / copy) — there is no server, so the visitor sends it to you (email, contact form attachment, etc.).
3. In the app, open **Settings → Import wishlist** and paste or upload the JSON.
4. PoppyShuffle creates (or matches) the client and creates a new **project in `quote` status** with the wishlist items as line items at current catalog prices — ready for the normal quote → contract → invoice flow, with availability conflicts checked like any other quote.

## Future: a hosted backend

The flow is deliberately POST-shaped so a tiny backend can replace the manual hand-off later:

- The widget would `fetch(POST)` the same wishlist JSON to an endpoint (e.g. `POST /api/wishlists`) instead of downloading it.
- The endpoint stores submissions; the app polls or imports them into the same Settings → Import wishlist pipeline (payload format unchanged).
- Nothing in the app's data model needs to change — the wishlist JSON is the contract.
