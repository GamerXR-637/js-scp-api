const axios = require("axios");
const cheerio = require("cheerio");

// Helper function to harmonize SCP ID
function harmonizeId(id) {
  return id.toString().padStart(3, "0"); // Converts the ID to a zero-padded 3-digit string
}

// Helper function to relax keys
function relaxKey(key) {
  return key.toLowerCase().replace(/ /g, "_"); // Converts "Object Class" to "object_class"
}

// Base URL for SCP Wiki
const baseUrl = "http://www.scpwiki.com/scp-";

// Main scraping function
async function scrapeSCP(id) {
  const resultDict = {};
  const _id = harmonizeId(id);
  const url = baseUrl + _id;

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Find the page content
    const pageContent = $("#page-content");
    if (!pageContent.length) {
      return { error: `Could not find page content for SCP-${_id}` };
    }

    const paragraphs = pageContent.find("p");
    let currentKey = null;
    let currentValue = "";
    let stop = false;

    paragraphs.each((_, paragraph) => {
      if (!stop) {
        const strongTag = $(paragraph).find("strong");

        if (strongTag.length) {
          if (currentKey) {
            const _k = relaxKey(currentKey);
            currentValue = currentValue.replace(/\u2588+/g, "[REDACTED]");
            resultDict[_k] = currentValue.trim();
          }

          currentKey = strongTag.text();
          currentValue = $(paragraph)
            .text()
            .substring(currentKey.length)
            .trim();
        } else if ($(paragraph).text().startsWith("«")) {
          stop = true;
        } else {
          if (currentValue) {
            currentValue += " ";
          }
          currentValue += $(paragraph).text();
        }
      }
    });

    // Add the last key-value pair
    if (currentKey) {
      const _k = relaxKey(currentKey);
      currentValue = currentValue.replace(/\u2588+/g, "[REDACTED]");
      resultDict[_k] = currentValue.trim();
    }

    // Extract the SCP name (if available)
    const titleTag = $("title").text();
    if (titleTag) {
      resultDict["name"] = titleTag.split(" - ")[0]; // Extract the name before " - SCP Foundation"
    }

    // Format the output as per the desired structure
    return {
      id: `SCP-${_id}`,
      more_info: Object.fromEntries(
        Object.entries(resultDict).filter(
          ([key]) =>
            ![
              "object_class",
              "special_containment_procedures",
              "description",
              "name",
            ].includes(key)
        )
      ),
    };
  } catch (error) {
    return { error: `Error fetching ${url}: ${error.message}` };
  }
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  const scpId = req.query.scp; // Get the SCP ID from the query parameter
  if (!scpId || isNaN(scpId)) {
    return res.status(400).json({ error: "Invalid or missing SCP ID" });
  }

  const scpData = await scrapeSCP(parseInt(scpId, 10));
  res.json(scpData);
};
