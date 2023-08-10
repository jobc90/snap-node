const express = require('express');
const cors = require('cors');
const app = express();
const port = 8080;
const crypto = require('crypto');

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

let browserArray = [];

app.post('/hometax', async (req, res) => {
  const userData = req.body;
  console.log(userData);
  const key = generateSecretKey();
  console.log(key)

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: false,
  });
  
  const homtaxPage = await browser.newPage();
  browserArray.push({ key: key, browser: browser });

    // 국세청 홈택스 페이지 이동
    await homtaxPage.goto(
        "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index.xml",
        {
            waitUntil: "networkidle2",
        }
    );

    await homtaxPage.$eval("#query", (el, key) => (el.value = key), key);
    


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
        // console.log(certification);
        // console.log(userData.provider)
        if (certification == userData.provider) {
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
    await homtaxPage.keyboard.type(userData.name);
    await homtaxPage.waitForTimeout(100);

    await frameInner2.focus(
        "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > div.tab-content > div:nth-child(1) > ul > li:nth-child(2) > div.ul-td > input"
    );
    await homtaxPage.keyboard.type(userData.birth);
    await homtaxPage.waitForTimeout(100);

    await frameInner2.focus(
        "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > div.tab-content > div:nth-child(1) > ul > li.none-telecom > div.ul-td > input"
    );
    await homtaxPage.keyboard.type(userData.phone);
    await homtaxPage.waitForTimeout(100);

    // 약관 동의
    await frameInner2.$eval(
        "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > dl.agree > dt > label",
        (elem) => elem.click()
    );

    //인증요청
    await frameInner2.$eval("#oacx-request-btn-pc", (elem) => elem.click());
    // await frameInner2.click("#oacx-request-btn-pc");
    //   homtaxPage.close();
    console.log("인증요청 완료");

    res.send("no problem");
});

// 생년월일 입력 테스트
app.post('/birth', async (req, res) => {
  const userData = req.body;
  var foundBrowser = browserArray.find((e) => e.key === userData.key);
  const browser = foundBrowser.browser;
  const pages = await browser.pages();
  const homtaxPage = pages[1];

  const frameInner2 = homtaxPage
  .frames()
  .find((frame) => frame.name() === "simple_iframeView");
  
  await frameInner2.focus(
      "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > div.tab-content > div:nth-child(1) > ul > li:nth-child(2) > div.ul-td > input"
      );
      await homtaxPage.keyboard.type(userData.birth);
      await homtaxPage.waitForTimeout(100);
  // res.send('Success');
    //인증요청
    await frameInner2.$eval("#oacx-request-btn-pc", (elem) => elem.click());
    // await frameInner2.click("#oacx-request-btn-pc");
    //   homtaxPage.close();
    console.log("인증요청 완료");
});

//인증여부 확인
app.post("/auth_check", async (req, res) => {
    const userData = req.body;
    var foundBrowser = browserArray.find((e) => e.key === userData.key);
    const browser = foundBrowser.browser;
    const pages = await browser.pages();
    const homtaxPage = pages[1];
  
    const frameInner2 = homtaxPage
    .frames()
    .find((frame) => frame.name() === "simple_iframeView");

    await frameInner2.click(
      "#oacxEmbededContents > div.standby > div > button.basic.sky.w70"
    );
    await homtaxPage.waitForTimeout(500);
  
    try {
      await frameInner2.$eval(
        "#oacxEmbededContents > div.alertArea > div > div.btnArea > button",
        (elem) => elem.click()
      );
      res.send({ msg: "인증을 완료해주세요" });
    } catch (error) {
      res.send({ msg: "auth OK" });
    }
    // if ((await homtaxPage.$("#simple_iframeView")) !== null) {
    //   console.log("found");
    //   await frameInner2.$eval(
    //     "#oacxEmbededContents > div.alertArea > div > div.btnArea > button",
    //     (elem) => elem.click()
    //   );
    // } else {
    //   console.log("not found");
    // }
});

