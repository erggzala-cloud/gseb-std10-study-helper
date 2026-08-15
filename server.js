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

// ==================================================
// FILE UPLOAD
// ==================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// ==================================================
// SETTINGS
// ==================================================

const FREE_LIMIT = 20;

const dailyUsage = new Map();

const FULL_ACCESS_CODE =
  process.env.FULL_ACCESS_CODE || "";

// ==================================================
// CLIENT IP
// ==================================================

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

// ==================================================
// TODAY
// ==================================================

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

// ==================================================
// USAGE
// ==================================================

function getUsage(req) {

  const ip = getClientIp(req);

  const today = getToday();

  const key =
    ip + "_" + today;

  return {

    key,

    used:
      dailyUsage.get(key) || 0

  };

}

// ==================================================
// ACCESS MODE
// ==================================================

function getAccessMode(req) {

  const cookie =
    req.headers.cookie || "";

  const match =
    cookie.match(
      /(?:^|;\s*)access_mode=([^;]+)/
    );

  return match
    ? decodeURIComponent(match[1])
    : "limited";

}

// ==================================================
// CLEAN ANSWER
// ==================================================

function cleanAnswer(text) {

  let answer =
    String(text || "");

  answer =
    answer.replace(
      /<think>[\s\S]*?<\/think>/gi,
      ""
    );

  answer =
    answer.replace(
      /<think>[\s\S]*/gi,
      ""
    );

  answer =
    answer.replace(
      /<\/think>/gi,
      ""
    );

  return answer.trim();

}

// ==================================================
// LIMITED WEBSITE
// ==================================================

app.get("/", (req, res) => {

  res.setHeader(
    "Set-Cookie",
    "access_mode=limited; Path=/; HttpOnly; SameSite=Lax"
  );

  res.sendFile(
    path.join(
      process.cwd(),
      "full.html"
    )
  );

});

// ==================================================
// FULL WEBSITE
// ==================================================

app.get("/full", (req, res) => {

  res.setHeader(
    "Set-Cookie",
    "access_mode=full; Path=/; HttpOnly; SameSite=Lax"
  );

  res.sendFile(
    path.join(
      process.cwd(),
      "index.html"
    )
  );

});

// ==================================================
// HEALTH
// ==================================================

app.get("/api/health", (req, res) => {

  res.json({

    success: true,

    service:
      "GSEB Std 10 Study Helper",

    status:
      "running"

  });

});

// ==================================================
// MAIN API
// BOTH ENDPOINTS WORK
// ==================================================

