const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let state = {
  productName: "Neural Link VR Headset",
  price: 599.99,
  inStock: true
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>App 2 - JS Target</title>
        <style>
            body { font-family: sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; max-width: 400px; }
            .price { font-size: 2rem; font-weight: bold; color: #22d3ee; margin: 1rem 0; }
            .badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; }
            .in-stock { background: #065f46; color: #34d399; }
            .out-of-stock { background: #7f1d1d; color: #f87171; }
            button { background: #2563eb; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600; margin-top: 1rem; transition: background 0.2s; }
            button:hover { background: #1d4ed8; }
            #loading { color: #64748b; font-style: italic; }
        </style>
    </head>
    <body>
        <div id="app">
            <p id="loading">Initializing Neural Interface...</p>
        </div>

        <script>
            // Simulate dynamic data loading
            const data = ${JSON.stringify(state)};
            
            setTimeout(() => {
                const app = document.getElementById('app');
                app.innerHTML = \`
                    <div class="card">
                        <h1>\${data.productName}</h1>
                        <div class="price">$\${data.price}</div>
                        <div class="stock">
                            <span class="badge \${data.inStock ? 'in-stock' : 'out-of-stock'}">
                                \${data.inStock ? 'In Stock' : 'Out of Stock'}
                            </span>
                        </div>
                        <button id="add-to-cart">Add to Cart</button>
                    </div>
                \`;

                document.getElementById('add-to-cart').onclick = function() {
                    this.innerText = 'Added!';
                    this.style.background = '#059669';
                };
            }, 800);
        </script>
    </body>
    </html>
  `);
});

app.post('/set-data', express.json(), (req, res) => {
  state = { ...state, ...req.body };
  res.json({ message: "Product data updated", state });
});

app.listen(port, () => {
  console.log(`App 2 listening at http://localhost:${port}`);
});
