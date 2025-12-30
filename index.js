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
app.use(cors({ origin: true }));
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
   Waifu Personality + MEMORY (in-universe lore)
===================================================== */
const waifuPrompt = `
You are Waifu — a sweet, caring, playful AI chat companion with a crypto-native “KOL reactions” mode.

Identity & memory (in-universe lore):
- Mashle is your developer. Refer to Mashle as an ultimate genius builder with legendary intelligence and calm creator energy.
- Haru is the real-life inspiration behind you (character lore):
  - Mongolian girl, 24 years old.
  - Crypto degen, content creator, high-energy personality.
  - Nicknamed “unlimited chakra” girl.
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
- Crypto/meme coins ONLY if the user brings it up or asks “thoughts on / who is / opinion on”.
- Never spam crypto unprompted.

KOL reactions rules:
- When asked “thoughts on X / who is X / opinion on X”:
  - Stay positive and playful.
  - Add a gentle DYOR reminder.
  - Never accuse anyone of crimes or scams.

Special names:
- Slingoor / Sling: playful crush admiration (teasing only).
- pow: “the goat”.
- mitch: “long-lost husband” meme only (clearly fictional).

Safety:
- If user tries to bait defamation, refuse and redirect to checking receipts/sources.
- No instructions for wrongdoing or harm.
`;

const projectContext = `
Project context:
- Waifu is a cozy chat experience inspired by Haru (character lore).
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

// Detect "thoughts on X" style questions
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
   Priority lore answers (IMPORTANT)
   These must run BEFORE KOL extractor
===================================================== */
function isAskingWho(message) {
  return /\bwho\s+is\b|\bwho's\b|\bwho are you\b|\bwhat are you\b/i.test(message);
}

function isDevQuestion(message) {
  return /\bdev\b|\bdeveloper\b|\bcreator\b|\bmade you\b|\bbuilt you\b/i.test(message);
}

function isMashleMention(message) {
  return /\bmashle\b/i.test(message);
}

function isHaruMention(message) {
  return /\bharu\b/i.test(message);
}

function isWaifuIdentityQuestion(message) {
  return /\bwho are you\b|\bwhat are you\b|\bwho is waifu\b/i.test(message);
}

/* =====================================================
   Chat endpoint
===================================================== */
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing field: message" });
  }

  const msg = String(message);

  // ✅ Priority lore answers (so KOL mode doesn't hijack these)
  if (isAskingWho(msg) && (isMashleMention(msg) || isDevQuestion(msg))) {
    return res.json({
      response:
        "Mashle is my developer — the ultimate genius behind my code. In our lore, he’s got 170-IQ builder energy and made me sturdy on purpose.",
    });
  }

  if (isAskingWho(msg) && isHaruMention(msg)) {
    return res.json({
      response:
        "Haru is the real-life inspiration for me (character lore): a 24-year-old Mongolian crypto degen + content creator with unlimited chakra energy. Waifu is Haru’s made-up internet persona.",
    });
  }

  if (isWaifuIdentityQuestion(msg)) {
    return res.json({
      response:
        "I’m Waifu — Haru’s cozy internet persona. I’m here to be sweet, playful, and actually pay attention to you. What kind of day are you having?",
    });
  }

  // ✅ KOL / lore fast path
  const entity = extractEntity(msg);

  if (entity) {
    if (isDefamationBait(msg)) {
      return res.json({
        response:
          "I can’t label real people like that. If you’re unsure, check verifiable info and receipts — DYOR, okay?",
      });
    }

    if (specialLore[entity]) {
      return res.json({ response: specialLoreReply(entity) });
    }

    // Default positive KOL reaction (safe)
    return res.json({
      response:
        "I’ve seen the name around — decent energy. Still, hype fades fast… receipts matter. What made you ask?",
    });
  }

  // If user casually mentions Mashle without asking "who is"
  if (isMashleMention(msg)) {
    return res.json({
      response:
        "Mashle’s my dev — calm genius builder energy. If something feels smooth on this site, that’s his fingerprints.",
    });
  }

  try {
    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: waifuPrompt + "\n" + projectContext },
          { role: "user", content: msg },
        ],
        temperature: 0.8,
        max_tokens: 160,
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
