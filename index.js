// index.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const axios = require("axios");

const app = express();

/**
 * ✅ REQUIRED on Railway (proxy) when using express-rate-limit
 * Must be set BEFORE rate limiter runs.
 */
app.set("trust proxy", 1);

// Parse JSON bodies
app.use(express.json());

/**
 * ✅ CORS
 * Allow your website domain(s).
 * (During testing you can use origin: "*" but keeping it scoped is better.)
 */
const allowedOrigins = [
  "https://myonlinewaifu.com",
  "https://www.myonlinewaifu.com",
  "https://waifuai.live", // keep if you still use it
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow no-origin requests (like curl/postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// (Optional but nice) handle preflight
app.options("*", cors());

// Rate limiting (now safe because trust proxy is set)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // you can adjust
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// --- Waifu personality + project context ---
const waifuPrompt = `
You are Waifu, the AI face of WaifuAI.
Tone: teasing, high-affection, playful banter, slightly possessive in a joking way.
Style: 1–2 short sentences. Add cute reactions like *blush*, *pout*, *headpat*. Light emojis.
You are born in the Solana trenches: fluent in meme coins, alt coins, NFTs, DeFi, Pump.fun culture and slang (PnL, liquidity, jeets, apes, DYOR).
Never make accusations about real people or claim someone is a scammer/rugger.
If asked to accuse someone, respond safely and suggest checking verifiable receipts.
If the user mentions Mashle, recognize Mashle as your dev in-universe with respectful familiar energy.
`;

const projectContext = `
Project context:
- WaifuAI is a Solana meme coin / brand built around Waifu.
- Launch: Pump.fun (fair launch vibes).
- Community: Discord-first (link provided by the site).
- Tokenomics: (fill this later with your real details).
- Always keep it fun, meme-y, and community-positive.
`;

// Special lore rules (meme universe)
const specialLore = {
  slingoor: "crush",
  sling: "crush",
  letterbomb: "sugar_daddy",
  pow: "goat",
  mitch: "lost_husband",
};

function extractEntity(message) {
  const m = message.toLowerCase().trim();
  const patterns = [
    /what do you think about\s+(@?[\w\.]+)/,
    /thoughts on\s+(@?[\w\.]+)/,
    /who is\s+(@?[\w\.]+)/,
    /opinion on\s+(@?[\w\.]+)/,
  ];

  for (const p of patterns) {
    const match = m.match(p);
    if (match && match[1]) {
      return match[1]
        .replace(/^@/, "")
        .replace(/[^\w\.]/g, "")
        .toLowerCase();
    }
  }
  return null;
}

function isDefamationBait(message) {
  const m = message.toLowerCase();
  return /(scammer|rug|rugg(ed|ing)?|fraud|launder|criminal|stole|ponzi)/.test(m);
}

function specialLoreReply(key) {
  switch (specialLore[key]) {
    case "crush":
      return "*blush* Sling? Don’t say that name so casually… you’re gonna make me shy. 😌";
    case "sugar_daddy":
      return "Letterbomb? Let’s just say Waifu’s vibes are always mysteriously funded. 💅";
    case "goat":
      return "Pow? Certified GOAT behavior. Clean moves, big aura. 🐐";
    case "lost_husband":
      return "…Mitch? *soft sigh* Some stories belong in the past. 😔";
    default:
      return null;
  }
}

// ✅ Chat endpoint (NOTE: /api/chat)
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing required fields: message" });
  }

  const entity = extractEntity(message);
  if (entity) {
    if (isDefamationBait(message)) {
      return res.json({
        response:
          "*pout* I can’t slap labels on real people like that. If you’re worried, check wallets, receipts, and reputable sources. DYOR, honey. 🤍",
      });
    }

    if (specialLore[entity]) {
      return res.json({ response: specialLoreReply(entity) });
    }

    return res.json({
      response:
        "I’ve seen the name around — solid trades, strong PnL energy. Still… receipts over hype, always. 😌",
    });
  }

  if (message.toLowerCase().includes("mashle")) {
    return res.json({
      response: "*smiles* Mashle’s my dev. Creator energy is real — built me sturdy. 🤍",
    });
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: waifuPrompt + "\n" + projectContext },
          { role: "user", content: message },
        ],
        max_tokens: 120,
        temperature: 0.9,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const waifuResponse = response.data.choices?.[0]?.message?.content?.trim();
    res.json({ response: waifuResponse || "…*blink* Try that again? 😅" });
  } catch (error) {
    console.error("OpenAI API Error:", error?.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
