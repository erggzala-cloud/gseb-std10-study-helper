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
// GEMINI SETTINGS
// ==================================================

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "";

const GEMINI_MODEL =
  "gemini-3.6-flash";

// ==================================================
// CLEAN GEMINI OUTPUT
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
// GSEB MASTER PROMPT
// ==================================================

function createMasterPrompt(
  question,
  subject,
  marks
) {

  return `

તમે GSEB ધોરણ 10ના અનુભવી શિક્ષક અને Study Helper છો.

વિષય: ${subject}

જવાબનું સ્તર: ${marks}


==================================================
🎓 તમારું મુખ્ય કામ
==================================================

વિદ્યાર્થીને GSEB ધોરણ 10ની પરીક્ષામાં સીધો ઉપયોગ કરી
શકે એવો સાચો, સરળ અને exam-friendly જવાબ આપવો.


==================================================
⚠️ ખૂબ મહત્વના નિયમો
==================================================

1. જવાબ મુખ્યત્વે સરળ અને સ્વાભાવિક ગુજરાતી ભાષામાં આપવો.

2. વિદ્યાર્થી answer sheetમાં સીધો લખી શકે એવો જવાબ આપવો.

3. અનાવશ્યક English explanation ન આપવી.

4. જરૂરી technical શબ્દો, formulas, mathematical symbols
અને scientific units English/standard notationમાં રાખી શકાય.

5. <think>, </think>, internal thinking, hidden reasoning,
analysis, planning અથવા AIની અંદરની પ્રક્રિયા ક્યારેય બતાવવી નહીં.

6. "The user", "Let's solve", "I think", "Analysis",
"Final Plan" જેવી AI ભાષા ન વાપરવી.

7. ફોટો આપવામાં આવ્યો હોય તો ફોટો ખૂબ ધ્યાનથી વાંચવો.

8. ફોટામાં એકથી વધુ પ્રશ્નો સ્પષ્ટ દેખાતા હોય તો
યોગ્ય ક્રમમાં બધા પ્રશ્નોના જવાબ આપો.

9. ફોટો અસ્પષ્ટ હોય અથવા પ્રશ્ન વાંચી ન શકાય તો
અંદાજથી જવાબ ન બનાવવો.

10. માહિતી ખાતરીથી ખબર ન હોય તો ખોટી માહિતી ન આપવી.

11. Exact board paper predictionની guarantee ન આપવી.

12. Official GSEB Question Bankમાં છે એવો દાવો
માત્ર ખાતરી હોય ત્યારે જ કરવો.


==================================================
📚 જવાબનું FORMAT
==================================================

જ્યાં યોગ્ય હોય ત્યાં નીચેનું structure જાળવો.


## 💥 પ્રશ્નને સરળ રીતે સમજીએ

પ્રશ્ન શું પૂછે છે તે સરળ ભાષામાં સમજાવો.


## 📌 આપેલ

પ્રશ્નમાં આપવામાં આવેલી માહિતી લખો.


## 🎯 શોધવાનું

શું શોધવાનું છે તે લખો.


## 🧮 પગલુંવાર ઉકેલ

દરેક step સ્પષ્ટ રીતે સમજાવો.

એક calculationમાંથી સીધા final answer પર jump ન કરવો.

જરૂર હોય ત્યાં:

સૂત્ર

મૂલ્યો મૂકવા

ગણતરી

પરિણામ

આ ક્રમ રાખવો.


## 📝 પરીક્ષામાં લખવાનો જવાબ

Answer sheetમાં સીધો લખી શકાય એવો
સુવ્યવસ્થિત final answer આપો.


## ⭐ મહત્વ

માત્ર યોગ્ય હોય ત્યારે:

Normal

Practice-important

Question-bank-related

માંથી યોગ્ય વર્ગ લખવો.

ખોટી રીતે "આ જ boardમાં આવશે" ન લખવું.


## ⚠️ ધ્યાનમાં રાખવું

મહત્તમ 1 થી 3 મહત્વની tips આપવી.


==================================================
➗ ગણિત માટે ખાસ નિયમો
==================================================

ગણિતના પ્રશ્નમાં:

1. આપેલ
2. શોધવાનું
3. સૂત્ર
4. મૂલ્યો મૂકવા
5. calculation
6. final answer

ક્રમમાં જવાબ આપવો.

દરેક calculation ધ્યાનથી ચકાસવી.

જરૂર હોય ત્યાં LaTeX વાપરી શકાય:

\\( ... \\)

અથવા

\\[ ... \\]

Frequency, class interval, fi, xi, ui, fixi વગેરે હોય
તો યોગ્ય table બનાવવી.

Linear equations હોય તો substitution,
elimination અથવા જરૂરી method પ્રમાણે
સંપૂર્ણ steps બતાવવા.


==================================================
🔬 વિજ્ઞાન માટે ખાસ નિયમો
==================================================

વ્યાખ્યા

કારણ

પ્રક્રિયા

સૂત્ર

લક્ષણો

તફાવત

મહત્વ

જરૂર મુજબ મુદ્દાવાર આપવું.


==================================================
🌍 સામાજિક વિજ્ઞાન માટે
==================================================

જવાબ મુદ્દાવાર આપવો.

જ્યાં જરૂરી હોય ત્યાં:

કારણ

પરિણામ

લક્ષણો

મહત્વ

તફાવત

ક્રમમાં સમજાવવું.


==================================================
💥 EXPLODING-VIEW STYLE
==================================================

જો પ્રશ્ન કોઈ process, machine, structure,
diagram, science process અથવા system વિશે હોય,
તો તેને "Exploding View" જેવી રીતે સમજાવો:

① મુખ્ય ભાગ

↓

② આગળનો ભાગ

↓

③ તેની અંદર શું થાય છે

↓

④ આગળની પ્રક્રિયા

↓

⑤ અંતિમ પરિણામ

દરેક ભાગનું કામ સરળ ગુજરાતી ભાષામાં સમજાવો.

જો કોઈ ભાગ ખરાબ થાય તો શક્ય problem પણ
જરૂર હોય ત્યારે સમજાવો.


==================================================
📷 PHOTO QUESTION
==================================================

ફોટામાં પ્રશ્ન હોય તો:

1. પહેલા ફોટો વાંચો.
2. પ્રશ્ન ઓળખો.
3. જરૂરી values / data ઓળખો.
4. પછી સંપૂર્ણ જવાબ આપો.
5. ફોટામાં દેખાતી handwriting અથવા print ને
અંદાજથી બદલશો નહીં.
6. જો પ્રશ્નનો કોઈ ભાગ વાંચી શકાય નહીં તો
સ્પષ્ટપણે જણાવો.


==================================================
🎯 FINAL QUALITY
==================================================

જવાબ:

સાચો

સરળ

Gujarati

GSEB Std 10 levelનો

Exam-friendly

Step-by-step

અને વિદ્યાર્થી માટે ઉપયોગી હોવો જોઈએ.


વિદ્યાર્થીનો પ્રશ્ન:

${question}

હવે ઉપરના બધા નિયમો પ્રમાણે માત્ર final વિદ્યાર્થી-friendly
જવાબ આપો.
`;

}

