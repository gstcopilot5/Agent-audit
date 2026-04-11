const express = require("express");
const app = express();

app.use(express.json());

const https = require("https");
const axios = require("axios").create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.get("/", (req, res) => {
  res.json({ status: "working" });
});

app.post("/audit", async (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (apiKey !== process.env.PRIVATE_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL required" });
  }

  try {
    // Fetch HTML
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const title = $("title").text();
    const metaDescription = $('meta[name="description"]').attr("content");
    const h1 = $("h1").first().text();

    


    // AI Prompt
    const prompt = `Website: ${url}
Title: ${title}
Meta: ${metaDescription || "missing"}
H1: ${h1 || "missing"}

Give:
1. SEO issues
2. UX problems
3. Conversion improvements
4. Exact fixes (copy-paste ready)`
Title: ${title}
Meta: ${metaDescription || "missing"}
H1: ${h1 || "missing"}

Give:
1. SEO issues
2. UX problems
3. Conversion improvements
4. Exact fixes (copy-paste ready)``

const result = await model.generateContent(prompt);

const aiText = result.response.text();

res.json({
  url,
  title,
  metaDescription,
  h1,
  aiReport: aiText
});

} catch (e) {
 console.error(e);
 res.status(500).json({ error: "Audit failed" });
}
});



res.json({

  url,

  title,

  metaDescription,

  h1,

  aiReport: aiText

});

Website: ${url}
Title: ${title}
Meta: ${metaDescription || "missing"}
H1: ${h1 || "missing"}
Performance Score: N/A

Give:
1. SEO issues
2. UX problems
3. Conversion improvements
4. Exact fixes (copy-paste ready)`
`;

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

res.json({
  url,
  title,
  metaDescription,
  h1,
  aiReport: aiText
});

} catch (e) {
 console.error(e);
 res.status(500).json({ error: "Audit failed" });
}
});

    res.json({
      url,
      performance,
      ai_report: aiText,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Audit failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running");
});
} catch (e) {
 console.error(e);
 res.status(500).json({ error: "Audit failed" });
 }
});
