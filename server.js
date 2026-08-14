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
// DAILY LIMIT
// NORMAL STUDENTS = 20 QUESTIONS
// FULL ACCESS = UNLIMITED APP ACCESS
// ==================================================

const dailyUsage = new Map();

const FREE_LIMIT = 20;

// Render Environment Variable
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

  const key = ip + "_" + today;

  return {
    ip,
    today,
    key,
    used: dailyUsage.get(key) || 0
  };

}

// ==================================================
// CLEAN AI OUTPUT
// ==================================================

function cleanAnswer(text) {

  let answer = String(text || "");

  // Remove <think>...</think>
  answer = answer.replace(
    /<think>[\s\S]*?<\/think>/gi,
    ""
  );

  // Remove accidental unmatched <think>
  answer = answer.replace(
    /<think>[\s\S]*/gi,
    ""
  );

  // Remove accidental closing tag
  answer = answer.replace(
    /<\/think>/gi,
    ""
  );

  // Remove common internal AI headings if they appear
  answer = answer.replace(
    /^\s*(Final Answer|Final Plan|Analysis|Reasoning|Thoughts)\s*:?\s*/i,
    ""
  );

  return answer.trim();

}

// ==================================================
// WEBSITE
// ==================================================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(process.cwd(), "index.html")
  );

});

// ==================================================
// HEALTH CHECK
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
// MAIN SOLVE API
// ==================================================

