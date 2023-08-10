const express = require('express');
const cors = require('cors');
const session = require('express-session');
const app = express();
const port = 8080;
const crypto = require('crypto');

const { executablePath } = require("puppeteer");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// crypto를 사용하여 secretkey생성하는 함수 만들기
function generateSecretKey() {
    return crypto.randomBytes(32).toString('hex');
}

// 클라이언트의 세션을 생성할 때 secretkey를 부여한다.
app.use(session({
    secret: generateSecretKey(),
    resave: false,
    saveUninitialized: true,
  }));
console.log(session.secret);

app.post('/hometax', async (req, res) => {
    const sessionSecretKey = req.session.secret;

    // 클라이언트 세션과 연결된 기존 브라우저 인스턴스가 있는지 확인
    if (!req.session.browser) {
        // 새로운 Puppeteer 브라우저 인스턴스를 만든다.
        const browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            headless: false,
            executablePath: executablePath(),
        });
        // 새로 생성된 브라우저 인스턴스를 req.session 개체의 browser 속성으로 설정하여 특정 클라이언트와 연결
        req.session.browser = browser;
    }

    // 요청 데이터 확인
    const { name, provider } = req.body;
    console.log(`Received name: ${name}`);
    console.log(`Received provider: ${provider}`);
    // 특정 클라이언트세션(req.session.browser)에 대한 Puppeteer 브라우저 인스턴스에서 새페이지 생성
    const homtaxPage = await req.session.browser.newPage();
    // 국세청 홈택스 페이지 이동
    await homtaxPage.goto(
        "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index.xml",
        {
            waitUntil: "networkidle2",
        }
    );

    // 로그인 클릭
    await homtaxPage.click("#group88615548");

    // 로그인 방식 간편인증 선택
    await homtaxPage.waitForTimeout(3000);

    const frame = homtaxPage
        .frames()
        .find((frame) => frame.name() === "txppIframe");
    await frame.waitForSelector("#anchor14");
    await frame.click("#anchor14");

    await frame.waitForSelector("#anchor23");
    await frame.click("#anchor23");

    // 간편인증
    await frame.waitForSelector("#UTECMADA02_iframe");
    await homtaxPage.waitForTimeout(3000);

    const frameInner = homtaxPage
    .frames()
    .find((frame) => frame.name() === "UTECMADA02_iframe");

    await frameInner.waitForSelector("#simple_iframeView");
    const frameInner2 = homtaxPage
    .frames()
    .find((frame) => frame.name() === "simple_iframeView");

    //간편인증 인증서 선택
    let counts = await frameInner2.$eval(
        "#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul",
        (element) => {
            return element.childElementCount;
        }
    );
    //   console.log(counts); //11개(로그인 방식)

    for (let index = 0; index < counts; index++) {
        let certification = await frameInner2.$eval(
            "#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul > li:nth-child(" +
            (index + 1) +
            ") > label > span > p",
            (element) => {
            return element.innerText;
            }
        );
        console.log(certification);
        if (certification == provider) {
            await frameInner2.click(
                "#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul > li:nth-child(" +
                (index + 1) +
                ") > label > a"
            );
        break;
        }
    }
    //본인인증 정보 입력
    await frameInner2.focus(
        "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > div.tab-content > div:nth-child(1) > ul > li:nth-child(1) > div.ul-td > input[type=text]"
    );
    await homtaxPage.keyboard.type(name);
    await homtaxPage.waitForTimeout(100);

});

// 생년월일 입력 테스트
app.post('/birth', async (req, res) => {

    try {
    // Make sure that req.session.browser exists and contains a valid browser instance
    if (!req.session.browser) {
        throw new Error('Puppeteer browser instance is not available');
    }
    
    const homtaxPage = await req.session.browser.newPage();
    await homtaxPage.focus(
        "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > div.tab-content > div:nth-child(1) > ul > li:nth-child(2) > div.ul-td > input"
        );
        await homtaxPage.keyboard.type(birth);
        await homtaxPage.waitForTimeout(100);
    res.send('Success');

    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).send('Error occurred');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
