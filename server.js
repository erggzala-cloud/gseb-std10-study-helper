import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();

const PORT = process.env.PORT || 10000;

app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// --------------------------------------------------
// FREE LIMIT
// શરૂઆતમાં દરેક IP માટે દરરોજ 20 questions
// --------------------------------------------------

const dailyUsage = new Map();

const FREE_LIMIT = 20;

function getClientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown"
  ).toString().split(",")[0].trim();
}

function getToday() {
  const now = new Date();

  return (
    now.getUTCFullYear() +
    "-" +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getUTCDate()).padStart(2, "0")
  );
}

function checkFreeLimit(req) {

  const ip = getClientIp(req);
  const today = getToday();

  const key = ip + "_" + today;

  const used = dailyUsage.get(key) || 0;

  if (used >= FREE_LIMIT) {
    return {
      allowed: false,
      used,
      remaining: 0
    };
  }

  dailyUsage.set(key, used + 1);

  return {
    allowed: true,
    used: used + 1,
    remaining: FREE_LIMIT - (used + 1)
  };
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/", (req, res) => {

  res.send(
    "GSEB Std 10 Study Helper API is running."
  );

});

// --------------------------------------------------
// MAIN SOLVE API
// --------------------------------------------------

app.post(
  "/api/solve",
  upload.single("image"),
  async (req, res) => {

    try {

      // Gemini API key Render Environment Variableમાંથી આવશે
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {

        return res.status(500).json({
          error:
            "GEMINI_API_KEY Render Environment Variablesમાં set કરેલી નથી."
        });

      }

      // --------------------------------------------
      // FREE LIMIT CHECK
      // --------------------------------------------

      const limit = checkFreeLimit(req);

      if (!limit.allowed) {

        return res.status(429).json({
          error:
            "આજે તમારી free limit પૂરી થઈ ગઈ છે. કાલે ફરી પ્રયાસ કરો.",
          limit: FREE_LIMIT,
          remaining: 0
        });

      }

      const question =
        (req.body.question || "").trim();

      const subject =
        (req.body.subject || "અન્ય").trim();

      const marks =
        (req.body.marks || "board").trim();

      const file = req.file;

      if (!question && !file) {

        return res.status(400).json({
          error:
            "પહેલા પ્રશ્ન લખો અથવા ફોટો પસંદ કરો."
        });

      }

      // --------------------------------------------
      // GSEB TEACHER PROMPT
      // --------------------------------------------

      const prompt = `
તમે Gujarat Secondary and Higher Secondary Education Board (GSEB)
ધોરણ 10ના અનુભવી શિક્ષક છો.

વિષય: ${subject}

જવાબનું સ્તર: ${marks}

વિદ્યાર્થીનો પ્રશ્ન:
${question || "(પ્રશ્ન ફોટામાંથી વાંચો)"}

મુખ્ય નિયમો:

1) ફોટામાં પ્રશ્ન હોય તો તેને ધ્યાનથી વાંચો.
અસ્પષ્ટ હોય તો ambiguity સ્પષ્ટ કહો.

2) જવાબ સરળ, સ્વાભાવિક ગુજરાતી ભાષામાં આપો.
જરૂરી technical શબ્દ કૌંસમાં Englishમાં આપી શકો.

3) GSEB ધોરણ 10ના board-styleમાં પરીક્ષામાં લખી શકાય એવો સીધો જવાબ આપો.

4) 1/2/3/4 માર્ક મુજબ જવાબની લંબાઈ અને મુદ્દા રાખો.

5) ગણિત હોય તો:
- Given
- Find
- Formula
- Substitution
- Calculation
- Final Answer
આ ક્રમમાં સમજાવો.

ગણિતના formulas માટે LaTeX વાપરો.

Inline formula:
\\( ... \\)

Separate formula:
\\[ ... \\]

દરેક calculation ફરી ચકાસો.

6) જો frequency, class interval, fi, xi, ui, fixi વગેરે હોય
તો સાચી Markdown table બનાવો.

7) વિજ્ઞાન અને સામાજિક વિજ્ઞાનમાં
વ્યાખ્યા, કારણ, મુદ્દા, તફાવત વગેરે exam-friendly રીતે આપો.

8) official GSEB Question Bankમાં હોવાનો પુરાવો ન હોય
તો "Question Bankમાં ચોક્કસ છે" એવું claim ન કરો.

9) "આ જ પ્રશ્ન boardમાં આવશે" એવું prediction ન આપો.

10) માહિતી ખાતરીથી ખબર ન હોય તો બનાવશો નહીં.

જવાબ આ formatમાં આપો:

## 💥 Exploding View

1. પ્રશ્ન શું પૂછે છે?
2. જરૂરી concept / માહિતી
3. Step-by-step સમજણ
4. Final result / મુખ્ય મુદ્દો

## 📝 પરીક્ષામાં લખવાનો જવાબ

વિદ્યાર્થી answer sheetમાં સીધો લખી શકે એવો જવાબ.

## ⭐ મહત્વ

Normal / Practice-important / Question-bank-related
— યોગ્ય હોય તે જ લખો અને ટૂંકું કારણ આપો.

## ⚠️ ધ્યાનમાં રાખવું

માત્ર 1-3 મહત્વની ભૂલો અથવા tips.

જવાબ સંપૂર્ણપણે ગુજરાતી ભાષામાં અને ધોરણ 10ના વિદ્યાર્થીને સમજાય
એવી ભાષામાં આપવો.
`;

      // --------------------------------------------
      // GEMINI CONTENT PARTS
      // --------------------------------------------

      const parts = [
        {
          text: prompt
        }
      ];

      // --------------------------------------------
      // IMAGE
      // --------------------------------------------

      if (file) {

        if (!file.mimetype.startsWith("image/")) {

          return res.status(400).json({
            error: "માત્ર image file upload કરો."
          });

        }

        parts.push({
          inline_data: {
            mime_type: file.mimetype,
            data: file.buffer.toString("base64")
          }
        });

      }

      // --------------------------------------------
      // GEMINI API
      // --------------------------------------------

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },

          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts
              }
            ],

            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {

        console.error(
          "Gemini API Error:",
          data
        );

        return res.status(500).json({
          error:
            data?.error?.message ||
            "Gemini API error આવ્યો."
        });

      }

      const answer =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("") ||
        "જવાબ મળ્યો નથી.";

      // --------------------------------------------
      // RESPONSE
      // --------------------------------------------

      res.json({

        success: true,

        answer,

        usage: {
          dailyLimit: FREE_LIMIT,
          usedToday: limit.used,
          remainingToday: limit.remaining
        }

      });

    } catch (error) {

      console.error(
        "SERVER ERROR:",
        error
      );

      res.status(500).json({

        error:
          "Serverમાં સમસ્યા આવી. થોડા સમય પછી ફરી પ્રયાસ કરો."

      });

    }

  }
);

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `GSEB Study Helper running on port ${PORT}`
    );

  }
);