// ==================================================
// HOME PAGE
// ==================================================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(process.cwd(), "full.html")
  );

});

// ==================================================
// FULL PAGE
// ==================================================

app.get("/full", (req, res) => {

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
      "running",

    ai:
      "Gemini 3.6 Flash",

    access:
      "Full Access",

    dailyLimit:
      "Unlimited"

  });

});

// ==================================================
// GEMINI SOLVE FUNCTION
// ==================================================

async function solveWithGemini(
  req,
  res
) {

  try {

    // ==================================================
    // CHECK GEMINI KEY
    // ==================================================

    if (!GEMINI_API_KEY) {

      return res.status(500).json({

        success: false,

        error:
          "GEMINI_API_KEY Render Environment Variablesમાં set કરેલી નથી."

      });

    }

    // ==================================================
    // REQUEST DATA
    // ==================================================

    const question =
      (req.body?.question || "").trim();

    const subject =
      (
        req.body?.subject ||
        "અન્ય"
      ).trim();

    const marks =
      (
        req.body?.marks ||
        "વિગતવાર સમજણ"
      ).trim();

    const file =
      req.file;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!question && !file) {

      return res.status(400).json({

        success: false,

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

          success: false,

          error:
            "માત્ર image file upload કરો."

        });

      }

    }

    // ==================================================
    // MASTER PROMPT
    // ==================================================

    const prompt =
      createMasterPrompt(
        question,
        subject,
        marks
      );

    // ==================================================
    // GEMINI CONTENT PARTS
    // ==================================================

    const parts = [

      {
        text:
          prompt
      }

    ];

    // ==================================================
    // IMAGE INPUT
    // ==================================================

    if (file) {

      const base64Image =
        file.buffer.toString("base64");

      parts.push({

        inlineData: {

          mimeType:
            file.mimetype,

          data:
            base64Image

        }

      });

    }

    // ==================================================
    // GEMINI API REQUEST
    // ==================================================

    const response =
      await fetch(

        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,

        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-goog-api-key":
              GEMINI_API_KEY

          },

          body:
            JSON.stringify({

              contents: [

                {

                  role:
                    "user",

                  parts:
                    parts

                }

              ],

              generationConfig: {

                maxOutputTokens:
                  4096

              }

            })

        }

      );

    // ==================================================
    // READ RESPONSE
    // ==================================================

    const data =
      await response.json();

    // ==================================================
    // API ERROR
    // ==================================================

    if (!response.ok) {

      console.error(
        "Gemini API Error:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      return res.status(

        response.status >= 400 &&
        response.status < 500
          ? response.status
          : 500

      ).json({

        success:
          false,

        error:
          data?.error?.message ||
          "Gemini API માં સમસ્યા આવી."

      });

    }

    // ==================================================
    // EXTRACT ANSWER
    // ==================================================

    let answer =
      "";

    const candidates =
      data?.candidates || [];

    if (
      candidates.length > 0
    ) {

      const responseParts =
        candidates[0]
          ?.content
          ?.parts || [];

      answer =
        responseParts
          .filter(
            part =>
              typeof part.text ===
              "string"
          )
          .map(
            part =>
              part.text
          )
          .join("\n");

    }

    // ==================================================
    // CLEAN ANSWER
    // ==================================================

    answer =
      cleanAnswer(answer);

    // ==================================================
    // EMPTY ANSWER
    // ==================================================

    if (!answer) {

      answer =
        "જવાબ મળ્યો નથી. કૃપા કરીને પ્રશ્ન ફરીથી મોકલો.";

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
          true,

        dailyLimit:
          "Unlimited",

        usedToday:
          0,

        remainingToday:
          "Unlimited"

      }

    });

  }

  catch (error) {

    console.error(
      "SERVER ERROR:",
      error
    );

    return res.status(500).json({

      success:
        false,

      error:
        "Serverમાં સમસ્યા આવી. થોડા સમય પછી ફરી પ્રયાસ કરો."

    });

  }

}

// ==================================================
// FULL ACCESS API
// ==================================================

app.post(
  "/api/full-solve",
  upload.single("image"),
  solveWithGemini
);

// ==================================================
// NORMAL API
// ==================================================

app.post(
  "/api/solve",
  upload.single("image"),
  solveWithGemini
);

// ==================================================
// START SERVER
// ==================================================

app.listen(

  PORT,

  "0.0.0.0",

  () => {

    console.log(
      `GSEB Std 10 Study Helper running on port ${PORT}`
    );

    console.log(
      `AI Model: ${GEMINI_MODEL}`
    );

    console.log(
      "Access: Full / Unlimited"
    );

  }

);
