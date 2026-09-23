---
description: This file describes the global coding guidelines for the project.
# applyTo: 'Describe when these instructions should be loaded by the agent based on task context' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

<!-- Tip: Use /create-instructions in chat to generate content with agent assistance -->

This application is built using SvelteKit, a modern framework for building web applications. The project follows best practices for SvelteKit development, including the use of TypeScript, proper file organization, and adherence to coding standards.

When working on this project, please follow these guidelines:
You must make sure the svelte code is properly formatted and follows the SvelteKit conventions. Use the official SvelteKit documentation as a reference for best practices and coding standards.

When writing code, ensure that it is well-structured, readable, and maintainable. Use meaningful variable and function names, and include comments where necessary to explain complex logic.

We are hosted by vercel, so make sure to follow their deployment guidelines and best practices for optimizing performance and scalability.

Architecture: how the xlister Chrome extension fits into this app

This repository is a SvelteKit web app that integrates with a separate Chrome extension located at ../xlister-chrome-extension. The extension is required because the app must interact with Poshmark in a browser context that can read the authenticated Poshmark page state, cookies, and page data. The app itself cannot directly access the Poshmark site from the web app in a safe or authenticated way, so the extension acts as the bridge between the user-facing app and the Poshmark page.

The extension is a Manifest v3 Chrome extension with three main pieces:

- background.js: the service worker that owns the extension-wide coordination. It listens for messages from the app and from content scripts, finds or opens the Poshmark tab, reads user state from the page, and forwards requests to the right Poshmark tab.
- poshmark.js: a content script that is injected into every Poshmark page. This script is the page-side automation layer. It detects whether the page is loaded, scrapes sold items using the logged-in Poshmark API/endpoints, extracts order data from the page state, and watches the final listing flow to detect when the user clicks the final “List This Item” button.
- forwarder.js: the bridge that runs on the Svelte app origin (localhost:5173 or the Vercel app). It listens for window.postMessage events from the Svelte app, forwards them to chrome.runtime.sendMessage, and then mirrors responses back to the app with window.postMessage.

The message contract is the authoritative integration pattern. The app should not call the extension via direct DOM access or custom undocumented APIs. Use the existing event/message schema:

- CHECK_POSHMARK_TAB
- CHECK_POSHMARK_TAB_USER_LOGGED_IN
- IMPORT_POSHMARK_SOLD_ITEMS
- OPEN_POSHMARK_TAB
- CREATE_POSHMARK_LISTING
- POSHMARK_SOLD_DATA
- POSHMARK_LISTING_CREATED
- CHECK_POSHMARK_TAB_RESPONSE
- CHECK_POSHMARK_TAB_USER_LOGGED_IN_RESPONSE

Important workflow rules:

1. The app posts messages to window using window.postMessage({ type: ... }, "*") from the app runtime.
2. The content script on the app origin (forwarder.js) receives those events and calls chrome.runtime.sendMessage(...).
3. background.js decides which Poshmark tab to use, reads the current Poshmark tab state, and forwards work to the proper tab or page.
4. poshmark.js performs the real work on the Poshmark page, such as scraping sold items or handling the listing flow.
5. Results are sent back through the same chain: poshmark.js/background.js/forwarder.js/window.postMessage to the app.

What the extension does

- Verifies whether a Poshmark tab is already open.
- Checks whether the user is logged in by reading the page state from the main world and looking for the Poshmark user UID.
- Opens a Poshmark tab when needed.
- Imports sold items for a given date range by calling the logged-in Poshmark data endpoints from within Poshmark’s authenticated browser context.
- Extracts additional order detail, such as earnings, from the page HTML or initial state object.
- Passes listing creation data from the app to the Poshmark listing flow so the user can create a listing from the app’s product data.
- Detects the final listing submission CTA and signals that the listing was created.

How it works in practice

- The app is the orchestrator and UI layer.
- The extension is the browser automation and auth-aware bridge layer.
- Poshmark is the remote third-party site we need to interact with via a logged-in browser session.
- The extension has host permissions for Poshmark and for the app origins (localhost and production Vercel). This is intentional and required.
- The extension reads the live page state from window.__INITIAL_STATE__ in the main world to retrieve data like the logged-in user UID without relying on a fragile intermediary script.
- When a page must be scraped, the extension does not just fetch from the app server; it calls the browser on the authenticated Poshmark page and reads the existing session data already present there.

When modifying the integration, do not break the message contract or the host permissions. Any new extension behavior should also be mirrored in the frontend code and must preserve the existing app-to-extension-to-Poshmark flow.

For this project, treat the extension as a required partner system, not as an optional utility. Changes to the app or extension must remain compatible with one another.

