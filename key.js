const express = require("express");
const cors = require("cors");
const app = express();
const port = 8080;
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());


let browserArray = [];
app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.post("/opentest", async (req, res) => {
  const { key } = req.body;
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: false,
  });
  browserArray.push({ key: key, browser: browser });
  const page = await browser.newPage();
  await page.goto(
    "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index.xml",
    {
        waitUntil: "networkidle2",
    }
  );
  await page.$eval("#query", (el, key) => (el.value = key), key);
  req.session.save((err) => {
    if (err) {
      console.log(err);
      return res.status(500).send("<h1>500 error</h1>");
    }
    // console.log(browserArray);
    // console.log(`page : ${page}`);
    console.log(page);
    res.send("ok");
  });
});

app.post("/inputtest", async (req, res) => {
  // 요청 데이터 확인
  const { key } = req.body;
  var foundBrowser = browserArray.find((e) => e.key === key);
  const browser = foundBrowser.browser;
  const pages = await browser.pages();
  console.log(pages);
  const page = pages[0];
  console.log(page);
  await page.goto("https://www.google.com/", {
    waitUntil: "networkidle2",
  });
  //   await page.$eval("#query", (el, key) => (el.value = key), key);
  req.session.save((err) => {
    if (err) {
      console.log(err);
      return res.status(500).send("<h1>500 error</h1>");
    }
    res.send("ok");
  });
  //   res.send("ok");
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});