app.post("/homtax_registration", async (req, res) => {

    const userData = req.body;
    var foundBrowser = browserArray.find((e) => e.key === userData.key);
    const browser = foundBrowser.browser;
    const pages = await browser.pages();
    const homtaxPage = pages[1];

    await homtaxPage.waitForTimeout(3000);
  
    //사업자 등록 간편 신청-통신판매업 이동
    await homtaxPage.hover("#group1304");
    // await homtaxPage.click("#menuAtag_0306100000"); //클릭 에러
    await homtaxPage.$eval("#menuAtag_0306100000", (elem) => elem.click());
  
    await homtaxPage.waitForTimeout(8000);
  
    //프레임
    const frame = homtaxPage
      .frames()
      .find((frame) => frame.name() === "txppIframe");
  
    // //인적사항 입력
    // //휴대전화번호
    // // await frame.evaluate(() => {
    // //   document.querySelector("#mpno1 > option:nth-child(2)").selected = true; //010
    // // });
    // await frame.click("#mpno1");
    // await homtaxPage.waitForTimeout(300);
    // await homtaxPage.keyboard.press("ArrowDown");
    // await homtaxPage.keyboard.press("Enter");
  
    // await frame.$eval(
    //   "#mpno2",
    //   (el, userData) => (el.value = userData.phoneFirst),
    //   userData
    // );
    // await frame.$eval(
    //   "#mpno3",
    //   (el, userData) => (el.value = userData.phoneSecond),
    //   userData
    // );
    // await homtaxPage.waitForTimeout(300);
    // homtaxPage.on("dialog", async (dialog) => {
    //   await dialog.accept();
    // });
    // await frame.$eval(
    //   "#mpInfrRcvnAgrYn > div.w2radio_item.w2radio_item_0 > label",
    //   (el) => el.click()
    // );
  
    // // 1. 가게, 사무실 등 사업장을 빌리셨습니까?
    // // 2. 공동사업을 하십니까?
    // // 3. 서류송달장소는 사업장 주소 외 별도 주소지를 희망하십니까?
  
    // await frame.focus("#tnmNm");
    // await homtaxPage.keyboard.type(userData.companyName);
    // await frame.focus("#ofbDt_input");
    // await homtaxPage.keyboard.type(userData.openingDate);
  
    // // await frame.evaluate(() => {
    // //   document.querySelector("#tnmNm").click();
    // // });
    // // await frame.$eval("#tnmNm", (el) => (el.value = "상호명입력스"));
    // // await frame.evaluate(() => {
    // //   document.querySelector("#ofbDt_input").click();
    // // });
    // // await frame.$eval("#ofbDt_input", (el) => (el.value = "20210915"));
  
    // //주소지 동일 여부 (여)
    // await frame.evaluate(() => {
    //   document
    //     .querySelector("#lcrsSameYn > div.w2radio_item.w2radio_item_0 > label")
    //     .click();
    // });
  
    // //주소이전시 사업장 소재지 자동이전 (동의하지 않음)
    // await frame.evaluate(() => {
    //   document
    //     .querySelector(
    //       "#pfbTlcAltAgrYn > div.w2radio_item.w2radio_item_1 > label"
    //     )
    //     .click();
    // });
  
    // //업종 선택
    // await frame.evaluate(() => {
    //   document.querySelector("#triggerTfbBtnAdd").click();
    // });
  
    // await homtaxPage.waitForTimeout(1000);
  
    // //UTEABAAA85_iframe
    // const category_frame = homtaxPage
    //   .frames()
    //   .find((frame) => frame.name() === "UTEABAAA85_iframe");
    // await category_frame.evaluate(() => {
    //   document
    //     .querySelector("#baseXpsrGridListDes_cell_0_9 > span > button")
    //     .click();
    // });
  
    // await homtaxPage.waitForTimeout(1000);
  
    // await category_frame.evaluate(() => {
    //   document.querySelector("#triggerTfbAplnAdd").click();
    // });
  
    // //사업자 유형 선택
    // if (userData.taxpayerType === "simplified") {
    //   await frame.evaluate(() => {
    //     document
    //       .querySelector("#vatTxtpeCd > div.w2radio_item.w2radio_item_1 > label")
    //       .click();
    //   });
    // } else if (userData.taxpayerType === "general") {
    //   await frame.evaluate(() => {
    //     document
    //       .querySelector("#vatTxtpeCd > div.w2radio_item.w2radio_item_0 > label")
    //       .click();
    //   });
    // } else if (userData.taxpayerType === "dutyfree") {
    //   await frame.evaluate(() => {
    //     document
    //       .querySelector("#vatTxtpeCd > div.w2radio_item.w2radio_item_2 > label")
    //       .click();
    //   });
    // }
  
    // //저장후다음
    // await frame.evaluate(() => {
    //   document.querySelector("#triggerApln").click();
    // });
  
    // //제출서류선택
    // await homtaxPage.waitForTimeout(4000);
    // await browser.pages().then(async (data) => {
    //   await data[2].waitForSelector("#trigger13");
    //   await data[2].click("#trigger13");
    // });
  
    // //증빙서류 첨부 안내
    // await homtaxPage.waitForTimeout(4000);
    // await browser.pages().then(async (data) => {
    //   await data[2].waitForSelector("#triggerApln");
    //   await data[2].click("#triggerApln");
    // });
  
    // //최종확인
    // await homtaxPage.waitForTimeout(4000);
    // await browser
    //   .pages()
    //   .then(async (data) => {
    //     //팝업 확인
    //     data[2].on("dialog", async (dialog) => {
    //       await dialog.accept();
    //     });
    //     await data[2].waitForSelector("#acceptYn > div > label");
    //     await data[2].click("#acceptYn > div > label");
    //     await data[2].waitForSelector("#trigger14");
    //     await data[2].click("#trigger14");
    //     //신청서 제출하기 클릭
    //     await data[2].waitForTimeout(300);
    //     await data[2].waitForSelector("#trigger13");
    //     await data[2].click("#trigger13");
    //   })
    //   .then(async () => {
    //     await homtaxPage.waitForTimeout(1500);
    //     await browser.pages().then(async (data) => {
    //       await data[2].close();
    //     });
    //   });
    console.log("홈택스 전송 완료");
  
    res.send("no problem");
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});