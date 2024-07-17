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


// ============================================ getHostByHostName
async function getHostByHostName(hostName) {
     const query = `
          SELECT * FROM host h
          WHERE h."host" = $1 and (h."black" is null OR h."black" != true)
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


// ============================================ getHostImageXpath
async function getHostImageXpath(url) {
     let xpaths = [];
     try {
          // Extract Host Name From Url
          const hostName = getHostNameFromUrl(url);
          const findXpathQuery = `
               select distinct xi."xpath"
               from host h
               join xpath_image xi on h."id" = xi."hostid"
               where h."host" = $1
          ` 

          xpaths = await db.any(findXpathQuery, [hostName]);
     } catch (error) {
          console.log("Error In getHostImageXpath :", error);
     }
     finally {
          return xpaths;
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
async function getProductUrlsFromGoogle(browser, productName, url) {
     let productUrls = [];
     let page;
     try {
          console.log("before newPage");
          // Open New Page
          page = await browser.newPage();
          await page.setViewport({
               width: 1440,
               height: 810,
          });
          console.log("before goto");
          // Go To Url
          await page.goto(url, { timeout: 180000 });
          await delay(5000);

          console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaa");
          await page.screenshot({ path: './beforeType.png' });

          // Find Google Search Bar
          const textArea = await page.$$('textarea.gLFyf');
          console.log("textArea length : ", textArea.length);
          if (textArea.length) {

               // Fill Google Searchbar 
               await textArea[0].type(productName);
               await delay(2000)

               await page.screenshot({ path: './afterType.png' });

               // Press Enter
               await page.keyboard.press('Enter');
               await delay(5000)

               await page.screenshot({ path: './afterEnter.png' });

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
          console.log("productUrls : ", productUrls);
          return productUrls;
     }

}


// ============================================ getPrice
async function getPrice(page, xpaths, currency, productName) {
     let price = Infinity;
     let xpath = '';
     try {
          
          if(xpaths.length == 0){
               return [price, xpath];
          }

          // Find Price 
          for (const _xpath of xpaths) {
               try {
                    try {
                         await page.waitForXPath(_xpath, { timeout: 5000 });
                    } catch (error) {

                    }
                    
                    const priceElements = await page.$x(_xpath);
                    for(const priceElem of priceElements){
                         try {
                              let priceText = await page.evaluate((elem) => elem.textContent?.replace(/[^\u06F0-\u06F90-9]/g, ""), priceElem);
                              priceText = convertToEnglishNumber(priceText);
                              let priceNumber = currency ? Number(priceText) : Number(priceText) * 10;
                              
                              if((priceNumber < price) && (priceNumber !== 0)){
                                   price = priceNumber;
                                   xpath = _xpath;
                              }
                              await delay(100);
                         } catch (error) {
                              console.log("Error in getPrice Function Inner Foor Loop : ", error.message);
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
          return [price, xpath];
     }

}


// ============================================ proccessProductUrl
async function proccessProductUrl(browser, productUrl, productName) {
     let page;
     try {
          // Extract Host Name From Url 
          const hostName = getHostNameFromUrl(productUrl);

          // Get Host From DB
          const {sellername, sellerid, currency} = await getHostByHostName(hostName) || {};
          
          if(sellerid){
               console.log(`\n========================= : ${sellername} ${sellerid} ${currency}`);

               // Open New Page
               page = await browser.newPage();
               await page.setViewport({
                    width: 1440,
                    height: 810,
               });

               // Go To Url
               await page.goto(productUrl, { timeout: 180000 });
               await delay(2000);

               

               // Find Prodcut id From Vardast DB
               const {id: productId, sku} = await getProductFromVardast(productName) || {};

               // Find Xpath
               const xpaths = (await getHostXpath(productUrl)).map(row => row?.xpath);
               
               // If Host Has Xpaths, Get Its Price
               if (xpaths.length) {

                    // Find Price
                    console.log("number of price xpath :", xpaths.length);
                    const [amount, xpath] = await getPrice(page, xpaths, currency, productName);
                    console.log("Price :", amount);
     
     
                    // Check Price Is Finite and Not 0
                    if(isFinite(amount) && amount != 0){

                         // Insert Price If Product Exists
                         if(productId){
                              const priceTableInput = [productUrl, xpath, amount, productId, sellerid];
                              await insertPrice(priceTableInput);
                         }
                    }
                    
               }

               // If Host Has Images Xpaths, Download Its Image
               const image_xpaths = (await getHostImageXpath(productUrl)).map(row => row?.xpath);

               let imageUrls = await Promise.all(image_xpaths.map(async _xpath => {
                    
                    try {
                         await page.waitForXPath(_xpath, { timeout: 5000 });
                    } catch (error) {

                    }

                    const imageElements = await page.$x(_xpath);
                
                    // Get the src attribute of each image element found by the XPath
                    const srcUrls = await Promise.all(imageElements.map(async element => {
                        let src = await page.evaluate(el => el.getAttribute('src')?.replace(/(-[0-9]+x[0-9]+)/g, ""), element);
                        return src;
                    }));
                
                    return srcUrls;
               }));
               imageUrls = imageUrls.flat();
               imageUrls = [...new Set(imageUrls)];
               imageUrls = imageUrls.map(url => {
                    if (!url?.includes('http') && !url?.includes('https')) return `https://www.${hostName}${url}`;
                    return url
               })

               console.log("number of image xpaths :", image_xpaths.length);
               console.log("number of imageUrls :", imageUrls.length);
               console.log("Downloading Images ...");
               console.log("imageUrls : ",imageUrls);

               await downloadImages(imageUrls, imagesDIR, sku);
          }

          

     } catch (error) {
          console.log("Error In proccessProductUrl :", error);
          await insertToProblem(productName);
     }finally{
          if(page){
               await page.close();
          }
     }


}


// ============================================ Main
async function main() {
     let product;
     let browser;
     try {

          if(!fs.existsSync(imagesDIR)){
               fs.mkdirSync(imagesDIR)
          }

          const GOOGLE = 'https://www.google.com/'

          // Get Product Name From Db And Remove it From Unvisited
          await delay(Math.random()*6000);
          product = await removeProductName();
          
          if (product) {
               const productName = product.name;
               console.log(`\n==================================== Start Search For : ${productName}`);


               // get random proxy
               const proxyList = ['37.114.204.14:8080'];
               const randomProxy = getRandomElement(proxyList);
               console.log('proxy ',randomProxy)
               // Lunch Browser
               browser = await getBrowser(randomProxy, true, false);


               // Find Product Urls 

               const validProductUrls = (await getProductUrlsFromGoogle(browser, productName, GOOGLE)).slice(0, 10);
               
               await(delay(2000))
               

               // Start Proccess To Find Price
               for (let i = 0; i < validProductUrls.length; i++){
                    const productUrl = validProductUrls[i];
                    await proccessProductUrl(browser, productUrl, productName);
               }

               
               // Insert Product Name To Visited
               await insertToVisited(productName);
          }
     }
     catch (error) {
          console.log("Error In main Function", error);
          if(product){
               await insertToProblem(product.name);
          }
     }
     finally {
          // Close page and browser
          console.log("End");
          if(browser){
               await browser.close();
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