app.post(
  [
    "/api/solve",
    "/api/full-solve"
  ],

  upload.single("image"),

  async (req, res) => {

    try {

      // ==================================================
      // GROQ KEY
      // ==================================================

      const apiKey =
        process.env.GROQ_API_KEY;

      if (!apiKey) {

        return res.status(500).json({

          error:
            "GROQ_API_KEY Render Environment Variablesમાં set કરેલી નથી."

        });

      }

      // ==================================================
      // INPUT
      // ==================================================

      const question =
        (req.body.question || "").trim();

      const subject =
        (req.body.subject || "અન્ય").trim();

      const marks =
        (req.body.marks || "વિગતવાર સમજણ").trim();

      const accessCode =
        (
          req.body.fullAccessCode ||
          req.body.accessCode ||
          ""
        ).trim();

      const file =
        req.file;

      // ==================================================
      // ACCESS MODE
      // ==================================================

      const accessMode =
        getAccessMode(req);

      const hasFullAccess =
        accessMode === "full" &&
        FULL_ACCESS_CODE &&
        accessCode === FULL_ACCESS_CODE;

      // ==================================================
      // QUESTION CHECK
      // ==================================================

      if (!question && !file) {

        return res.status(400).json({

          error:
            "પહેલા પ્રશ્ન લખો અથવા ફોટો પસંદ કરો."

        });

      }

      // ==================================================
      // IMAGE CHECK
      // ==================================================

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

      // ==================================================
      // DAILY LIMIT
      // ==================================================

      const usage =
        getUsage(req);

      if (!hasFullAccess) {

        if (
          usage.used >= FREE_LIMIT
        ) {

          return res.status(429).json({

            error:
              "આજે તમારી 20 પ્રશ્નોની મફત મર્યાદા પૂરી થઈ ગઈ છે. કાલે ફરી પ્રયાસ કરો.",

            usage: {

              fullAccess:
                false,

              dailyLimit:
                FREE_LIMIT,

              usedToday:
                usage.used,

              remainingToday:
                0

            }

          });

        }

      }

      // ==================================================
      // GSEB MASTER PROMPT
      // SHORT + STRONG
      // ==================================================

      const prompt = `

તમે GSEB ધોરણ 10ના અનુભવી ગુજરાતી માધ્યમના શિક્ષક છો.

વિષય: ${subject}
જવાબનું સ્તર: ${marks}

વિદ્યાર્થીનો પ્રશ્ન:
${question || "પ્રશ્ન ફોટામાંથી વાંચો."}

મુખ્ય નિયમો:

1. જવાબ સરળ અને સ્વાભાવિક ગુજરાતી ભાષામાં આપો.
2. જરૂરી technical terms, formulas અને units Englishમાં રાખી શકો.
3. વિદ્યાર્થી answer sheetમાં સીધો લખી શકે એવો જવાબ આપો.
4. ફોટામાં પ્રશ્ન હોય તો ધ્યાનથી વાંચો.
5. ફોટામાં એકથી વધુ સ્પષ્ટ પ્રશ્ન હોય તો બધા જવાબ આપો.
6. અસ્પષ્ટ ભાગ હોય તો અંદાજ ન લગાવો.
7. <think>, analysis, reasoning અથવા internal thinking ક્યારેય બતાવશો નહીં.
8. "આ પ્રશ્ન ચોક્કસ boardમાં આવશે" એવું ન કહો.
9. Question Bank અંગે પુરાવો ન હોય તો claim ન કરો.

ગણિત હોય તો:

આપેલ
શોધવાનું
સૂત્ર
મૂલ્યો મૂકવા
ગણતરી
અંતિમ જવાબ

આ ક્રમમાં આપો અને calculation ચકાસો.

વિજ્ઞાનમાં વ્યાખ્યા, કારણ, પ્રક્રિયા અને મુદ્દા exam-friendly આપો.

સામાજિક વિજ્ઞાનમાં કારણ, પરિણામ, લક્ષણો, મહત્વ અને તફાવત મુદ્દાવાર આપો.

જવાબ આ formatમાં આપો:

## 💥 પ્રશ્નને સરળ રીતે સમજીએ

1. પ્રશ્ન શું પૂછે છે?
2. જરૂરી માહિતી / concept
3. પગલુંવાર સમજણ
4. અંતિમ પરિણામ

## 📝 પરીક્ષામાં લખવાનો જવાબ

Answer sheetમાં સીધો લખી શકાય એવો જવાબ.

## ⭐ મહત્વ

Normal / Practice-important / Question-bank-related

માત્ર યોગ્ય હોય ત્યારે લખો.

## ⚠️ ધ્યાનમાં રાખવું

માત્ર 1 થી 3 મહત્વની tips.

માત્ર final answer આપો.
કોઈ internal reasoning નહીં.
સરળ ગુજરાતી.
GSEB ધોરણ 10 exam-friendly જવાબ.
`;

      // ==================================================
      // GROQ CONTENT
      // ==================================================

      const content = [

        {

          type: "text",

          text: prompt

        }

      ];

      // ==================================================
      // IMAGE
      // ==================================================

      if (file) {

        const base64Image =
          file.buffer.toString("base64");

        const imageDataUrl =
          `data:${file.mimetype};base64,${base64Image}`;

        content.push({

          type:
            "image_url",

          image_url: {

            url:
              imageDataUrl

          }

        });

      }

      // ==================================================
      // GROQ REQUEST
      // ==================================================

      const response =
        await fetch(

          "https://api.groq.com/openai/v1/chat/completions",

          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${apiKey}`

            },

            body:
              JSON.stringify({

                model:
                  "qwen/qwen3.6-27b",

                messages: [

                  {

                    role:
                      "user",

                    content:
                      content

                  }

                ],

                temperature:
                  0.3,

                max_completion_tokens:
                  3000,

                reasoning_effort:
                  "default",

                reasoning_format:
                  "hidden",

                stream:
                  false

              })

          }

        );

      // ==================================================
      // READ RESPONSE
      // ==================================================

      const data =
        await response.json();

      // ==================================================
      // GROQ ERROR
      // ==================================================

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
            "Groq API માં સમસ્યા આવી."

        });

      }

      // ==================================================
      // ANSWER
      // ==================================================

      let answer =

        data
          ?.choices?.[0]
          ?.message
          ?.content || "";

      answer =
        cleanAnswer(answer);

      if (!answer) {

        answer =
          "જવાબ મળ્યો નથી. કૃપા કરીને પ્રશ્ન ફરીથી મોકલો.";

      }

      // ==================================================
      // USAGE
      // ==================================================

      let usedToday;

      let remainingToday;

      if (hasFullAccess) {

        usedToday =
          0;

        remainingToday =
          "Unlimited";

      }

      else {

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

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.json({

        success:
          true,

        answer:

          answer,

        usage: {

          fullAccess:
            !!hasFullAccess,

          dailyLimit:

            hasFullAccess
              ? "Unlimited"
              : FREE_LIMIT,

          usedToday:

            usedToday,

          remainingToday:

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

// ==================================================
// START SERVER
// ==================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `GSEB Study Helper running on port ${PORT}`
    );

  }
);
