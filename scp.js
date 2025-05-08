const axios = require("axios");
const cheerio = require("cheerio");

function harmonizeId(id) {
  return id.toString().padStart(3, "0");
}

function relaxKey(key) {
  return key.toLowerCase().replace(/ /g, "_");
}

const baseUrl = "http://www.scpwiki.com/scp-";

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

    if (currentKey) {
      const _k = relaxKey(currentKey);
      currentValue = currentValue.replace(/\u2588+/g, "[REDACTED]");
      resultDict[_k] = currentValue.trim();
    }

    const titleTag = $("title").text();
    if (titleTag) {
      resultDict["name"] = titleTag.split(" - ")[0];
    }

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

console.log("SCP Scraper initialized.");

(async () => {
  console.log(await scrapeSCP(123));
})();
