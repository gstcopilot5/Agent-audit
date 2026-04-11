const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "working" });
  });

  app.post("/audit", async (req, res) => {
    const { url } = req.body;

      if (!url) {
          return res.status(400).json({ error: "URL required" });
            }

              try {
                  const response = await axios.get(url);
                      const html = response.data;
                          const $ = cheerio.load(html);

                              const title = $("title").text();
                                  const metaDescription = $("meta[name='description']").attr("content");
                                      const h1 = $("h1").first().text();

                                          res.json({
                                                url,
                                                      title,
                                                            metaDescription,
                                                                  h1
                                                                      });

                                                                        } catch (e) {
                                                                            res.status(500).json({ error: "Failed" });
                                                                              }
                                                                              });

                                                                              app.listen(3000, () => {
                                                                                console.log("Server running on port 3000");
                                                                                });