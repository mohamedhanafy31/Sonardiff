# App 2 — JS-Rendered SPA Target
Simulates a product page rendered via client-side JavaScript.
Port: 3011
Endpoints:
- GET / : View JS-rendered page (renders after 800ms)
- POST /set-data : Update product info (JSON body: { price: number, inStock: boolean })
