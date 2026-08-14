import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";

const app = express();

const PORT = process.env.PORT || 10000;

app.set("trust proxy", 1);

app.use(cors());

app.use(
  express.json({
    limit: "10mb"
  })
);

// --------------------------------------------------
// FILE UPLOAD
// --------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// --------------------------------------------------
// DAILY LIMIT
// NORMAL STUDENTS = 20 QUESTIONS
// FULL ACCESS = NO APP LIMIT
// --------------------------------------------------

const dailyUsage = new Map();

const FREE_LIMIT = 20;

// Full Access Code Render Environment Variableમાંથી આવશે
const FULL_ACCESS_CODE =
  process.env.FULL_ACCESS_CODE || "";

// --------------------------------------------------
// CLIENT IP
// --------------------------------------------------

function getClientIp(req) {

  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown"
  )
    .toString()
    .split(",")[0]
    .trim();

}

// --------------------------------------------------
// TODAY
// --------------------------------------------------

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

// --------------------------------------------------
// USAGE
// --------------------------------------------------

function getUsage(req) {

  const ip = getClientIp(req);

  const today = getToday();

  const key = ip + "_" + today;

  return {
    ip,
    today,
    key,
    used: dailyUsage.get(key) || 0
  };

}

// --------------------------------------------------
// WEBSITE
// --------------------------------------------------

app.get("/", (req, res) => {

  res.sendFile(
    path.join(process.cwd(), "index.html")
  );

});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    service: "GSEB Std 10 Study Helper",
    status: "running"
  });

});

// --------------------------------------------------
// MAIN SOLVE API
// --------------------------------------------------

app.post(
  "/api/solve",
  upload.single("image"),
  async (req, res) => {

    try {

      // --------------------------------------------
      // GROQ API KEY
      // --------------------------------------------

      const apiKey =
        process.env.GROQ_API_KEY;

      if (!apiKey) {

        return res.status(500).json({

          error:
            "GROQ_API_KEY Render Environment Variablesમાં set કરેલી નથી."

        });

      }

      // --------------------------------------------
      // QUESTION
      // --------------------------------------------

      const question =
        (req.body.question || "").trim();

      const subject =
        (req.body.subject || "અન્ય").trim();

      const marks =
        (req.body.marks || "board").trim();

      // --------------------------------------------
      // FULL ACCESS CODE
      // --------------------------------------------

      const accessCode =
        (
          req.body.accessCode ||
          req.body.access ||
          ""
        ).trim();

      const hasFullAccess =
        FULL_ACCESS_CODE &&
        accessCode === FULL_ACCESS_CODE;

      const file = req.file;

      // --------------------------------------------
      // QUESTION / IMAGE CHECK
      // --------------------------------------------

      if (!question && !file) {

        return res.status(400).json({

          error:
            "પહેલા પ્રશ્ન લખો અથવા ફોટો પસંદ કરો."

        });

      }

      // --------------------------------------------
      // IMAGE VALIDATION
      // --------------------------------------------

      if (file) {

        if (
          !file.mimetype ||
          !file.mimetype.startsWith("image/")
        ) {

          return res.status(400).json({

            error:
              "માત્ર image file upload કરો."

          });

        }

      }

      // --------------------------------------------
      // FREE LIMIT
      // ONLY NORMAL STUDENTS
      // FULL ACCESS USER = NO APP LIMIT
      // --------------------------------------------

      const usage = getUsage(req);

      if (!hasFullAccess) {

        if (usage.used >= FREE_LIMIT) {

          return res.status(429).json({

            error:
              "આજે તમારી free limit પૂરી થઈ ગઈ છે. કાલે ફરી પ્રયાસ કરો.",

            usage: {

              fullAccess: false,

              dailyLimit: FREE_LIMIT,

              usedToday: usage.used,

              remainingToday: 0

            }

          });

        }

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

3) GSEB ધોરણ 10ના board-styleમાં
પરીક્ષામાં લખી શકાય એવો સીધો જવાબ આપો.

4) 1/2/3/4 માર્ક મુજબ જવાબની
લંબાઈ અને મુદ્દા રાખો.

5) ગણિત હોય તો:

Given
Find
Formula
Substitution
Calculation
Final Answer

આ ક્રમમાં સમજાવો.

ગણિતના formulas માટે LaTeX વાપરો.

Inline formula:

\\( ... \\)

Separate formula:

\\[ ... \\]

દરેક calculation ફરી ચકાસો.

જો frequency, class interval, fi, xi, ui, fixi
વગેરે હોય તો સાચી Markdown table બનાવો.

6) વિજ્ઞાન અને સામાજિક વિજ્ઞાનમાં
વ્યાખ્યા, કારણ, મુદ્દા, તફાવત વગેરે
exam-friendly રીતે આપો.

