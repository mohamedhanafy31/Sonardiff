const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let headline = "Global Economy Shows Resilience Amidst Volatility";

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>App 3 - High Noise News</title>
        <style>
            body { font-family: 'Georgia', serif; padding: 2rem; max-width: 800px; margin: auto; background: #fff; color: #333; }
            header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 0.5rem; margin-bottom: 2rem; }
            .clock { font-family: monospace; font-weight: bold; font-size: 1.2rem; }
            .ad-banner { background: #fef3c7; border: 1px solid #f59e0b; padding: 1rem; text-align: center; margin-bottom: 2rem; font-style: italic; color: #92400e; }
            .featured { background: #f1f5f9; padding: 2rem; border-radius: 0.5rem; }
            .featured h2 { margin-top: 0; font-size: 2.5rem; }
            .featured p { line-height: 1.6; font-size: 1.1rem; }
        </style>
    </head>
    <body>
        <header>
            <div class="date">Date: <span id="current-date"></span></div>
            <div class="clock" id="live-clock">00:00:00</div>
        </header>

        <div class="ad-banner" id="ad-banner">
            Loading advertisement...
        </div>

        <div class="featured">
            <span style="color: #ef4444; font-weight: bold; text-transform: uppercase;">Breaking News</span>
            <h2 id="headline">${headline}</h2>
            <p>Our correspondents from around the world report on the latest developments in international trade and fiscal policy. Expert analysis suggests a period of stabilization may be approaching, though concerns remain regarding emerging markets.</p>
        </div>

        <script>
            // Live clock
            setInterval(() => {
                document.getElementById('live-clock').innerText = new Date().toLocaleTimeString();
            }, 1000);

            // Today's Date
            document.getElementById('current-date').innerText = new Date().toDateString();

            // Rotating Ads
            const ads = [
                "Subscribe today for 50% off your first year!",
                "Check out our new podcast on climate tech.",
                "Limited offer: Get our exclusive newsletter.",
                "Meet the experts at the upcoming Global Summit.",
                "Download our mobile app for real-time alerts."
            ];
            let adIndex = 0;
            setInterval(() => {
                document.getElementById('ad-banner').innerText = ads[adIndex];
                adIndex = (adIndex + 1) % ads.length;
            }, 3000);
            document.getElementById('ad-banner').innerText = ads[0];
        </script>
    </body>
    </html>
  `);
});

app.post('/update-headline', express.json(), (req, res) => {
  headline = req.body.headline || "Unprecedented Shift in Global Policy Detected";
  res.json({ message: "Headline updated", headline });
});

app.listen(port, () => {
  console.log(`App 3 listening at http://localhost:${port}`);
});
