const { 
     getBrowser, 
     getRandomElement, 
     delay, 
     isValidURL,
     getHostNameFromUrl,
     checkMemoryUsage,
     getCpuUsagePercentage,
     convertToEnglishNumber,
     downloadImages
} = require('./utils.js');

const fs = require('fs');
const omitEmpty = require('omit-empty');
const {db, dbv} = require('./config.js'); 
const cheerio = require("cheerio");
const os = require('os');
const imagesDIR = './images'

// ============================================ getProductFromVardast
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
        ORDER BY RANDOM()
        limit 1
    `
     const deleteQuery = `
          DELETE FROM unvisited 
          WHERE id=$1
     `
     try {
          const urlRow = await db.oneOrNone(existsQuery);
          // if (urlRow) {
          //      await db.query(deleteQuery, [urlRow.id])
          // }
          return urlRow;
     } catch (error) {
          console.log("Error in removeProductName :", error);
     }
}


// ============================================ insertHost
async function insertPrice(input) {
     const existsQuery = `
          SELECT * FROM price p
          where p."url" = $1 and p."xpath" = $2 and p."amount" = $3 and p."productid" = $4 and p."sellerid" = $5 
     `

     const query = `
          insert into price ("url", "xpath", "amount", "productid", "sellerid")
          values($1, $2, $3, $4, $5);
     `;

     try {
          const price = await db.oneOrNone(existsQuery, input);
          if (!price) {
               const result = await db.oneOrNone(query, input);
               return result;
          }
     } catch (error) {
          console.log("Error in insertPrice :", error.message);
     }
}


// ============================================ insertToProblem
async function insertToProblem(name) {
     const existsQuery = `
        SELECT * FROM problem u 
        where "name"=$1
    `

     const insertQuery = `
        INSERT INTO problem ("name")
        VALUES ($1)
        RETURNING *;
    `
     const urlInDb = await db.oneOrNone(existsQuery, [name])
     if (!urlInDb) {
          try {
               const result = await db.query(insertQuery, [name]);
               return result;
          } catch (error) {
               console.log(`Error in insertToProblem function : ${name}\nError:`, error.message);
          }
     }
}


// ============================================ insertToProblem
async function insertToVisited(name) {
     const existsQuery = `
        SELECT * FROM visited u 
        where "name"=$1
    `

     const insertQuery = `
        INSERT INTO visited ("name")
        VALUES ($1)
        RETURNING *;
    `
     const urlInDb = await db.oneOrNone(existsQuery, [name])
     if (!urlInDb) {
          try {
               const result = await db.query(insertQuery, [name]);
               return result;
          } catch (error) {
               console.log(`Error in insertToVisited function : ${name}\nError:`, error.message);
          }
     }
}


// ============================================ getSitesUrlFromGoogle
async function getImageUrlsFromGoogle(browser, productName, url, imageCount) {
     let imageUrls = [];
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
          await delay(5000);



          // Find Google Search Bar
          const textArea = await page.$$('textarea.gLFyf');
          if (textArea.length) {

               // Fill Google Searchbar 
               await textArea[0].type(productName);
               await delay(2000);

               // Press Enter
               await page.keyboard.press('Enter');
               await delay(7000)
               
               const imageElements = (await page.$$('h3.ob5Hkd'))?.slice(0, imageCount);
               for (const element of imageElements) {
                    try {
                         await element.click();
                         await delay(3000);
          
                         const imageElem = await page.$$('img.sFlh5c.pT0Scc.iPVvYb');
                         const url = (await page.evaluate(el => el.getAttribute('src'), imageElem[0]));
                         imageUrls.push(url)
                    } catch (error) {
                         console.log("Error in getImageUrlsFromGoogle foor loop :", error);
                    }
               }
   
               // Find Unique productUrls
               imageUrls = Array.from(new Set(urls));
               imageUrls = imageUrls.filter(url => isValidURL(url));
               imageUrls = omitEmpty(imageUrls);
          }

     } catch (error) {
          console.log("Error In getProductUrlsFromGoogle :", error);
          // await insertToProblem(productName);
     }
     finally {
          // await page.close();
          return imageUrls;
     }

}



// ============================================ Main
async function main(imageCount=3) {
     let product;
     let browser;
     try {

          if(!fs.existsSync(imagesDIR)){
               fs.mkdirSync(imagesDIR)
          }

          const GOOGLE = 'https://www.google.com/imghp?hl=fa&ogbl'

          // Get Product Name From Db And Remove it From Unvisited
          await delay(Math.random()*6000);
          product = await removeProductName();
          

          if (product) {
               const productName = product.name;
               console.log(`\n==================================== Start Search Image For : ${productName}`);

               // get random proxy
               const proxyList = [''];
               const randomProxy = getRandomElement(proxyList);
    
               // Lunch Browser
               browser = await getBrowser(randomProxy, false, false);

               // Find Image Urls 
               const validImageUrls = (await getImageUrlsFromGoogle(browser, productName, GOOGLE, imageCount)).slice(0, imageCount);
               console.log(validImageUrls);
   
               await downloadImages(validImageUrls, imagesDIR, sku);
               
               // // Insert Product Name To Visited
               // await insertToVisited(productName);
          }
     }
     catch (error) {
          console.log("Error In main Function", error);
          if(product){
               // await insertToProblem(product.name);
          }
     }
     finally {
          // Close page and browser
          console.log("End");
          if(browser){
               // await browser.close();
          }
          await delay(1000);
     }


}


let usageMemory = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024);
let memoryUsagePercentage = checkMemoryUsage();
let cpuUsagePercentage = getCpuUsagePercentage();

if (memoryUsagePercentage <= 85 && cpuUsagePercentage <= 80 && usageMemory <= 28) {
     main();
}
else {
     const status = `status:
     memory usage = ${usageMemory}
     percentage of memory usage = ${memoryUsagePercentage}
     percentage of cpu usage = ${cpuUsagePercentage}\n`

     console.log("main function does not run.\n");
     console.log(status);
}

