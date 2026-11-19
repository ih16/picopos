# Help walkthroughs

The Help page pairs written instructions with short, silent GIFs of the fictional demo shop. Each GIF plays automatically and loops while its guide is visible. Clicks zoom toward the selected control. Desktop captures use a 5:4 viewport and the mobile navigation guide uses a portrait viewport. A caption beneath each frame describes the action.

## Refresh the captures

1. Start the app locally with `npm run dev`.
2. Make Playwright with Chromium available for capture and install Python with Pillow 11 or later for rendering. Set `PLAYWRIGHT_MODULE` or `CHROMIUM_BIN` if using an external installation.
3. Run the capture script against the local app, then render the GIFs. Use a fresh frames directory for each run. To refresh one guide, append its ID to the capture command.

   ```sh
   node scripts/capture-help.mjs http://localhost:5173 /tmp/picopos-help-frames
   python3 scripts/build-help-gifs.py /tmp/picopos-help-frames public/help/examples
   ```

4. Open `/help/` and check the captions, click positions and result in the guide. Edit guide text in `src/features/help/help-content.ts` and capture actions in `scripts/capture-help.mjs`.

Each guide starts in a fresh browser context and selects Try the demo. Workbook connection, staff access and sync recovery have written instructions.
