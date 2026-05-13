const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let proPrice = 20;

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>SaaSFlow Pricing</title>
        <style>
            body { font-family: sans-serif; padding: 4rem 2rem; background: #f8fafc; color: #1e293b; text-align: center; }
            .grid { display: flex; justify-content: center; gap: 2rem; max-width: 1000px; margin: 3rem auto; }
            .plan { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 2rem; flex: 1; display: flex; flex-direction: column; }
            .plan.featured { border: 2px solid #3b82f6; transform: scale(1.05); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
            .name { font-weight: bold; font-size: 1.25rem; color: #64748b; margin-bottom: 1rem; }
            .price { font-size: 3rem; font-weight: 800; margin-bottom: 1.5rem; }
            .price span { font-size: 1rem; color: #94a3b8; font-weight: normal; }
            ul { list-style: none; padding: 0; margin: 0; text-align: left; flex-grow: 1; }
            li { padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; font-size: 0.9375rem; }
            li:last-child { border-bottom: none; }
            button { width: 100%; margin-top: 2rem; padding: 0.75rem; border-radius: 0.5rem; border: none; font-weight: bold; cursor: pointer; background: #f1f5f9; color: #1e293b; }
            .featured button { background: #3b82f6; color: white; }
        </style>
    </head>
    <body>
        <h1>Simple, Transparent Pricing</h1>
        <p>Choose the plan that's right for your business growth.</p>

        <div class="grid">
            <div id="plan-free" class="plan">
                <div class="name">Free</div>
                <div class="price">$0<span>/mo</span></div>
                <ul>
                    <li>Up to 5 Projects</li>
                    <li>Basic Analytics</li>
                    <li>Community Support</li>
                    <li>1GB Storage</li>
                    <li>Standard API Access</li>
                </ul>
                <button>Get Started</button>
            </div>

            <div id="plan-pro" class="plan featured">
                <div class="name">Pro</div>
                <div class="price">$${proPrice}<span>/mo</span></div>
                <ul>
                    <li>Unlimited Projects</li>
                    <li>Advanced Analytics</li>
                    <li>24/7 Priority Support</li>
                    <li>10GB Storage</li>
                    <li>Custom Domain</li>
                </ul>
                <button>Try Pro Free</button>
            </div>

            <div id="plan-enterprise" class="plan">
                <div class="name">Enterprise</div>
                <div class="price">$99<span>/mo</span></div>
                <ul>
                    <li>White-label Solutions</li>
                    <li>Dedicated Account Manager</li>
                    <li>Custom SLA</li>
                    <li>Unlimited Storage</li>
                    <li>On-premise Deployment</li>
                </ul>
                <button>Contact Sales</button>
            </div>
        </div>
    </body>
    </html>
    `);
});

app.post('/update-pro-price', express.json(), (req, res) => {
    const val = parseInt(req.body.value);
    if (!isNaN(val)) {
        proPrice = val;
        res.json({ message: "Pro price updated", proPrice });
    } else {
        res.status(400).json({ error: "Invalid price" });
    }
});

app.listen(port, () => {
    console.log(`App 5 listening at http://localhost:${port}`);
});
