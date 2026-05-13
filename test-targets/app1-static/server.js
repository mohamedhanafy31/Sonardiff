const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let state = {
  title: "Baseline Static Content",
  tableValue: "Standard",
  lastUpdated: new Date().toISOString()
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>App 1 - Static Target</title>
        <style>
            body { font-family: sans-serif; padding: 2rem; background: #f8fafc; color: #1e293b; }
            h1 { color: #0f172a; }
            table { border-collapse: collapse; margin: 1rem 0; width: 300px; }
            td, th { border: 1px solid #cbd5e1; padding: 0.5rem; text-align: left; }
            footer { margin-top: 2rem; font-size: 0.875rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 1rem; }
        </style>
    </head>
    <body>
        <h1>${state.title}</h1>
        <p>This is the first paragraph of text for testing static diffs.</p>
        <p>The monitoring system should capture this page and alert when changes occur.</p>
        <p>Third paragraph to provide more baseline content for the scraper.</p>
        
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Status</td><td>Active</td></tr>
            <tr><td>Quality</td><td>${state.tableValue}</td></tr>
            <tr><td>Region</td><td>US-East</td></tr>
        </table>

        <footer>
            Last updated: <span id="last-updated">${state.lastUpdated}</span>
        </footer>
    </body>
    </html>
  `);
});

app.post('/update', (req, res) => {
  state.title = "Updated Static Content";
  state.tableValue = "Premium";
  state.lastUpdated = new Date().toISOString();
  res.json({ message: "Content updated successfully", state });
});

app.listen(port, () => {
  console.log(`App 1 listening at http://localhost:${port}`);
});
