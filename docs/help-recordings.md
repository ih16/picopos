# Help recordings

The in-app `/help/` page includes 14 silent, captioned walkthrough videos and 51 browser screenshots captured on 19 November 2026. Videos are timed sequences of actual browser screenshots, not continuous cursor recordings. The illustrated steps provide the same instructions without requiring video playback.

## Coverage

- Demo entry and connection screen.
- Desktop navigation, customer tabs, mobile tab switcher, and dark appearance.
- Sales report, estimated costs, custom dates, and a full-year report.
- Product creation and saved result; product editing, photo controls, options, variant creation/editing, and active status controls.
- Nested category creation and saved result.
- Customer search, contact details, and order history.
- Draft creation with two units, missing-shipping validation, and local pickup.
- The same demo order in Draft, In progress, Shipped, and Completed states.
- Payment choices and their independence from fulfilment.
- Partial return request and saved request; sellable and damaged receipt forms.
- Stock search and all five movement previews, including invalid restocking with no unavailable stock.
- Stock entries, purchase lots, linked entries, and an unsaved lot editor example.
- Currency and shipping settings, including an unsaved express-delivery rate.

Captions distinguish saved outcomes from prepared forms. Google sign-in, spreadsheet sharing, live sync, offline recovery, image upload, customer edit saves, cancellation, payment changes, and successful return receipt are not recorded end to end. Existing written guides cover those operations. Google and offline examples need a disposable connected workbook and, for offline shell verification, a production build.

## Refreshing media

1. Use a fresh local demo session and fictional data. Do not capture a real customer workbook.
2. Capture the browser at each step and save JPEGs in `public/help/examples/`.
3. Update the single manifest in `src/features/help/help-examples.ts`. Keep captions accurate about what was actually saved.
4. Install FFmpeg separately, then run:

   ```sh
   node --experimental-strip-types scripts/build-help-videos.mjs
   ```

   Set `FFMPEG_BIN` to an absolute encoder path if it is not on PATH. The script generates H.264 MP4 files and English WebVTT tracks. Each step lasts six seconds. No video tooling is needed to run or build the app.

5. Check the captions, play a video in `/help/`, test a caption phrase in search, and inspect desktop and mobile layouts. Run the normal type, test, and build checks.

Videos use native controls and `preload="none"`; screenshots load lazily and link to full-size originals. The media is deliberately outside the offline shell's precached asset directories.

## Capture observations

Existing mounted app tabs sometimes retained old data after demo saves. Closing and reopening the relevant app tab showed the saved product, category, and order status. The order confirmation also changed stock reservations. This documentation change does not fix that refresh issue.

Automatic browser approval review blocked saving the seeded customer's notes as a suspected real customer edit. The captured directory walkthrough is read-only. The demo commit path in `src/app/use-workbook.ts` updates in-memory demo data separately from connected workbook storage.

The attempted receipt of the example requested return did not visibly become Received, so the walkthrough ends with the saved request and labels receipt screenshots as form examples.
