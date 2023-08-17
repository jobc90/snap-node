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
let userPhone = ""

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
    userPhone = userData.phone
    await homtaxPage.keyboard.type(userPhone);
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
  
    try {
      const frameInner2 = homtaxPage
      .frames()
      .find((frame) => frame.name() === "simple_iframeView");
      await frameInner2.waitForTimeout(500);
      // console.log("프레임 찾음")

      await frameInner2.$eval(
        "#oacxEmbededContents > div.standby > div > button.basic.sky.w70",
        (elem) => elem.click()
      );
      // console.log("클릭완료")
      
      await homtaxPage.waitForTimeout(500);
      res.send({ msg: "인증 완료" });
    } catch (error) {
      res.send({ msg: "인증이 완료되지 않았습니다." });
    }
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
  
    //////////////////////////////////인적사항 입력///////////////////////////////////
    
    const phoneFirst = userPhone.substring(0, 4);
    const phoneSecond = userPhone.substring(4);

    //휴대전화 앞자리 010 선택
    await frame.click("#mpno1");
    await homtaxPage.waitForTimeout(300);
    await homtaxPage.keyboard.press("ArrowDown");
    await homtaxPage.keyboard.press("Enter");

    //휴대전화 중간 4자리
    await frame.$eval(
      "#mpno2",
      (el, phoneFirst) => (el.value = phoneFirst),
      phoneFirst
    );

    //휴대전화 마지막 4자리
    await frame.$eval(
      "#mpno3",
      (el, phoneSecond) => (el.value = phoneSecond),
      phoneSecond
    );

    // 국세정보문자수신동의
    await homtaxPage.waitForTimeout(300);

    let dialogHandled = false;
    homtaxPage.on("dialog", async (dialog) => {
      if (!dialogHandled) {
        await dialog.accept();
        dialogHandled = true;
      }
    });
    await frame.$eval(
      "#mpInfrRcvnAgrYn > div.w2radio_item.w2radio_item_0 > label",
      (el) => el.click()
    );

    await frame.focus("#tnmNm");
    await homtaxPage.keyboard.type(userData.companyName);
    await frame.focus("#ofbDt_input");
    await homtaxPage.keyboard.type(userData.openingDate);


    // 주소 문자열을 공백을 기준으로 분리
    const addressParts = userData.roadAddress.split(" ");
    // 첫 번째 부분은 주소 헤더 (조방로26번길)
    const addressHeader = addressParts.shift();
    // 다음 부분은 주소 번호 (7)
    const addressBody = addressParts.shift();
    // 남은 부분은 상세 주소 (101동 1401호)
    const addressTail = addressParts.join(" ");
  
    try {
      // await homtaxPage.waitForSelector("#lcrsSameYn");
      
      // 분기 1. 가게, 사무실 등 사업장을 빌리셨습니까?(default : 아니오)
      if (userData.isBuildingOwner == true) {
        console.log("빌딩소유 확인")
          // 분기 1-1 주소지 동일여부(default : 여)
            if(userData.useSameAddress == true) {
              console.log("주소지 동일 확인")
              await frame.evaluate(() => {
                document.querySelector(
                  "#lcrsSameYn > div.w2radio_item.w2radio_item_0 > label"
                  ).click();
              });
              //주소이전시 사업장 소재지 자동이전 (default : 동의하지 않음)
              if(userData.autoChangeAddress == false) {

                await frame.evaluate(() => {
                  document.querySelector(
                    "#pfbTlcAltAgrYn > div.w2radio_item.w2radio_item_1 > label"
                  ).click();
                });
                //주소이전시 사업장 소재지 자동이전 (동의)
              } else if(userData.autoChangeAddress == true) {
                await frame.evaluate(() => {
                  document.querySelector(
                    "#pfbTlcAltAgrYn > div.w2radio_item.w2radio_item_0 > label"
                  ).click();
                });
              }

            } else if(userData.useSameAddress == false) {
              // 분기 1-1 주소지 동일여부(부 체크시 주소검색입력)
              await frame.$eval("#triggerAdrPopup", (elem) => elem.click());
              await homtaxPage.waitForTimeout(1000);
              // 주소 입력 팝업
              try {
                const frameInner = homtaxPage
                .frames()
                .find((frame) => frame.name() === "UTECMAAA02_iframe");
                


                await frameInner.focus("#inputSchRoadNm1");
                await homtaxPage.keyboard.type(addressHeader);
                await homtaxPage.waitForTimeout(100);
                await frameInner.$eval("#trigger15", (elem) => elem.click());
                await frameInner.waitForSelector("#G_adrCtlAdmDVOList1___radio_radio0_0");
                await frameInner.$eval("#G_adrCtlAdmDVOList1___radio_radio0_0", (elem) => elem.click());
                console.log(addressBody);
                console.log(addressTail);
                // `.asd > nth-child(${index})`
                // #adrCtlAdmDVOList1_cell_0_3
                // #G_adrCtlAdmDVOList1___radio_radio0_0
                // #adrCtlAdmDVOList1_cell_1_3
                // #G_adrCtlAdmDVOList1___radio_radio0_1
                // #adrCtlAdmDVOList1_cell_4_3
                // #G_adrCtlAdmDVOList1___radio_radio0_4
                //#adrCtlAdmDVOList1_cell_0_3 > span
                //`#adrCtlAdmDVOList1_cell_${inputValue - 1}_3`

  const selector = '#adrCtlAdmDVOList1_body_tbody > tr.grid_body_row';
  const counts = await frameInner.$eval((selector) => {
    return document.querySelectorAll(selector).length;
  }, selector);
  console.log(counts);

  // for (let index = 0; index < counts; index++) {
  //   let certification = await frameInner2.$eval(
  //     "#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul > li:nth-child(" +
  //       (index + 1) +
  //       ") > label > span > p",

  //     (element) => {
  //       return element.innerText;
  //     }
  //   );
  //   // console.log(certification);
  //   if (certification == userData.method) {
  //     await frameInner2.click(
  //       "#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul > li:nth-child(" +
  //         (index + 1) +
  //         ") > label > a"
  //     );
  //     break;
  //   }
  // }
                
              } catch (error) {
                console.error("주소입력창을 찾을 수 없습니다.", error);
              }

            }
      } else {

      }
    } catch (error) {
      console.error("Error:", error);
    }


    

    // 2. 공동사업을 하십니까?
    // 3. 서류송달장소는 사업장 주소 외 별도 주소지를 희망하십니까?
  

  
  

  

    
  
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