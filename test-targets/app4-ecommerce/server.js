const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let price = 129.99;
const products = ["Zenith X1", "Aura G2", "Nebula Pro", "Quantum Lite", "Titan S3", "Echo Wave", "Vortex Plus", "Nova Prime"];

function getRandomProducts(count) {
    return [...products].sort(() => 0.5 - Math.random()).slice(0, count);
}

app.get('/', (req, res) => {
    const recommended = getRandomProducts(4);
    const viewed = getRandomProducts(3);
    const servedAt = new Date().toISOString();

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>EcoShop - Product Detail</title>
        <style>
            body { font-family: sans-serif; display: grid; grid-template-columns: 1fr 300px; gap: 2rem; padding: 2rem; background: #fff; }
            .main { border: 1px solid #eee; padding: 2rem; border-radius: 0.5rem; }
            .sidebar { border: 1px solid #eee; padding: 1.5rem; border-radius: 0.5rem; background: #fafafa; }
            .price-tag { font-size: 2.5rem; font-weight: bold; color: #16a34a; margin: 1rem 0; }
            .sidebar h3 { margin-top: 0; font-size: 1rem; color: #666; text-transform: uppercase; }
            .list-item { padding: 0.5rem 0; border-bottom: 1px solid #eee; font-size: 0.9rem; }
            .list-item:last-child { border-bottom: none; }
            .footer { grid-column: span 2; font-size: 0.75rem; color: #999; text-align: center; margin-top: 2rem; }
        </style>
    </head>
    <body>
        <div class="main">
            <span style="color: #666;">Home > Electronics > Audio</span>
            <h1>SonicMax Ultra Wireless Headphones</h1>
            <p>Experience studio-quality sound with our most advanced noise-canceling technology yet. 40-hour battery life and ergonomic design.</p>
            <div class="price-tag" id="product-price">$${price}</div>
            <div style="background: #dcfce7; color: #166534; padding: 0.5rem 1rem; border-radius: 4px; display: inline-block; font-weight: bold;">
                IN STOCK
            </div>
            
            <div style="margin-top: 2rem;">
                <h3>Customers also viewed</h3>
                <div style="display: flex; gap: 1rem;">
                    ${viewed.map(p => `
                        <div style="border: 1px solid #eee; padding: 1rem; border-radius: 4px; flex: 1; text-align: center;">
                            <div style="height: 60px; background: #eee; margin-bottom: 0.5rem;"></div>
                            <div style="font-size: 0.8rem; font-weight: bold;">${p}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <aside class="sidebar">
            <h3>Recommended For You</h3>
            <div>
                ${recommended.map(p => `<div class="list-item">${p}</div>`).join('')}
            </div>
        </aside>

        <div class="footer">
            Page served at: <span id="timestamp">${servedAt}</span> | System ID: ${Math.random().toString(36).substring(7)}
        </div>
    </body>
    </html>
    `);
});

app.get('/set-price', (req, res) => {
    const newVal = parseFloat(req.query.value);
    if (!isNaN(newVal)) {
        price = newVal;
        res.json({ message: "Price updated", price });
    } else {
        res.status(400).json({ error: "Invalid price value" });
    }
});

app.listen(port, () => {
    console.log(`App 4 listening at http://localhost:${port}`);
});
