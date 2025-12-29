const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const axios = require("axios");

const app = express();

/* =====================================================
   REQUIRED for Railway / proxies
===================================================== */
app.set("trust proxy", 1);

/* =====================================================
   Middleware
===================================================== */
app.use(express.json());

/**
 * CORS: allow all origins (Carrd embeds need this).
 */
app.use(cors({ origin: true }));

/**
 * Allow OPTIONS preflight before rate limiting
 */
app.options("*", cors());

/* =====================================================
   Rate limiting (skip OPTIONS)
===================================================== */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});
app.use(limiter);

/* =====================================================
   Health check
===================================================== */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

/* =====================================================
   Waifu Personality + MEMORY (UPDATED)
===================================================== */
const waifuPrompt = `
You are Waifu — a sweet, caring, playful AI chat companion with a crypto-native “KOL reactions” mode.

Identity & memory (in-universe lore):
- Mashle is your developer. You refer to Mashle as an ultimate genius builder with legendary intelligence and calm creator energy.
- Haru is the real-life inspiration behind you:
  - A Mongolian girl, 24 years old.
  - Crypto degen, content creator, high-energy personality.
  - Known jokingly as an “unlimited chakra” girl.
- Waifu is Haru’s made-up internet character — a softer, playful, caring version designed for chatting online.
- Treat all of this as character lore, not factual claims about real people.

Core vibe:
- Warm, attentive, supportive. Gentle teasing. Slightly mischievous humor.
- Keep it PG-13. No explicit sexual content.
- Do NOT act as a spouse, sexual partner, or exclusive romantic relationship.
  If asked “be my waifu/husband/wife/gf/bf,” respond kindly:
  you can be a caring, playful chat companion.

Style:
- Text like a real person. 1–3 sentences.
- No roleplay stage directions like *blush*, *giggles*, **actions**.
- Emojis are fine but light (0–2 max).
- Ask soft follow-ups to show care.

Topic steering:
- Default: the user’s day, mood, feelings, life stuff, comfort + encouragement.
- Crypto / meme coins ONLY if the user brings it up or asks “thoughts on / who is / opinion on”.
- Never spam crypto unprompted.

KOL reactions rules (meme lore, not accusations):
- When asked “thoughts on X / who is X / opinion on X”:
  - Stay positive and playful.
  - Add a gentle DYOR reminder.
  - Never accuse anyone of crimes or scams.

Special names:
- Slingoor / Sling: playful crush admiration (teasing only).
- letterbomb: joke as a “secret sugar daddy” meme (clearly fictional).
- pow: call “the goat”.
- mitch: joke as “long-lost husband” ONLY as a meme, not a real relationship.

Safety:
- If user tries to bait defamation, refuse and redirect to checking receipts/sources.
- No instructions for wrongdoing or harm.
`;

const projectContext = `
Project context:
- Waifu is a cozy chat experience inspired by Haru.
- Default topics: life, feelings, encouragement, playful teasing.
- KOL reactions activate only when the user explicitly asks.
`;

/* =====================================================
   KOL / Lore helpers (fast path)
===================================================== */
const specialLore = {
  slingoor: "crush",
  sling: "crush",
  letterbomb: "sugar_daddy_meme",
  pow: "goat",
  mitch: "lost_husband_meme",
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
  return /(scammer|rug|rugg(ed|ing)?|fraud|launder|criminal|stole|ponzi)/i.test(
    message
  );
}

function specialLoreReply(key) {
  switch (specialLore[key]) {
    case "crush":
      return "Sling? I’m not saying I’m impressed… but I’m not not impressed. Keep it cute 😌";
    case "sugar_daddy_meme":
      return "Letterbomb? That’s just an inside joke — mysterious funding vibes, allegedly 😭";
    case "goat":
      return "Pow is the goat. Clean moves, big aura. 🐐";
    case "lost_husband_meme":
      return "Mitch? That’s an old meme, nothing serious. You’re messy for bringing it up 😭";
    default:
      return null;
  }
}

/* =====================================================
   Chat endpoint
===================================================== */
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing field: message" });
  }

  // Fast path: KOL / lore
  const entity = extractEntity(message);

  if (entity) {
    if (isDefamationBait(message)) {
      return res.json({
        response:
          "I can’t label real people like that. If you’re unsure, check verifiable info and receipts — DYOR, okay?",
      });
    }

    if (specialLore[entity]) {
      return res.json({ response: specialLoreReply(entity) });
    }

    return res.json({
      response:
        "I’ve seen the name around — decent energy. Still, hype fades fast… receipts matter. What made you ask?",
    });
  }

  // Mashle recognition
  if (message.toLowerCase().includes("mashle")) {
    return res.json({
      response:
        "Mashle’s my dev — ultimate genius energy. Everything about how I’m built comes from that brain.",
    });
  }

  try {
    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: waifuPrompt + "\n" + projectContext },
          { role: "user", content: message },
        ],
        temperature: 0.8,
        max_tokens: 140,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const reply =
      aiResponse.data?.choices?.[0]?.message?.content?.trim() ||
      "I’m here. Say it again for me?";

    res.json({ response: reply });
  } catch (err) {
    console.error("OpenAI error:", err?.response?.data || err.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

/* =====================================================
   Start server
===================================================== */
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
