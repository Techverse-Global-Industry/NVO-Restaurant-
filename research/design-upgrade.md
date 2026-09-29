# Royal design upgrade

24 September 2026. Direction: deep blue, warm white, gold details, authentic food imagery and a discreet illustrated host. The website now has a layered food hero, framed dishes, a kitchen film, an editorial spotlight, occasion cards, a journal and a stronger visit invitation. The staff experience has grouped navigation, task cards, photo deletion and contextual chef guidance.

All food media in this upgrade comes from the supplied NVO folder. Instagram `nvo_benin` could not be retrieved during research; no unrelated restaurant images were substituted. Six additional supplied images were exported as WebP. The short kitchen video was exported with fast-start playback and no audio; the original is preserved. Archived flyers are labelled and are not current price or promotion promises. The supplied nutrition video was not published because its health claims were not verified.

The chef is an original SVG illustration, not a claim about the identity of a real NVO employee. It introduces itself visually once per browser session, with reduced-motion support. Speech is opt-in and uses the browser’s available voice. Admin guidance describes the real controls; it is not represented as a connected AI assistant.

Sample stories, occasion concepts and a spotlight are database records. Staff can edit, archive or hide them through one setting. No sample orders, paid sales, customer reviews, winners or redeemable offers were created. Sample mode is deliberately noindex; turn it off before launch.

SEO follows [Google’s LocalBusiness guidance](https://developers.google.com/search/docs/appearance/structured-data/local-business), [Next.js metadata conventions](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), and [social share image conventions](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image). Root loading streaming was removed so missing content can return a real HTTP 404 rather than a streamed 200; see [Next.js loading/status-code guidance](https://nextjs.org/docs/app/api-reference/file-conventions/loading).

Fonts are served locally, with the original SIL Open Font License files in `public/fonts`. Food images use responsive Next.js image delivery where applicable. The video does not load until requested. Animation respects reduced-motion settings.

Reproducible audit scripts and launch requirements are in the [project README](../README.md). Final audit output and screenshots are under `artifacts/` (ignored by Git).

## Recorded verification

The production build and all 11 business-rule tests passed. The original ordering/reservation/admin browser suite passed. The design suite passed with no browser runtime errors, including staff draft → publish → archive, upload → referenced-photo protection → deletion, video playback, sample visibility, real 404 responses, canonical metadata and restaurant structured data. Seven routes had zero violations in the selected axe WCAG 2 A/AA and 2.1 AA rules.

Final local mobile Lighthouse run, with sample content disabled on a separate test database: **Performance 95, Accessibility 100, Best Practices 100, SEO 100**. First contentful paint: 1.2 seconds; largest contentful paint: 2.5 seconds; total blocking time: 190 ms. The chef-container layout shift was corrected. These are laboratory measurements; production hosting, devices and network conditions will affect results. A 100 SEO audit score does not guarantee Google rankings. Further image-byte and JavaScript savings remain possible.

The actual owner preview retains sample content and therefore remains noindex. Production requires the real domain, approved content, sample mode off and live Search Console verification. Social account publishing remains unconnected; the tested publishing flow publishes to the website.
