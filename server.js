import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.get("/", (req, res) => {
  res.send("GSEB Std 10 Study Helper API is running.");
});

app.post("/api/solve", upload.single("image"), async (req, res) => {
  try {
    const question = req.body.question || "";

    if (!question && !req.file) {
      return res.status(400).json({
        error: "Question અથવા photo આપો."
      });
    }

    const prompt = `
તમે GSEB ધોરણ 10ના અનુભવી શિક્ષક છો.

વિદ્યાર્થીના પ્રશ્નનો જવાબ ગુજરાત બોર્ડની પરીક્ષા માટે યોગ્ય રીતે આપો.

નિયમો:
1. જવાબ ગુજરાતી ભાષામાં આપો.
2. Board-style answer આપો.
3. પ્રશ્ન પ્રમાણે જ જવાબ આપો, અનાવશ્યક માહિતી ન આપો.
4. ગણિત હોય તો Given, Formula, Calculation અને Final Answer સ્પષ્ટ રીતે આપો.
5. ગણિતમાં દરેક step સરળ રીતે બતાવો.
6. જ્યાં જરૂરી હોય ત્યાં table બનાવો.
7. પ્રશ્ન image/photoમાંથી હોય તો image ધ્યાનથી વાંચીને જવાબ આપો.
8. જવાબ પરીક્ષામાં લખી શકાય એવો હોવો જોઈએ.
9. મહત્વની વ્યાખ્યા, સૂત્ર અને અંતિમ જવાબ સ્પષ્ટ રાખો.
10. જો diagram/exploding-view જરૂરી હોય તો સરળ text/step formatમાં સમજાવો.
11. ખોટી માહિતી બનાવશો નહીં. પ્રશ્ન સ્પષ્ટ ન હોય તો તે વાત જણાવો.

વિદ્યાર્થીનો પ્રશ્ન:
${question}
`;

    const parts = [{ text: prompt }];

    if (req.file) {
      parts.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString("base64")
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: parts
        }
      ]
    });

    res.json({
      answer: response.text || "જવાબ મળ્યો નથી."
    });

  } catch (error) {
    console.error("Gemini error:", error);

    res.status(500).json({
      error: "જવાબ બનાવવામાં સમસ્યા આવી. થોડા સમય પછી ફરી પ્રયાસ કરો."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GSEB Study Helper running on port ${PORT}`);
});
