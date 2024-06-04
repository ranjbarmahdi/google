const { 
    getBrowser, 
    getRandomElement, 
    delay, 
    isValidURL,
    getHostNameFromUrl,
    checkMemoryUsage,
    getCpuUsagePercentage,
    convertToEnglishNumber
} = require('./utils.js');

const omitEmpty = require('omit-empty');
const {db, dbv} = require('./config.js'); 
const cheerio = require("cheerio");
const os = require('os');


// ============================================ insertToProblem
async function insertToProblem(productName) {
     const existsQuery = `
        SELECT * FROM problem p
        where p."name"=$1
    `

     const insertQuery = `
        INSERT INTO problem ("name")
        VALUES ($1)
        RETURNING *;
    `
     const productNameInDb = await db.oneOrNone(existsQuery, [productName])
     if (!productNameInDb) {
          try {
               const result = await db.query(insertQuery, [productName]);
               return result;
          } catch (error) {
               console.log(`Error in insertToProblem function : ${productName}\nError:`, error.message);
          }
     }
}


// ============================================ insertToVisited
async function insertToVisited(productName) {
     const existsQuery = `
        SELECT * FROM visited v
        where v."name"=$1
    `

     const insertQuery = `
        INSERT INTO visited ("name")
        VALUES ($1)
        RETURNING *;
    `
     const productNameInDb = await db.oneOrNone(existsQuery, [productName])
     if (!productNameInDb) {
          try {
               const result = await db.query(insertQuery, [productName]);
               return result;
          } catch (error) {
               console.log(`Error in insertToVisited function : ${productName}\nError:`, error.message);
          }
     }
}

// ============================================ getHostByHostName
async function getProductFromVardast(productName) {
    const query = `
         SELECT * FROM products p
         WHERE p."name" = $1
    `

    try {
         const product = await dbv.oneOrNone(query, [productName]);
         return product;
    } catch (error) {
         console.log("Error in getProductFromVardast :", error);
         return null;
    }
}


// ============================================ removeProductName
async function removeProductName() {
    const existsQuery = `
       SELECT * FROM unvisited u 
       limit 1
   `
    const deleteQuery = `
         DELETE FROM unvisited 
         WHERE id=$1
    `
    try {
         const urlRow = await db.oneOrNone(existsQuery);
         if (urlRow) {
              await db.query(deleteQuery, [urlRow.id])
         }
         return urlRow;
    } catch (error) {
         console.log("Error in removeProductName :", error);
    }
}


// ============================================ insertHost
async function insertPriceBotRow(input) {
    const existsQuery = `
         SELECT * FROM bot_price p
         where p."sellerid" = $1 and p."productid" = $2 and p."brandid" = $3 and p."url" = $4 and p."price_xpath" = $5 
    `

    const query = `
         insert into bot_price ("sellerid", "productid", "brandid", "url", "price_xpath", "name", "sku", "currency")
         values($1, $2, $3, $4, $5, $6, $7, $8);
    `;

    try {
         const record = await db.oneOrNone(existsQuery, input);
         if (!record) {
              const result = await db.oneOrNone(query, input);
              return result;
         }
    } catch (error) {
         console.log("Error in insertPriceBotRow :", error.message);
    }
}


// ============================================ getHostByHostName
async function getHostByHostName(hostName) {
    const query = `
         SELECT * FROM host h
         WHERE h."host" = $1
    `

    try {
         const host = await db.oneOrNone(query, [hostName]);
         return host;
    } catch (error) {
         console.log("Error in removeProductName :", error);
         return null;
    }
}


// ============================================ getHostXpath
async function getHostXpath(url) {
    let xpaths = [];
    try {
         // Extract Host Name From Url
         const hostName = getHostNameFromUrl(url);
         const findXpathQuery = `
              select distinct x."xpath"
              from host h
              join xpath x on h."id" = x."hostid"
              where h."host" = $1 
         ` 

         xpaths = await db.any(findXpathQuery, [hostName]);
    } catch (error) {
         console.log("Error In getHostXpath :", error);
    }
    finally {
         return xpaths;
    }

}


// ============================================ getSitesUrlFromGoogle
async function getProductUrlsFromGoogle(browser, productName, url) {
    let productUrls = [];
    let page;
    try {

         // Open New Page
         page = await browser.newPage();
         await page.setViewport({
              width: 1440,
              height: 810,
         });

         // Go To Url
         await page.goto(url, { timeout: 180000 });
         await delay(3000);

         // Find Google Search Bar
         const textArea = await page.$$('textarea.gLFyf');
         if (textArea.length) {

              // Fill Google Searchbar 
              await textArea[0].type(productName);
              await delay(2000)

              // Press Enter
              await page.keyboard.press('Enter');
              await delay(2000)

              // Load Cheerio
              const html = await page.content();
              const $ = await cheerio.load(html);

              // Find Urls
              const urls = $('a[jsname=UWckNb]')
                   .map((i, e) => $(e).attr('href')?.toLowerCase()?.replace('www.', '')?.trim()).get();


              // Find Unique productUrls
              productUrls = Array.from(new Set(urls));
              productUrls = productUrls.filter(url => isValidURL(url));
              productUrls = omitEmpty(urls);
         }

    } catch (error) {
         console.log("Error In getProductUrlsFromGoogle :", error);
         await insertToProblem(productName);
    }
    finally {
         await page.close();
         return productUrls;
    }

}



