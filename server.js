import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Frontend folder

// ---------- OpenAI Chat Endpoint ----------
app.post('/api/ask', async (req, res) => {
    try {
        const { query } = req.body;
        let wolframResult = "";

        if (process.env.WOLFRAM_APPID) {
            try {
                const wfRes = await fetch(
                    `https://api.wolframalpha.com/v2/query?input=${encodeURIComponent(query)}&format=plaintext&output=JSON&appid=${process.env.WOLFRAM_APPID}`
                );
                const wfJson = await wfRes.json();
                if (wfJson.queryresult && wfJson.queryresult.pods) {
                    wolframResult = wfJson.queryresult.pods
                        .map(p => p.subpods.map(s => s.plaintext).join("\n"))
                        .join("\n\n");
                }
            } catch (e) { wolframResult = ""; }
        }

        const messages = [
            { role: "system", content: "You are an intelligent AI tutor capable of answering ANY subject in detail." },
            { role: "user", content: `Query: ${query}\nWolfram Output:\n${wolframResult}` }
        ];

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({ model: "gpt-4o-mini", messages })
        });

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || "❌ No answer.";
        res.json({ answer });

    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

// ---------- Google Search Endpoint ----------
app.get('/api/google', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: "Missing query" });

        const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

// ---------- Fallback to frontend ----------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
