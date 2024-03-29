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

// crypto를 사용하여 secretkey생성하는 함수 만들기 (유저 판단용)
function generateSecretKey() {
  return crypto.randomBytes(32).toString('hex');
}

let browserArray = [];

// /hometax 더미데이터
// {
//   "provider":"네이버",
//   "name":"조병철",
//   "birth":"19900109",
//   "phone":"73673632"
// }


// 인증요청 API
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


    // 홈택스 이동후 간편인증 클릭
    try {
      await homtaxPage.goto(
          "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index.xml",
          {
              waitUntil: "networkidle2",
          }
      );

      await homtaxPage.$eval("#query", (el, key) => (el.value = key), key);
      await homtaxPage.click("#textbox915");
      await homtaxPage.waitForNetworkIdle();

      await homtaxPage.waitForSelector("#txppIframe");
      const frame = await homtaxPage
      .frames()
      .find((frame) => frame.name() === "txppIframe");

      try {
        async function clickAnchors(frame, anchor14Selector, anchor23Selector, counts) {
          await frame.waitForSelector(anchor14Selector);
          await frame.click(anchor14Selector);
        
          const anchor14clicked = await frame.evaluate((selector) => !!document.querySelector(selector), 'a#anchor14[title="탭 선택됨"]');
        
          if (anchor14clicked) {
            await frame.waitForSelector(anchor23Selector);
            await frame.click(anchor23Selector);
          } else {
            console.log("간편인증 클릭 시도 횟수:", counts);
            await clickAnchors(frame, anchor14Selector, anchor23Selector, counts+1);
          }
        }

        await clickAnchors(frame, "#anchor14", "#anchor23", 1);

      } catch (error) {
        console.error("간편인증 진행 중 에러발생함.", error);
        res.sendStatus(500);
        return;
      }

      try {
        async function findFrameInner(frame, counts) {
          await frame.waitForSelector("#UTECMADA02_iframe");
        
          const isFrameInner = await frame.evaluate((selector) => !!document.querySelector(selector), '#UTECMADA02_iframe');

          if (isFrameInner) {
            console.log("프레임1 찾음:", counts)
          } else {
            console.log("프레임1 찾기:", counts);
            await findFrameInner(frame, counts+1);
          }
        }

        await findFrameInner(frame, 1);
        
      } catch (error) {
        console.error("간편인증 진행 중 에러발생함.", error);
        res.sendStatus(500);
        return;
      }

      const frameInner = await homtaxPage
      .frames()
      .find((frame) => frame.name() === "UTECMADA02_iframe");

      try {
        async function findFrameInner2(frameInner, counts) {
          await frameInner.waitForSelector("#simple_iframeView");
        
          const isFrameInner2 = await frameInner.evaluate((selector) => !!document.querySelector(selector), '#simple_iframeView');

          if (isFrameInner2) {
            console.log("프레임2 찾음:", counts)
          } else {
            console.log("프레임2 찾기:", counts);
            await findFrameInner2(frameInner, counts+1);
          }
        }
        
        await findFrameInner2(frameInner, 1);
        
      } catch (error) {
        console.error("간편인증 진행 중 에러발생함.", error);
        res.sendStatus(500);
        return;
      }
      
      const frameInner2 = await frameInner
      .childFrames()
      .find((childFrame) => childFrame.name() === "simple_iframeView");

    // 간편인증 진행

      try {
        await frameInner2.waitForSelector("#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul > li:nth-child(1) > label > a");
        
        // 유저의 본인인증 정보 입력
        const userName = await frameInner2.$(
          "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > div.tab-content > div:nth-child(1) > ul > li:nth-child(1) > div.ul-td > input[type=text]"
        );
        await userName.type(userData.name);
        const userBirth = await frameInner2.$(
          "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > div.tab-content > div:nth-child(1) > ul > li:nth-child(2) > div.ul-td > input"
        );
        await userBirth.type(userData.birth);
        const userPhone = await frameInner2.$(
          "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > div.tab-content > div:nth-child(1) > ul > li.none-telecom > div.ul-td > input"
        );
        await userPhone.type(userData.phone);

        //간편인증 인증서 선택
        let counts = await frameInner2.$eval(
            "#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul",
            (element) => {
            return element.childElementCount;
            }
        );
    
        for (let index = 0; index < counts; index++) {
          let certification = await frameInner2.$eval(
          "#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul > li:nth-child(" +
              (index + 1) +
              ") > label > span > p",
          (element) => {
            return element.innerText;
          }
          );

          // 유저가 선택한 간편인증서 선택
          if (certification == userData.provider) {
          await frameInner2.click(
              "#oacxEmbededContents > div:nth-child(2) > div > div.selectLayout > div > div > ul > li:nth-child(" +
              (index + 1) +
              ") > label > a"
          );
          break;
          }
        }
    
        // 약관 동의
        await frameInner2.waitForSelector(
          "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > dl.agree > dt > label",
        );
        await frameInner2.$eval(
          "#oacxEmbededContents > div:nth-child(2) > div > div.formLayout > section > form > dl.agree > dt > label",
          (elem) => elem.click()
        );
    
        // 인증요청
        await frameInner2.$eval("#oacx-request-btn-pc", (elem) => elem.click());
        
      } catch (error) {
        console.error("간편인증 진행 중 에러발생함.", error);
        res.sendStatus(500);
        return;
      }

    } catch (error) {
      console.error("인증요청에서 에러발생함.", error);
      res.send(500);
      return;
    }
    res.send("인증요청 완료");
});