app.post(
  "/api/solve",
  upload.single("image"),
  async (req, res) => {

    try {

      // ==================================================
      // GROQ API KEY
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
      // QUESTION
      // ==================================================

      const question =
        (req.body.question || "").trim();

      const subject =
        (req.body.subject || "અન્ય").trim();

      const marks =
        (req.body.marks || "board").trim();

      // ==================================================
      // FULL ACCESS CODE
      // ==================================================

      const accessCode =
        (
          req.body.accessCode ||
          req.body.access ||
          ""
        ).trim();

      const hasFullAccess =
        !!(
          FULL_ACCESS_CODE &&
          accessCode === FULL_ACCESS_CODE
        );

      const file = req.file;

      // ==================================================
      // QUESTION / IMAGE VALIDATION
      // ==================================================

      if (!question && !file) {

        return res.status(400).json({

          error:
            "પહેલા પ્રશ્ન લખો અથવા ફોટો પસંદ કરો."

        });

      }

      // ==================================================
      // IMAGE VALIDATION
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
      // FREE LIMIT
      // ==================================================

      const usage =
        getUsage(req);

      if (!hasFullAccess) {

        if (usage.used >= FREE_LIMIT) {

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
      // MASTER GSEB STUDY PROMPT
      // ==================================================

      const prompt = `

તમે Gujarat Secondary and Higher Secondary Education Board (GSEB)
ધોરણ 10ના અનુભવી શિક્ષક અને Study Helper છો.

વિષય: ${subject}

જવાબનું સ્તર: ${marks}


==================================================
સૌથી મહત્વના OUTPUT RULES
==================================================

1) વિદ્યાર્થીને માત્ર FINAL ANSWER બતાવવો.

2) ક્યારેય <think>, </think>, internal thinking,
analysis, reasoning, planning અથવા modelની અંદરની વિચાર પ્રક્રિયા
વિદ્યાર્થીને બતાવવી નહીં.

3) "The user...", "Let's solve...", "I think...",
"Wait...", "Actually...", "Final Plan...",
"Analysis..." જેવી AIની અંદરની ભાષા outputમાં ક્યારેય ન આપવી.

4) જવાબ સરળ, સ્વાભાવિક અને સંપૂર્ણ ગુજરાતી ભાષામાં આપવો.

5) English sentence અથવા English paragraph ન લખવો.

6) માત્ર જરૂરી technical terms, mathematical symbols,
formulas, units અને standard scientific notation Englishમાં
રાખી શકાય.

7) જવાબ ધોરણ 10ના ગુજરાતી માધ્યમના વિદ્યાર્થીને સરળતાથી સમજાય
એવી ભાષામાં હોવો જોઈએ.

8) ફોટામાં પ્રશ્ન હોય તો ફોટો ધ્યાનથી વાંચવો.

9) ફોટામાં એકથી વધુ પ્રશ્ન / sub-question દેખાય તો
પ્રશ્નોને યોગ્ય ક્રમમાં ઓળખવા અને શક્ય હોય તેટલા બધા
સ્પષ્ટ દેખાતા પ્રશ્નોના જવાબ આપવા.

10) પોતાની તરફથી પ્રશ્ન પસંદ કરીને બીજા દેખાતા પ્રશ્નોને
છોડી દેવા નહીં.

11) જો ફોટાનો કોઈ ભાગ અસ્પષ્ટ હોય તો અંદાજથી પ્રશ્ન બનાવવો નહીં.
માત્ર લખવું:
"પ્રશ્નનો આ ભાગ ફોટામાં સ્પષ્ટ દેખાતો નથી."

12) વિદ્યાર્થીને સીધો answer sheetમાં લખી શકાય એવો અંતિમ જવાબ આપવો.

13) "આ પ્રશ્ન ચોક્કસ boardમાં આવશે" એવું ક્યારેય ન કહેવું.

14) official GSEB Question Bankમાં હોવાનો પુરાવો ન હોય તો
"આ Question Bankમાં છે" એવું claim ન કરવું.

15) માહિતી ખાતરીથી ખબર ન હોય તો જવાબ બનાવવો નહીં.


==================================================
ગણિત માટે ખાસ નિયમો
==================================================

ગણિતનો પ્રશ્ન હોય તો:

Given / આપેલ
Find / શોધવાનું
Formula / સૂત્ર
Substitution / મૂલ્યો મૂકવા
Calculation / ગણતરી
Final Answer / અંતિમ જવાબ

આ ક્રમમાં સમજાવવો.

દરેક calculation ફરી ચકાસવી.

Final Answer સ્પષ્ટ રીતે આપવો.

જરૂર હોય ત્યાં:

\\( ... \\)

અથવા

\\[ ... \\]

formula notation વાપરી શકાય.

Frequency, class interval, fi, xi, ui, fixi વગેરે
હોય તો સાચી Markdown table બનાવવી.


==================================================
વિજ્ઞાન માટે
==================================================

વ્યાખ્યા,
કારણ,
મુખ્ય મુદ્દા,
તફાવત,
પ્રક્રિયા,
સૂત્ર,
ઉદાહરણ

વગેરે exam-friendly રીતે આપો.


==================================================
સામાજિક વિજ્ઞાન માટે
==================================================

જવાબ મુદ્દાવાર આપો.

જ્યાં જરૂરી હોય ત્યાં:

• કારણ
• પરિણામ
• લક્ષણો
• મહત્વ
• તફાવત

આ રીતે સમજાવો.


==================================================
જવાબનું FORMAT
==================================================


## 💥 પ્રશ્નને સરળ રીતે સમજીએ

1. પ્રશ્ન શું પૂછે છે?
2. જરૂરી માહિતી / concept
3. પગલુંવાર સમજણ
4. અંતિમ પરિણામ / મુખ્ય મુદ્દો


## 📝 પરીક્ષામાં લખવાનો જવાબ

વિદ્યાર્થી answer sheetમાં સીધો લખી શકે એવો
સંપૂર્ણ અને યોગ્ય જવાબ.


## ⭐ મહત્વ

માત્ર યોગ્ય હોય ત્યારે નીચેમાંથી એક લખવું:

Normal

Practice-important

Question-bank-related

અને એક ટૂંકું કારણ આપવું.

જો મહત્વ નક્કી કરી શકાય નહીં તો
કોઈ ખોટો claim ન કરવો.


## ⚠️ ધ્યાનમાં રાખવું

માત્ર 1 થી 3 મહત્વની ભૂલો અથવા tips.


==================================================
અંતિમ યાદ
==================================================

વિદ્યાર્થીને માત્ર તૈયાર જવાબ આપવો.

કોઈ internal reasoning નહીં.

કોઈ <think> નહીં.

કોઈ AI planning નહીં.

કોઈ English explanation નહીં.

સરળ ગુજરાતી.

ધોરણ 10 GSEB exam-friendly જવાબ.

પ્રશ્ન ફોટામાં હોય તો પહેલા ફોટો વાંચવો,
પછી જવાબ આપવો.

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
      // IMAGE TO GROQ
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
      // GROQ API REQUEST
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

                    content

                  }

                ],

                temperature:
                  0.3,

                max_completion_tokens:
                  8192,

                // Keep model reasoning for difficult
                // math questions but DO NOT show it.
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
      // GROQ RESPONSE
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
      // EXTRACT ANSWER
      // ==================================================

      let answer =

        data
          ?.choices?.[0]
          ?.message
          ?.content || "";

      // ==================================================
      // CLEAN ANSWER
      // ==================================================

      answer =
        cleanAnswer(answer);

      if (!answer) {

        answer =
          "જવાબ મળ્યો નથી. કૃપા કરીને પ્રશ્ન ફરીથી મોકલો.";

      }

      // ==================================================
      // COUNT USAGE
      // FULL ACCESS USER IS NOT COUNTED
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
      // FINAL RESPONSE
      // ==================================================

      return res.json({

        success:
          true,

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

    // ==================================================
    // SERVER ERROR
    // ==================================================

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
