DOM Picker — Bug Fixes & Improvement Plan
Files in scope:
·	artifacts/mvp/frontend/src/components/monitors/DomPickerModal.tsx
·	artifacts/mvp/backend/src/lib/dom-picker-session.ts
·	artifacts/mvp/backend/src/routes/dom-picker.ts

Legend
·	Done
·	To do

Bug 1 — Page content below the fold renders black ✅
Root cause: fullPage: true captures the full document height but lazy-loaded

JavaScript/images never trigger because the headless browser never scrolled.
Fix applied: dom-picker-session.ts → launch() — viewport-step auto-scroll

(capped at 20 000 px, 120 ms per step) with a 600 ms settle, then scroll back to

top + 300 ms before the session is stored.
·	Auto-scroll through the page on first launch to trigger lazy rendering
·	Cap at 20 000 px to avoid hanging on infinite-scroll pages
·	Scroll back to top + settle before session is returned to callers

Bug 2 — Dashboard page scrolls behind the modal ✅
Root cause: No overflow: hidden on document.body when the modal is open.

When the inner overflow-y-auto div hits its scroll boundary, events bubble to the

window and scroll the page behind the backdrop.
Fix applied: DomPickerModal.tsx — useEffect sets

document.body.style.overflow = 'hidden' on open and restores it on close.
·	Lock body scroll when modal opens
·	Restore body scroll on modal close / unmount

Bug 3 — Hover highlight freezes after scrolling ✅
Root cause: handleMouseMove only fires on physical mouse movement. Scrolling

shifts the image under a stationary cursor, leaving the yellow overlay pointing at

the wrong element.
Fix applied: DomPickerModal.tsx — onScroll={handleScroll} on the

overflow-y-auto content div clears hovered state on every scroll event (unless

an element is already confirmed-picked).
·	handleScroll clears stale hover on scroll
·	onScroll wired to the scrollable content div

Bug 4 — Cached sessions skip auto-scroll
Root cause: getSessionPage() reuses browser sessions for up to 2 minutes.

Auto-scroll only runs inside launch() (first use). A cache hit returns immediately,

so a re-opened picker within 2 min may still show black areas if the page had

additional lazy content that loaded after the initial settle.
Fix:
·	Extract auto-scroll logic into scrollAndSettle(page: Page): Promise<void>

in dom-picker-session.ts
·	Call scrollAndSettle inside the /screenshot route handler every time,

before page.screenshot(), instead of only at session launch
·	Remove the duplicate scroll-and-settle block from launch() (it will be

handled by the route)
·	Rebuild backend: pnpm --filter sonardiff-backend run build

Bug 5 — Overlay label clips above the image for top-edge elements
Root cause: The selector label is positioned at

top: calc(<top%> - 18px). When the selected element sits at the very top of the

screenshot, this resolves to a negative value and the label is clipped.
Fix: DomPickerModal.tsx — label positioning
·	Replace bare calc(${overlayStyle(overlayBox)?.top} - 18px) with a

conditional: if the element's top % is < 2 %, render the label below the

element instead (add element height % + 2 px offset)
·	Alternatively use max(): top: max(2px, calc(<top%> - 18px))

Bug 6 — Element cap (1 200) drops interactive elements on large pages
Root cause: /screenshot slices elements to els.slice(0, 1200) before

sending to the client. Long pages or single-page apps with complex DOMs exceed

this limit; elements deep in the page tree cannot be hovered or picked.
Fix: dom-picker.ts → /screenshot route
·	Before slicing, filter to elements where width ≥ 50 && height ≥ 20

(skips invisible wrappers and hairline rules)
·	Raise the hard cap from 1 200 to 2 500 and measure payload — JPEG base64

already dominates response size; element JSON is small
·	If payload becomes a concern, send element metadata separately from the

screenshot in two parallel requests

Bug 7 — getUniqueSelector and describe duplicated across 3 routes
Root cause: Both helpers are copy-pasted verbatim into /screenshot, /resolve,

and /inspect-selector inside dom-picker.ts. A bug fix must be applied in 3 places.
Fix: dom-picker.ts
·	Extract the two helpers into a top-level template-literal string constant
const DOM_HELPERS = \...`at the top ofdom-picker.ts`
·	Each page.evaluate(async ({ ... }) => { <DOM_HELPERS>; ... }) call injects

the helpers string via eval or by prepending it to the evaluate callback source
·	Or: inject once via page.addScriptTag({ content: DOM_HELPERS }) on session

init, then all evaluate calls can reference the global functions directly
·	Rebuild and verify all three routes (/resolve, /inspect-selector,
/screenshot) still return correct selectors

Improvement — "Refresh screenshot" button
Problem: Screenshots are stale when a session is reused within the 2-min TTL.

Users have no way to force a re-capture.
Plan:
·	Add a circular-arrow RefreshCw icon button to the modal header

(DomPickerModal.tsx), visible only after the screenshot loads
·	Clicking it: call api.post('/dom-picker/close-session', { url }), then

reset screenshot, elements, hovered, picked, marker to initial state

and re-trigger the screenshot useEffect
·	No backend changes needed — /dom-picker/close-session already exists

Improvement — Resolve --hide-scrollbars layout shift
Problem: --hide-scrollbars in PLAYWRIGHT_ARGS removes native scrollbars,

adding ~15 px to the effective page width. Elements near the right edge of the page

appear shifted right compared to what a normal browser (with scrollbars) shows.
Options:
·	Option A (recommended): Remove --hide-scrollbars from PLAYWRIGHT_ARGS.

Scrollbars appear in the screenshot but element coordinates match what users see.
·	Option B: Keep --hide-scrollbars and reduce viewport width:
viewport: { width: 1425, height: 900 } (1 440 − 15 scrollbar px).
·	Verify element coordinate accuracy after whichever option is applied by

comparing pick positions on a known layout.

Testing checklist (run after all items above are done)
·	Open picker on a page with lazy-loaded images — no black sections visible
·	Re-open picker on same URL within 2 min — screenshot is still complete (Bug 4)
·	Scroll the screenshot to the bottom — dashboard page does NOT scroll behind modal (Bug 2)
·	Hover an element, scroll without moving mouse — yellow highlight clears (Bug 3)
·	Pick an element at the very top of the screenshot — label renders below, not clipped (Bug 5)
·	Open picker on a page with > 1 200 DOM nodes — can hover and pick elements deep in the page (Bug 6)
·	Click "Refresh" button — stale session closed and fresh screenshot loaded (Improvement)
·	Pick a nav element (right-side) — coordinates match actual layout (scrollbar fix)
