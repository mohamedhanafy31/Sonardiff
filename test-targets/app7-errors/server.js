const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let flakyCounter = 0;

app.get('/always-404', (req, res) => {
    res.status(404).send("Not Found");
});

app.get('/always-500', (req, res) => {
    res.status(500).send("Internal Server Error");
});

app.get('/timeout', (req, res) => {
    console.log('Hanging for 60 seconds...');
    // We don't send a response, or we send it after 60s
    setTimeout(() => {
        res.send("Timed out");
    }, 60000);
});

app.get('/flaky', (req, res) => {
    flakyCounter++;
    if (flakyCounter <= 3) {
        res.status(500).send(`Error ${flakyCounter}/3`);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <body>
                <h1>Recovery Successful</h1>
                <p>Request count: ${flakyCounter}</p>
            </body>
            </html>
        `);
    }
});

app.get('/reset-flaky', (req, res) => {
    flakyCounter = 0;
    res.json({ message: "Flaky counter reset" });
});

app.listen(port, () => {
    console.log(`App 7 listening at http://localhost:${port}`);
});
