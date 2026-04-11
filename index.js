const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// Fix SSL issues
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
      rejectUnauthorized: false
        })
        });

        // Gemini setup
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Health check
        app.get("/", (req, res) => {
          res.json({ status: "working" });
          });

          // MAIN API
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
                                    // Fetch website
                                        const response = await axiosInstance.get(url);
                                            const html = response.data;
                                                const $ = cheerio.load(html);

                                                    // Extract data
                                                        const title = $("title").text();
                                                            const metaDescription = $("meta[name='description']").attr("content");
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
                                                                        4. Exact fixes (copy-paste ready)`;

                                                                            // Gemini AI
                                                                                const result = await model.generateContent(prompt);
                                                                                    const aiText = result.response.text();

                                                                                        // Response
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

                                                                                                                                          // Start server
                                                                                                                                          const PORT = process.env.PORT || 3000;
                                                                                                                                          app.listen(PORT, () => {
                                                                                                                                            console.log("Server running on port " + PORT);
                                                                                                                                            });