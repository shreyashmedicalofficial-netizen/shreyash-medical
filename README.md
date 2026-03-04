# Medico SaaS - Project Documentation

## 1. Project Overview
Medico SaaS is a hybrid serverless Pharmacy E-commerce web application featuring a customer-facing storefront and an exhaustive management dashboard. It uses a modern front-end (HTML/CSS/JS) tightly integrated with a Google Firebase serverless backend for real-time data syncs, along with a standalone Node.js server to handle email dispatches.

---

## 2. Architecture & File Structure

*   **/ (Root Level):** Customer UI pages (`index.html`, `login.html`, `products.html`, `checkout.html`, `cart.html`).
*   **/admin/:** Admin Dashboard interface components (`index.html`, `inventory.html`, `orders.html`).
*   **/assets/js/:** The definitive core logic of the entire client-side web application. Handled via ES6 Modules (`import`/`export`).
*   **/includes/:** Reusable UI components (`header.html`, `footer.html`) dynamically loaded into pages via Javascript Promises.
*   **/api/ & /old-php-admin/:** Legacy PHP/MySQL integration files.

---

## 3. Detailed Code & Method Explanations (Key Files)

Here are the details of the most critical files, their responsibilities, and key methods with their specific code locations.

### A. Customer Core Logic: `assets/js/app.js`
This is the primary javascript engine for the customer-facing side of the application. It manages session persistence, routing logic, shopping cart operations, and Firebase injections.

| Method / Logic | Approx Line Number | Responsibility |
| :--- | :--- | :--- |
| `DOMContentLoaded` | Line 19 | Bootstraps the application. It calls the header/footer includes, initializes authentication listeners, and resolves current page logic. |
| `loadIncludes()` | Line 38 | Fetches `includes/header.html` & `includes/footer.html` dynamically via the `fetch` API, injecting them into DOM containers. |
| `initStickyHeader()` | Line 75 | Attaches a scroll event listener specifically to toggle physical padding and classes when scrolling past the top navigation bar. |
| `initAuthListener()` | Line 110 | Triggers Firebase's `onAuthStateChanged`. Extracts User details and fetches existing internal mapping from `users/{uid}` in the Realtime Database. Triggers `initCartListener()` once authed. |
| `loadCheckout()` | Line 147 | Triggers upon visiting `checkout.html`. Fetches the logged-in user's cart from Realtime DB (`users/{uid}/cart`), matches to product IDs, and calculates totals. |
| `renderCheckoutUI()` | Line 194 | Generates the literal HTML payload injected for finalizing an order. Connects standard push interactions into the `orders` collection (Line 318). |
| `handleLogout(e)` | Line 409 | Invokes Firebase `signOut(auth)` globally, killing the active session and redirecting back to `index.html`. |
| `initCartListener(uid)` | Line 474 | Real-time Firebase watcher (`onValue`). Every time the cart node updates in the DB, it syncs the UI badge and recalcs the side-cart total simultaneously. |
| `addToCart(productId)` | Line 506 | Pushes a single item into the player's Firebase cart node. Creates a new object if missing otherwise increments `qty` using a transaction/update. |
| `updateSideCartUI(cartData)` | Line 590 | Creates the visual off-canvas sidebar cart. Pulls data specifically using the multi-promise lookup method (`fetchProductsByIds`). |
| `initPageLogic()` | Line 658 | The primary router script. Identifies the `window.location.pathname` and conditionally triggers data loads corresponding to the specific page. |

---

### B. Admin Dashboard Logic: `admin/index.html` 
Instead of rendering through standard server templating, the admin dashboard statically exists but paints its data interactively using Firebase Event Listeners directly inside `<script>` blocks.

| Method / Logic | Approx Line Number | Responsibility |
| :--- | :--- | :--- |
| HTML Structure | Line 1 - 320| Hard-codes Bootstrap 5 elements, FontAwesome, sidebars and Quick Status tiles. Maintains skeleton loaders for dynamic IDs like `recentOrdersList`. |
| `initChart()` | Line 334 | Initializes Chart.js on the dashboard mimicking the `salesChart` canvas using dynamic graph sets mapping a 1000 rupee increment schema. |
| `ordersRef` Hook | Line 400 | Implements a heavily restricted fetch request using Firebase `query(..., limitToLast(100))` to scrape up to 100 latest global orders efficiently. |
| Order Renderer | Line 402 - 488| Within the `onValue` subscription, it evaluates the `createdAt` timestamps, dynamically builds Bootstrap Table rows `<tr>`, and dictates the proper CSS payload for badge status colors. |
| `productsRef` Hook | Line 491| Subscribes to the complete `products` node explicitly to compare `branch_stock` properties against strict thresholds (e.g. `< 10` units) and fires `lowStockCount` totals. |

---

### C. Node Email Microservice: `server.js`
A standalone backend microservice resolving cross-origin (CORS) local REST calls specifically tailored to fire off system emails via `nodemailer`.

| Method / Logic | Approx Line Number | Responsibility |
| :--- | :--- | :--- |
| `transporter` | Line 7 | Configures `nodemailer` using a Gmail SMTP service user identity. |
| `http.createServer` | Line 15 | Initializes the vanilla Node HTTP instance over port `3000`. |
| `OPTIONS` Pre-Flight | Line 22 | Sets the server up to handle HTTP pre-flight interactions natively to prevent browser CORS blocks during Javascript `POST` hits. |
| `POST /send-email` | Line 28 | The only authorized endpoint. Awaits a JSON payload, constructs dynamic HTML templates, and fires off standard `transporter.sendMail(...)` callbacks returning HTTP 200. |

---

### D. Legacy PHP Endpoints: `api/auth.php`
Before migrating completely to Firebase, the application possessed PHP backend capabilities targeting local `.sql` imports.

| Method / Logic | Approx Line Number | Responsibility |
| :--- | :--- | :--- |
| DB Connectivity | Line 3 | Uses PHP `include` to capture global PDO variables from `config/db.php`. |
| action: `register` | Line 8 | Extracts raw form POSTs. Uses `password_hash()` to securely register user lines into the MySQL target. |
| action: `login` | Line 40 | Queries emails, specifically extracting Left Join checks over the `branches` table identifying staff/admin roles alongside standard users. |

---

## Final Notes
The application architecture is beautifully decoupled. Because frontend interactions (`cart.html`, admin `ordersList`) connect natively to Firebase, this makes it completely scalable.

**Refactoring Consideration:** Changing structural naming schemas across variables or IDs in `.html` containers will immediately sever database callbacks. Ensure `document.getElementById` and class mappings track accurately across updates.
