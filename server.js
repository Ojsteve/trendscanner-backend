const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Set a larger limit if needed, but ensure JSON parsing is handled manually
app.use(express.text({ type: 'application/json' }));

// ──────────────────────────────────────────────────────────────────
// TELEGRAM CREDENTIAL CONFIGURATION
// ──────────────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_TOKEN; 
const TELEGRAM_CHAT_ID = '1580815163';

let marketMatrixData = {};

// Robust JSON Parser to handle concatenated MQL5 packets
app.use((req, res, next) => {
    if (req.is('application/json') && typeof req.body === 'string') {
        try {
            const raw = req.body.trim().replace(/\0/g, '');
            // Split by closing brace followed by opening brace '}{'
            const parts = raw.split(/}\s*{/);
            const jsonStrings = parts.map((part, i) => {
                let s = part;
                if (i > 0) s = '{' + s;
                if (i < parts.length - 1) s = s + '}';
                return s;
            });

            // Process the first valid object found
            req.body = JSON.parse(jsonStrings[0]);
        } catch (err) {
            return res.status(400).send({ error: 'Malformed JSON payload' });
        }
    }
    next();
});

// Helper function for Telegram alerts
async function sendTelegramAlert(message) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('PASTE_')) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' })
        });
    } catch (error) {
        console.error("❌ Telegram API communication failure:", error);
    }
}

// Endpoint for MT5
app.post('/api/update-matrix', (req, res) => {
    const marketData = req.body;
    if (!marketData.symbol) return res.status(400).send("Invalid Data");

    const existingAsset = marketMatrixData[marketData.symbol];
    const isNewSignal = marketData.signal !== "NONE" && (!existingAsset || existingAsset.signal !== marketData.signal);

    marketMatrixData[marketData.symbol] = {
        ...marketData,
        lastUpdated: new Date().toLocaleTimeString()
    };

    console.log(`⚡ Matrix Updated: ${marketData.symbol} | Setup: ${marketData.setup}`);

    if (isNewSignal) {
        const directionEmoji = marketData.signal === "BUY" ? "🟢" : "🔴";
        const telegramMessage = `🚨 *TrendScanner SIGNAL* 🚨\n\nAsset: *${marketData.symbol}*\nAction: ${directionEmoji} *${marketData.signal}*\nStructure: \`${marketData.setup}\`\n⏰ ${new Date().toLocaleTimeString()}`;
        sendTelegramAlert(telegramMessage);
    }
    res.status(200).json({ status: "success" });
});

// Endpoint for Web Dashboard
app.get('/api/matrix-data', (req, res) => {
    res.json(Object.values(marketMatrixData));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Gateway Server running on http://127.0.0.1:${PORT}`);
});