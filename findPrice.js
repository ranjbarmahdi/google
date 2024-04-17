const { getBrowser, getRandomElement, delay } = require('./utils.js');
const { URL } = require('url');
const omitEmpty = require('omit-empty');
const cheerio = require("cheerio");
const db = require('./config.js');
const os = require('os');


// ============================================ checkMemoryUsage and getCpuUsagePercentage
function checkMemoryUsage() {
     const totalMemory = os.totalmem();
     const usedMemory = os.totalmem() - os.freemem();
     const memoryUsagePercent = (usedMemory / totalMemory) * 100;
     return memoryUsagePercent;
}

function getCpuUsagePercentage() {
     const cpus = os.cpus();
     let totalIdle = 0;
     let totalTick = 0;

     cpus.forEach(cpu => {
          for (let type in cpu.times) {
               totalTick += cpu.times[type];
          }
          totalIdle += cpu.times.idle;
     });

     return ((1 - totalIdle / totalTick) * 100);
}



// ============================================ isValidURL
function isValidURL(url) {
     try {
          new URL(url);
          return true;
     } catch (error) {
          return false;
     }
}


// ============================================ getHostNameFromUrl
function getHostNameFromUrl(url) {
     try {
          const parsedUrl = new URL(url);
          return parsedUrl.hostname;
     } catch (error) {
          console.error("Invalid URL:", error);
          return '';
     }
}


// ============================================ getSitesUrlFromGoogle
async function getSitesUrlsFromGoogle(browser, productName, url) {
     let productUrls = [];
     let page;
     try {

          // Open New Page
          page = await browser.newPage();
          await page.setViewport({
               width: 1920,
               height: 1980,
          });

          // Go To Url
          await page.goto(url, { timeout: 180000 });
          await delay(5000);

          // Find Google Search Bar
          const textArea = await page.$$('textarea.gLFyf');
          if (textArea.length) {

               // Fill Google Searchbar 
               await textArea[0].type(productName);
               await delay(2000)

               // Press Enter
               await page.keyboard.press('Enter');
               await delay(5000)

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
          console.log("Error In getSitesUrlsFromGoogle :", error);
          await insertToProblem(productName);
     }
     finally {
          await page.close();
          return productUrls;
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
async function getPrice(browser, xpaths, productUrl) {
     let price = 0;
     let xpath = '';
     let page;
     try {

          // Open New Page
          page = await browser.newPage();
          await page.setViewport({
               width: 1920,
               height: 1980,
          });

          // Go To Url
          await page.goto(productUrl, { timeout: 180000 });
          await delay(2000);

          // Find Price 
          for (const xpath of xpaths) {
               const priceElements = await page.$x(xpath);
               if (priceElements.length) {
                    const priceText = await page.evaluate((elem) => elem.textContent?.replace(/[^\u06F0-\u06F90-9]/g, ""), priceElements[0]);
                    console.log(priceText);
               }
               
          }

     } catch (error) {
          console.log("Error In getPrice :", error);
          await insertToProblem(productName);
     }
     finally {
          await page.close();
          return price;
     }

}


// ============================================ Main
async function main() {
     let product;
     let browser;
     try {
          const GOOGLE = 'https://www.google.com/'

          // Get Product Name From Db And Remove it From Unvisited
          // product = await removeProductName();
          product = 'دریل شارژی میلواکی m12';
          
          if (product) {
               // const productName = product.name;
               const productName = 'دریل شارژی میلواکی m12';
               console.log(`\n======================== Start Search For : \n${productName}`);


               // get random proxy
               const proxyList = [''];
               const randomProxy = getRandomElement(proxyList);

               // Lunch Browser
               browser = await getBrowser(randomProxy, false, false);

               // Find Product Urls 
               const validProductUrls = (await getSitesUrlsFromGoogle(browser, productName, GOOGLE)).slice(0, 10);
               await(delay(2000))
               
               for (let i = 0; i < validProductUrls.length; i++){
                    const productUrl = validProductUrls[i];
                    const xpaths = (await getHostXpath(productUrl)).map(row => row?.xpath);
                    await getPrice(browser, xpaths, productUrl);
               }

               

               // // Add Hosts To host Table
               // for (let i = 0; i < hosts.length; i++) {
               //      if (i == 0) {
               //           console.log("Importing Hosts to Db");
               //      }
               //      const host = hosts[i];
               //      await insertHost(host);
               //      await delay(250);
               // }

               // // Insert Product Name To Visited
               // await insertToVisited(productName);
          }
     }
     catch (error) {
          console.log("Error In main Function", error);
          await insertToProblem(product.name);
     }
     finally {
          // Close page and browser
          console.log("End");
          await browser.close();
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

// main()





