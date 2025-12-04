require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const Parser = require("rss-parser");
const { JSDOM } = require("jsdom"); // For server-side DOM parsing
const { Readability } = require("@mozilla/readability"); // For extracting clean article content
const http = require('http');

// Initialize RSS Parser
const parser = new Parser();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const NEWS_KEY = process.env.NEWSDATA_KEY;

// ====== DEBUG ENV ======
console.log("🔑 NEWSDATA_KEY Loaded:", NEWS_KEY ? "YES" : "NO");

// -------------------------------------------------------
// 🔍 SANITIZE USER SEARCH INPUT
// -------------------------------------------------------
function cleanQuery(q) {
  // Use a simple keyword list for flexible searching
  return q
    .replace(/[^\w\s]/g, " ") // remove special chars
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase(); // Convert to lower case here for easier filtering
}

// -------------------------------------------------------
// 📌 RSS FEED SOURCES (Fastest and Free Source)
// -------------------------------------------------------
const RSS_SOURCES = [
  "http://rss.cnn.com/rss/edition.rss",
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://www.aljazeera.com/xml/rss/all.xml",
];

// -------------------------------------------------------
// 🔥 /search — Main Search Endpoint (Layered Search Logic)
// -------------------------------------------------------
app.get("/search", async (req, res) => {
  let query = req.query.query || "";
  query = cleanQuery(query);

  console.log("\n==============================");
  console.log("🔎 Search Query:", query);
  console.log("==============================\n");

  if (!query)
    return res.status(400).json({ error: "Missing or invalid query" });

  const keywords = query.split(' ').filter(k => k.length > 2);

  // ----------------------------------------------
  // 1️⃣ Try RSS First (Fastest & Free) - FIXED FILTERING
  // ----------------------------------------------
  try {
    console.log("📡 Checking RSS feeds...");
    let rssResults = [];

    for (let feed of RSS_SOURCES) {
      try {
        const rss = await parser.parseURL(feed);

        rss.items.forEach((item) => {
          const contentToSearch = (item.title || "") + " " + (item.contentSnippet || "");
          const contentLower = contentToSearch.toLowerCase();

          // FIX: Check if AT LEAST ONE keyword exists in the combined content
          const isMatch = keywords.some(keyword => contentLower.includes(keyword));

          if (isMatch) {
            rssResults.push({
              title: item.title,
              link: item.link,
              source: rss.title || 'RSS Feed',
              // Including the snippet here if it exists, for better FE display
              contentSnippet: item.contentSnippet || null
            });
          }
        });
      } catch (err) {
        console.log(`⚠️ RSS failed for feed ${feed.substring(0, 30)}...`);
      }
    }

    if (rssResults.length > 0) {
      console.log("✅ RSS Success:", rssResults.length, "articles\n");
      return res.json({ resultType: "rss", results: rssResults.slice(0, 20) });
    }

    console.log("⚠️ RSS empty → Falling back to NewsData.io");

  } catch (err) {
    console.log("❗ RSS parsing error:", err.message);
  }

  // ----------------------------------------------
  // 2️⃣ NewsData.io (API Fallback)
  // ----------------------------------------------
  if (NEWS_KEY) {
      try {
          console.log("🌐 NewsData.io requesting...");

          // Note: NewsData API uses 'q' for query which is already URL-safe via encodeURIComponent
          const url = `https://newsdata.io/api/1/news?apikey=${NEWS_KEY}&q=${encodeURIComponent(
              query
          )}`;

          const response = await axios.get(url);
          const data = response.data;

          console.log("🟢 NewsData API status:", data.status);

          if (data.results && data.results.length > 0) {
              console.log("✅ NewsData Success:", data.results.length, "articles\n");

              const mapped = data.results.map((n) => ({
                  title: n.title,
                  link: n.link,
                  source: n.source_id,
                  contentSnippet: n.description || null
              }));

              return res.json({
                  resultType: "newsdata",
                  results: mapped.slice(0, 20),
              });
          }

          console.log("⚠️ NewsData returned 0 results → Fallback to Google News");

      } catch (err) {
          console.log("❗ NewsData Error:", err.message);
      }
  } else {
      console.log("🚫 Skipping NewsData.io: API Key not loaded.");
  }


  // ----------------------------------------------
  // 3️⃣ Google News (HTML Scraping Fallback) - FIXED SELECTOR
  // ----------------------------------------------
  try {
    console.log("🔍 Scraping Google News...");

    const gUrl = `https://news.google.com/search?q=${encodeURIComponent(
      query
    )}&hl=en-US&gl=US&ceid=US:en`;

    const response = await axios.get(gUrl, {
      // Improved User-Agent for better anti-bot detection avoidance
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36" }, 
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // FIX: Using a more stable selector combination targeting H3 headlines
    const articleHeadlines = document.querySelectorAll("h3 a"); 

    const results = [];

    articleHeadlines.forEach((t) => {
      let link = t.href || "";

      if (link.startsWith("./")) {
        // Fix relative link format returned by Google
        link = "https://news.google.com" + link.slice(1);
      }

      // Only push valid results
      if (t.textContent.trim() && link.length > 20) {
          results.push({
              title: t.textContent.trim(),
              link,
              source: "Google News",
          });
      }
    });

    if (results.length > 0) {
      console.log("✅ Google News success:", results.length, "articles\n");
      return res.json({
        resultType: "google",
        results: results.slice(0, 20),
      });
    }

    console.log("❌ Google found 0 articles");

  } catch (err) {
    console.log("❗ Google Scraping Error:", err.message);
  }

  // ----------------------------------------------
  // ❌ Final: No results found
  // ----------------------------------------------
  return res.json({
    error: true,
    message: "No articles found from RSS, NewsData.io, or Google",
    query,
  });
});

// -------------------------------------------------------
// 📄 /fetch — Extract Article Content (Uses Readability)
// -------------------------------------------------------
app.get("/fetch", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing 'url' parameter" });

  try {
    console.log("📄 Fetching article:", url);

    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36" },
      // Increase timeout for slow article pages
      timeout: 10000 
    });

    const dom = new JSDOM(response.data, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article)
      return res.json({
        warning: "Could not extract readable content (Readability failed)",
      });

    res.json({
      title: article.title,
      content: article.textContent,
      byline: article.byline,
      siteName: article.siteName
    });

  } catch (err) {
    console.log(`❗ Fetch Error for ${url}:`, err.message);
    res.status(500).json({ error: "Failed to fetch or parse article content" });
  }
});

// -------------------------------------------------------
const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
// -------------------------------------------------------