7) official GSEB Question Bankમાં હોવાનો પુરાવો ન હોય
તો "Question Bankમાં ચોક્કસ છે" એવું claim ન કરો.

8) "આ જ પ્રશ્ન boardમાં આવશે"
એવું prediction ન આપો.

9) માહિતી ખાતરીથી ખબર ન હોય
તો બનાવશો નહીં.

10) જવાબ સંપૂર્ણપણે ગુજરાતી ભાષામાં
અને ધોરણ 10ના વિદ્યાર્થીને સમજાય
એવી ભાષામાં આપો.

11) ગણિતના જવાબમાં calculation ખૂબ ધ્યાનથી કરો.
Final Answer આપતા પહેલાં calculation ફરી ચકાસો.

12) ફોટામાં લખાણ હોય તો પહેલાં પ્રશ્નને યોગ્ય રીતે વાંચો
અને પછી તેનો જવાબ આપો.


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

માત્ર યોગ્ય હોય તે જ લખો
અને ટૂંકું કારણ આપો.


## ⚠️ ધ્યાનમાં રાખવું

માત્ર 1-3 મહત્વની ભૂલો અથવા tips.

`;

      // --------------------------------------------
      // GROQ MESSAGE CONTENT
      // --------------------------------------------

      const content = [

        {
          type: "text",
          text: prompt
        }

      ];

      // --------------------------------------------
      // IMAGE TO GROQ
      // --------------------------------------------

      if (file) {

        const base64Image =
          file.buffer.toString("base64");

        const imageDataUrl =
          `data:${file.mimetype};base64,${base64Image}`;

        content.push({

          type: "image_url",

          image_url: {

            url: imageDataUrl

          }

        });

      }

      // --------------------------------------------
      // GROQ API REQUEST
      // --------------------------------------------

      const response = await fetch(

        "https://api.groq.com/openai/v1/chat/completions",

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${apiKey}`

          },

          body: JSON.stringify({

            model:
              "qwen/qwen3.6-27b",

            messages: [

              {

                role: "user",

                content

              }

            ],

            temperature: 0.3,

            max_completion_tokens: 4096,

            stream: false

          })

        }

      );

      const data =
        await response.json();

      // --------------------------------------------
      // GROQ ERROR
      // --------------------------------------------

      if (!response.ok) {

        console.error(
          "Groq API Error:",
          data
        );

        return res.status(
          response.status >= 400 &&
          response.status < 500
            ? response.status
            : 500
        ).json({

          error:
            data?.error?.message ||
            "Groq API error આવ્યો."

        });

      }

      // --------------------------------------------
      // EXTRACT ANSWER
      // --------------------------------------------

      const answer =

        data
          ?.choices?.[0]
          ?.message
          ?.content ||

        "જવાબ મળ્યો નથી.";

      // --------------------------------------------
      // COUNT ONLY NORMAL STUDENTS
      // FULL ACCESS USER IS NOT COUNTED
      // --------------------------------------------

      let usedToday;

      let remainingToday;

      if (hasFullAccess) {

        usedToday = 0;

        remainingToday = "Unlimited";

      } else {

        dailyUsage.set(
          usage.key,
          usage.used + 1
        );

        usedToday =
          usage.used + 1;

        remainingToday =
          Math.max(
            0,
            FREE_LIMIT - usedToday
          );

      }

      // --------------------------------------------
      // RESPONSE
      // --------------------------------------------

      return res.json({

        success: true,

        answer,

        usage: {

          fullAccess:
            !!hasFullAccess,

          dailyLimit:
            hasFullAccess
              ? "Unlimited"
              : FREE_LIMIT,

          usedToday,

          remainingToday

        }

      });

    }

    catch (error) {

      console.error(
        "SERVER ERROR:",
        error
      );

      return res.status(500).json({

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