// /homtax_registration 더미데이터
// {
//   "key":"6f9ce03684b1acc91e7cdb2759cf5766e7ee1d82bdb1395e1b551f74bc8d8e09",
//   "userPhone":"73673632",
//   "companyName":"상호명입력테스트",
//   "openingDate":"20210304",
//   "useSameAddress":false,
//   "autoChangeAddress":true,
//   "isBuildingOwner":false,
//   "lentBuildingArea":"74",
//   "lentBuildingBusinessNumber":"3951401791",
//   "lentBuildingContractDate":"20210101",
//   "lentBuildingStartDate":"20210110",
//   "lentBuildingFinishDate":"20250110",
//   "roadAddress":"조방로26번길 7 101동 1401호",
//   "businessCategory":"SNS 마켓",
//   "snsMarketCategory":"전자상거래 소매업",
//   "taxpayerType":"간이",
//   "simpleTaxReq":false

// }

 // 사업자 등록 API
app.post("/homtax_registration", async (req, res) => {

    const userData = req.body;
    var foundBrowser = browserArray.find((e) => e.key === userData.key);
    const browser = foundBrowser.browser;
    const pages = await browser.pages();
    const homtaxPage = pages[1];
    
    try {
      const frameInner2 = await homtaxPage
      .frames()
      .find((frame) => frame.name() === "simple_iframeView");
      
      await frameInner2.waitForSelector("#oacxEmbededContents > div.standby > div > button.basic.sky.w70");
      await frameInner2.$eval(
        "#oacxEmbededContents > div.standby > div > button.basic.sky.w70",
        (elem) => elem.click()
      );
    } catch (error) {
      console.error("인증이 완료되지 않았습니다.", error);
    }

    await homtaxPage.waitForNetworkIdle();
  
    //사업자 등록 간편 신청-통신판매업 이동
    await homtaxPage.waitForSelector("#hdTextbox546");
    await homtaxPage.hover("#hdTextbox546");
    await homtaxPage.click("#menuAtag_4306010000");
    await homtaxPage.$eval("#menuAtag_4306010300", (elem) => elem.click());
  
    await homtaxPage.waitForTimeout(8000);
  
    // 프레임
    await homtaxPage.waitForSelector("#txppIframe");
    const frame = await homtaxPage
      .frames()
      .find((frame) => frame.name() === "txppIframe");
  
    //////////////////////////////////인적사항 입력///////////////////////////////////
    
    const phoneFirst = userData.userPhone.substring(0, 4);
    const phoneSecond = userData.userPhone.substring(4);

    //휴대전화 앞자리 010 선택
    await frame.waitForSelector("#mpno1");
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
    try {
      homtaxPage.on("dialog", async (dialog) => {
          await dialog.accept();
      });
      
    } catch (error) {
      console.log("dialog 확인 요망.")
    }
    
    await frame.$eval(
      "#mpInfrRcvnAgrYn > div.w2radio_item.w2radio_item_0 > label",
      (el) => el.click()
    );

    //////////////////////////////////사업장정보 입력///////////////////////////////////
    
    await frame.focus("#tnmNm");
    await homtaxPage.keyboard.type(userData.companyName);
    await frame.focus("#ofbDt_input");
    await homtaxPage.keyboard.type(userData.openingDate);

    try {
      // 분기 1 주소지 동일여부(default : 여)
      if(userData.useSameAddress == true) {
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
        // 분기 1 주소지 동일여부( 부 )
        await frame.$eval("#triggerAdrPopup", (elem) => elem.click());
        await homtaxPage.waitForTimeout(1000);
        // 주소 입력 팝업
        try {
          // 주소 문자열을 공백을 기준으로 분리
          const addressParts = userData.roadAddress.split(" ");
          // 첫 번째 부분은 주소 헤더 (조방로26번길)
          const addressHeader = addressParts.shift();
          // 다음 부분은 주소 번호 (7)
          const addressBody = addressParts.shift();
          // 남은 부분은 상세 주소 (101동 1401호)
          const addressTail = addressParts.join("");

          const frameInner = await homtaxPage
          .frames()
          .find((frame) => frame.name() === "UTECMAAA02_iframe");

          await frameInner.focus("#inputSchRoadNm1");
          await homtaxPage.keyboard.type(addressHeader);
          await homtaxPage.waitForTimeout(100);
          await frameInner.$eval("#trigger15", (elem) => elem.click());
          await frameInner.waitForSelector("#G_adrCtlAdmDVOList1___radio_radio0_0");
          await frameInner.$eval("#G_adrCtlAdmDVOList1___radio_radio0_0", (elem) => elem.click());
          await homtaxPage.waitForTimeout(500);
        
          // 선택자로 해당 요소를 찾고 요소의 내용을 가져옴
          const txtTotalSelector = '#txtTotal1';
          const counts = await frameInner.$eval(txtTotalSelector, (element) => {
            return parseInt(element.textContent);
          });

          console.log('Counts:', counts);

          for (let index = 0; index < counts; index++) {
            let hometaxAddressBody = await frameInner.$eval("#adrCtlAdmDVOList1_cell_" + (index) + "_3 > span",
              (element) => {
                return element.innerText;
              }
            );
            console.log(hometaxAddressBody);
            if (hometaxAddressBody == addressBody) {
              await frameInner.click("#G_adrCtlAdmDVOList1___radio_radio0_" + (index));
              await homtaxPage.waitForTimeout(100);
              await frameInner.click("#trigger13");
              break;
            }
          }
          await frame.waitForSelector("#inputEtcDadr");
          await frame.focus("#inputEtcDadr");
          await homtaxPage.waitForTimeout(1000);
          console.log(addressTail);
          await homtaxPage.keyboard.type(addressTail);
          await homtaxPage.waitForTimeout(1000);
        } catch (error) {
          console.error("주소를 다시 입력해주세요.", error);
        }
      }
    } catch (error) {
      console.error("주소지 동일여부 에러발생.", error)
    }
  
    try {
      // 분기 2. 가게, 사무실 등 사업장을 빌리셨습니까?(default : 아니오)
      if (userData.isBuildingOwner == true) {
        // 분기 2-1. 사업장 소유시 -> PASS
      } else if(userData.isBuildingOwner == false) {
        // 분기 2-2 사업장 임대시 -> 임대건물 정보입력
        await frame.waitForSelector("#pfbPsenClCd_input_0");
        await frame.evaluate(() => {
          document.querySelector("#pfbPsenClCd_input_0").click();
        });
        
        await frame.waitForSelector("#pfbMhSfl1");
        await frame.focus("#pfbMhSfl1");
        await homtaxPage.keyboard.type(userData.lentBuildingArea);
        await frame.$eval("#triggerLsrnDelete", (elem) => elem.click());
        await homtaxPage.waitForTimeout(1000);
        
        try {
          const lentBuildingInfo_frame = await homtaxPage
          .frames()
          .find((frame) => frame.name() === "UTEABAAA66_iframe");

          const lentBuildingBusinessNumberFirst = userData.lentBuildingBusinessNumber.substring(0, 3);
          const lentBuildingBusinessNumberMiddle = userData.lentBuildingBusinessNumber.substring(3, 5);
          const lentBuildingBusinessNumberLast = userData.lentBuildingBusinessNumber.substring(5);
  
          await lentBuildingInfo_frame.focus("#lsorBsno1");
          await homtaxPage.keyboard.type(lentBuildingBusinessNumberFirst);
          await lentBuildingInfo_frame.focus("#lsorBsno2");
          await homtaxPage.keyboard.type(lentBuildingBusinessNumberMiddle);
          await lentBuildingInfo_frame.focus("#lsorBsno3");
          await homtaxPage.keyboard.type(lentBuildingBusinessNumberLast);

          await lentBuildingInfo_frame.evaluate(() => {
            document.querySelector("#btnLsorBsno").click();
          });
  
          await lentBuildingInfo_frame.focus("#ctrDt_input");
          await homtaxPage.keyboard.type(userData.lentBuildingContractDate);
          await lentBuildingInfo_frame.focus("#ctrTermStrtDt_input");
          await homtaxPage.keyboard.type(userData.lentBuildingStartDate);
          await lentBuildingInfo_frame.focus("#ctrTermEndDt_input");
          await homtaxPage.keyboard.type(userData.lentBuildingFinishDate);
          await lentBuildingInfo_frame.focus("#lsorPfbSfl");
          await homtaxPage.keyboard.type(userData.lentBuildingArea);

          // 임대차 부동산 주소입력
          await lentBuildingInfo_frame.$eval("#triggerAdrPopup3", (elem) => elem.click());
          await homtaxPage.waitForTimeout(1000);
          
          try {
            // 주소 문자열을 공백을 기준으로 분리
            const addressParts = userData.roadAddress.split(" ");
            const addressHeader = addressParts.shift();
            const addressBody = addressParts.shift();
            const addressTail = addressParts.join("");

            const frameInner = await homtaxPage
            .frames()
            .find((frame) => frame.name() === "UTECMAAA02_iframe");

            await frameInner.focus("#inputSchRoadNm1");
            await homtaxPage.keyboard.type(addressHeader);
            await homtaxPage.waitForTimeout(100);
            await frameInner.$eval("#trigger15", (elem) => elem.click());
            await frameInner.waitForSelector("#G_adrCtlAdmDVOList1___radio_radio0_0");
            await frameInner.$eval("#G_adrCtlAdmDVOList1___radio_radio0_0", (elem) => elem.click());
            await homtaxPage.waitForTimeout(500);
          
            // 선택자로 해당 요소를 찾고 요소의 내용을 가져옴
            const txtTotalSelector = '#txtTotal1';
            const counts = await frameInner.$eval(txtTotalSelector, (element) => {
              return parseInt(element.textContent);
            });

            console.log('Counts:', counts);

            for (let index = 0; index < counts; index++) {
              let hometaxAddressBody = await frameInner.$eval("#adrCtlAdmDVOList1_cell_" + (index) + "_3 > span",
                (element) => {
                  return element.innerText;
                }
              );
              console.log(hometaxAddressBody);
              if (hometaxAddressBody == addressBody) {
                await frameInner.click("#G_adrCtlAdmDVOList1___radio_radio0_" + (index));
                await homtaxPage.waitForTimeout(100);
                await frameInner.click("#trigger13");
                break;
              }
            }
            await lentBuildingInfo_frame.waitForSelector("#lsorEtcDadr");
            await lentBuildingInfo_frame.focus("#lsorEtcDadr");
            await homtaxPage.waitForTimeout(1000);
            console.log(addressTail);
            await homtaxPage.keyboard.type(addressTail);
            await homtaxPage.waitForTimeout(1000);
          } catch (error) {
            console.error("주소를 다시 입력해주세요.", error);
          }

          await lentBuildingInfo_frame.waitForSelector("#triggerRgtLsrn")
          await lentBuildingInfo_frame.evaluate(() => {
            document.querySelector("#triggerRgtLsrn").click();
          });

        } catch (error) {
          console.log("임대 건물 정보 에러");
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }   

    // 2. 공동사업을 하십니까?
    // 3. 서류송달장소는 사업장 주소 외 별도 주소지를 희망하십니까?
  
  
    //업종 선택
    // 1. 전자상거래 소매업
    // 2. 전자상거래 소매 중개업
    // 3. SNS 마켓 -> 전자상거래 소매업, 전자상거래 소매 중개업 값 선택
    await frame.waitForSelector("#triggerTfbBtnAdd");
    try {
      await frame.evaluate(() => {
        document.querySelector("#triggerTfbBtnAdd").click();
      });
    
      await homtaxPage.waitForTimeout(1000);
    
      //UTEABAAA85_iframe
      const category_frame = await homtaxPage
        .frames()
        .find((frame) => frame.name() === "UTEABAAA85_iframe");

      if (userData.businessCategory === "전자상거래 소매업") {
        await category_frame.evaluate(() => {
          document
            .querySelector("#baseXpsrGridListDes_cell_0_9 > span > button")
            .click();
        });
      } else if (userData.businessCategory === "전자상거래 소매 중개업") {
        await category_frame.evaluate(() => {
          document
            .querySelector("#baseXpsrGridListDes_cell_2_9 > span > button")
            .click();
        });
      } else if (userData.businessCategory === "SNS 마켓") {
        await category_frame.evaluate(() => {
          document
            .querySelector("#baseXpsrGridListDes_cell_3_9 > span > button")
            .click();
        });
        await homtaxPage.waitForTimeout(1000);
        //하위 프레임은 childFrames()로 선택한다
        const snsCategory_frame = await frame
          .childFrames()
          .find((childFrame) => childFrame.name() === "UTERNAAZ76_iframe");
        await snsCategory_frame.waitForSelector("#krStndIndsClCdDVOListDes_cell_0_11 > button");
        if (userData.snsMarketCategory === "전자상거래 소매 중개업") {
          await snsCategory_frame.click("#krStndIndsClCdDVOListDes_cell_0_11 > button");
          
        } else if (userData.snsMarketCategory === "전자상거래 소매업") {
          await snsCategory_frame.click("#krStndIndsClCdDVOListDes_cell_1_11 > button");
        } else {
          throw new Error("지원하지 않는 SNS업종입니다.");
        } 
      } else {
        throw new Error("지원하지 않는 업종입니다."); // 에러를 throw하여 catch 블록으로 연결
      }
    
      
      await category_frame.waitForSelector("#triggerTfbAplnAdd");
      await category_frame.evaluate(() => {
        document.querySelector("#triggerTfbAplnAdd").click();
      });
      await homtaxPage.waitForTimeout(1000);
      
    } catch (error) {
      console.error("Error:", error);
    }

    //사업자 유형 선택
    //간이 과세자
    //일반사업자
    //면세사업자
    await frame.waitForSelector("#vatTxtpeCd > div.w2radio_item.w2radio_item_0 > label");
    try {
      if (userData.taxpayerType === "간이") {
        await frame.evaluate(() => {
          document
            .querySelector("#vatTxtpeCd > div.w2radio_item.w2radio_item_1 > label")
            .click();
        });

      } else if (userData.taxpayerType === "일반") {
        await frame.evaluate(() => {
          document
            .querySelector("#vatTxtpeCd > div.w2radio_item.w2radio_item_0 > label")
            .click();
        });
        await homtaxPage.waitForTimeout(1000);
  
        // homtaxPage.on("dialog", async (dialog) => {
        //     await dialog.accept();
        // });
        frame.waitForSelector("#sptxnAbdnRtnYn_input_0");
        if (userData.simpleTaxReq === true) {
          await frame.evaluate(() => {
            document
              .querySelector("#sptxnAbdnRtnYn_input_0")
              .click();
          });
        }
      } else if (userData.taxpayerType === "면세") {
        await frame.evaluate(() => {
          document
            .querySelector("#vatTxtpeCd > div.w2radio_item.w2radio_item_2 > label")
            .click();
        });
      } else {
        throw new Error("사업자 유형을 확인해 주세요."); // 에러를 throw하여 catch 블록으로 연결
      }
    } catch (error) {
      console.error("Error:", error);
    }
  
    //저장후다음
    await frame.evaluate(() => {
      document.querySelector("#triggerApln").click();
    });

    //서류 업로드
    // try {
    //   const frameHandle = await page.$("iframe[id='dext5uploader_frame_comp0']");
      
    //   const fileFrame = await frameHandle.contentFrame();

    //   const filePath =
    //     "C:/bc/user_image.jpg"
    //   const input = await fileFrame.$('input[type="file"]');
    //   await input.uploadFile(filePath);

    //   //서류 업로드
    //   await page.click("#grdSheetSet_cell_5_2 > button");
    //   } catch (error) {
    //     console.log("서류 업로드 에러", error);
    //     res.send(500);
    //     return;
    //   }
 
  
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