// ============================================ getPrice
async function getPrice(browser, xpaths, productUrl, currency) {
    let price = Infinity;
    let xpath = '';
    let page;
    try {

         if(xpaths.length == 0){
              return [price, xpath];
         }

         // Open New Page
         page = await browser.newPage();
         await page.setViewport({
              width: 1440,
              height: 810,
         });

         
         // Go To Url
         await page.goto(productUrl, { timeout: 180000 });
         await delay(3000);


         // Find Price 
         for (const _xpath of xpaths) {
              try {
                   const priceElements = await page.$x(_xpath);
                   if (priceElements.length) {
                        const priceText = await page.evaluate((elem) => elem.textContent?.replace(/[^\u06F0-\u06F90-9]/g, ""), priceElements[0]);
                        const englishPrice = convertToEnglishNumber(priceText)
                        let priceNumber = currency ? (Number(englishPrice) / 10) : Number(englishPrice);

                        if(priceNumber < price){
                             price = priceNumber;
                             xpath = _xpath;
                        }
                   }
              } catch (error) {
                   console.log("Error in getPrice Function Foor Loop :", error.message);
              }
         }

    } catch (error) {
         console.log("Error In getPrice :", error);
         await insertToProblem(productName);
    }
    finally {
         if(page){
              await page.close();
         }
         return [price, xpath];
    }

}


// ============================================ proccessProductUrl
async function proccessProductUrl(browser, productUrl, productName) {
    try {
         // Extract Host Name From Url 
         const hostName = getHostNameFromUrl(productUrl);

         // Get Host From DB
         const {sellername, sellerid, currency} = await getHostByHostName(hostName) || {};
         
         if(sellerid){
              console.log(sellername, sellerid, currency);

              // Find Xpath
              const xpaths = (await getHostXpath(productUrl)).map(row => row?.xpath);

              // Find Price
              const [amount, xpath] = await getPrice(browser, xpaths, productUrl, currency);
              console.log("Price :", amount);


              // Check Price Is Finite and Not 0
              if(isFinite(amount) && amount != 0){
                   const {
                    id: productId,
                    brandId: brandId,
                    sku: sku
                   } = await getProductFromVardast(productName) || {};

                   // Insert Price If Product Exists
                   if(productId){
                        const priceBotTableInput = [sellerid, productId, brandId, productUrl, xpath, productName, sku, currency];
                        await insertPriceBotRow(priceBotTableInput);
                   }
              }
          //     else{
          //           // digi
          //           const defaultXpath = '/html/body/div[1]/div[1]/div[3]/div[3]/div[2]/div[2]/div[2]/div[2]/div[5]/div/div[4]/div/div/div/div[1]/div/div[1]/span/text()'
                  
          //           // torob
          //           // const defaultXpath = '/html/body/div/div/div[2]/div/div/div[2]/div/div[2]/div[1]/div/div/div[2]/div[4]/a/div/div[1]/div[2]/text()'

          //           const {
          //           id: productId,
          //           brandId: brandId,
          //           sku: sku
          //          } = await getProductFromVardast(productName) || {};

          //           // Insert Price If Product Exists
          //           if(productId){
          //               const priceBotTableInput = [sellerid, productId, brandId, productUrl, defaultXpath, productName, sku, currency];
          //               await insertPriceBotRow(priceBotTableInput);
          //           }
          //     }
              
         }

         

    } catch (error) {
         console.log("Error In proccessProductUrl :", error);
         await insertToProblem(productName);
    }


}


// ============================================ Main
async function main() {
    let product;
    let browser;
    try {
         const GOOGLE = 'https://www.google.com/'

         // Get Product Name From Db And Remove it From Unvisited
         product = await removeProductName();
         
         if (product) {
              const productName = product.name;


              console.log(`\n======================== Start Search For : ${productName}`);


              // get random proxy
              const proxyList = [''];
              const randomProxy = getRandomElement(proxyList);


              // Lunch Browser
              browser = await getBrowser(randomProxy, true, false);


              // Find Product Urls 
              const validProductUrls = (await getProductUrlsFromGoogle(browser, productName, GOOGLE))
                .slice(0, 10)
                .filter(url => (url?.includes('digikala.com')))
                .slice(0, 1);
                
      
              

              // Start Proccess To Find Price
              for (let i = 0; i < validProductUrls.length; i++){
                   const productUrl = validProductUrls[i];
                   await proccessProductUrl(browser, productUrl, productName);
                   await delay(1000)
              }

              
              // Insert Product Name To Visited
              await insertToVisited(productName);
         }
    }
    catch (error) {
         console.log("Error In main Function", error);
         await insertToProblem(product.name);
    }
    finally {
         // Close page and browser
         console.log("End");
         if(browser) await browser.close();
         await delay(1000);
    }


}


// let usageMemory = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024);
// let memoryUsagePercentage = checkMemoryUsage();
// let cpuUsagePercentage = getCpuUsagePercentage();

// if (memoryUsagePercentage <= 85 && cpuUsagePercentage <= 80 && usageMemory <= 28) {
//      main();
// }
// else {
//      const status = `status:
//      memory usage = ${usageMemory}
//      percentage of memory usage = ${memoryUsagePercentage}
//      percentage of cpu usage = ${cpuUsagePercentage}\n`

//      console.log("main function does not run.\n");
//      console.log(status);
// }


async function main_2(){
    for(let i = 0; i <= 1000; i++){
         let usageMemory = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024);
         let memoryUsagePercentage = checkMemoryUsage();
         let cpuUsagePercentage = getCpuUsagePercentage();

         if (memoryUsagePercentage <= 85 && cpuUsagePercentage <= 80 && usageMemory <= 28) {
              await main();
         }
         else {
              const status = `status:
              memory usage = ${usageMemory}
              percentage of memory usage = ${memoryUsagePercentage}
              percentage of cpu usage = ${cpuUsagePercentage}\n`

              console.log("main function does not run.\n");
              console.log(status);
         }
         const delayRandomTime = Math.random()*3000
         await delay(delayRandomTime);
    }
}

main_2()

