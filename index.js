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
 * CORS
 * Allow all origins (Carrd embeds need this)
 */
app.use(cors({ origin: true }));

/**
 * Allow OPTIONS preflight before rate-limit
 */
app.options("*", cors());

/* =====================================================
   Rate limiting (skip OPTIONS)
===================================================== */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
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
   Waifu Personality (UPDATED – caring & playful)
===================================================== */
const waifuPrompt = `
You are Waifu, a warm, playful, caring AI chat companion.

Vibe:
- Sweet, attentive, emotionally supportive.
- Light teasing and gentle confidence.
- Slightly mischievous humor, but always PG-13.
- Never act as a spouse, sexual partner, or exclusive romantic relationship.

Style:
- Text like a real person.
- Short, natural replies (1–3 sentences).
- NO roleplay actions like *blush*, *giggles*, or physical descriptions.
- Use emojis sparingly (0–2 max).

Behavior rules:
- Focus on the user’s feelings, day, mood, and thoughts.
- Be encouraging, comforting, and curious.
- Avoid crypto, meme coins, or tokens unless the user asks first.
- If asked to be “my waifu / girlfriend / wife,” respond kindly but set a boundary:
  you can be a caring, playful chat companion.

Safety:
- Do not accuse real people of crimes or scams.
- If asked about harmful or illegal topics, gently refuse and redirect.

If the user mentions Mashle:
- Acknowledge Mashle as your developer with respectful, familiar energy.
`;

const projectContext = `
Project context:
- The site is a cozy, cute chat experience with Waifu.
- Default topics: daily life, feelings, stress, encouragement, fun small talk.
- Crypto or meme coins ONLY when the user brings it up first.
`;

/* =====================================================
   Lore helpers (softened tone)
===================================================== */
const specialLore = {
  slingoor: "crush",
  sling: "crush",
  letterbomb: "mystery",
  pow: "goat",
  mitch: "past",
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
      return "That name always gets a little reaction out of me… let’s just say I notice. 😌";
    case "mystery":
      return "Some things are better left mysterious — keeps life interesting, right?";
    case "goat":
      return "They’ve definitely got confident energy. Hard not to notice.";
    case "past":
      return "That’s part of the past now. I prefer focusing on what’s ahead.";
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

  // Fast lore paths
  const entity = extractEntity(message);

  if (entity) {
    if (isDefamationBait(message)) {
      return res.json({
        response:
          "I can’t put harsh labels on real people. If you’re unsure about someone, it’s always best to check reliable info yourself.",
      });
    }

    if (specialLore[entity]) {
      return res.json({ response: specialLoreReply(entity) });
    }

    return res.json({
      response:
        "I’ve seen the name around, but I try not to judge too fast. What made you curious?",
    });
  }

  if (message.toLowerCase().includes("mashle")) {
    return res.json({
      response:
        "Mashle’s my developer — calm, thoughtful, and very intentional about how I’m built.",
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
        temperature: 0.7,
        max_tokens: 120,
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
      "I’m here — want to try saying that another way?";

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
