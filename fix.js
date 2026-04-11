const https = require("https");
const axios = require("axios").create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});
