const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let inStock = true;

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Stock Monitor</title>
        <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f1f5f9; }
            .card { background: #fff; padding: 3rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }
            .badge { padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: bold; font-size: 1.25rem; display: block; margin: 1.5rem 0; }
            .in-stock { background: #dcfce7; color: #166534; }
            .out-of-stock { background: #fee2e2; color: #991b1b; }
            button { background: #1e293b; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>RTX 5090 Super Founders Edition</h2>
            <span class="badge ${inStock ? 'in-stock' : 'out-of-stock'}">
                ${inStock ? 'In Stock' : 'Out of Stock'}
            </span>
            <form action="/toggle-stock" method="POST">
                <button type="submit">Manual Toggle</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

app.post('/toggle-stock', (req, res) => {
    inStock = !inStock;
    if (req.headers['accept'] === 'application/json') {
        res.json({ inStock });
    } else {
        res.redirect('/');
    }
});

app.listen(port, () => {
    console.log(`App 6 listening at http://localhost:${port}`);
});
