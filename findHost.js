const { 
     getBrowser, 
     getRandomElement, 
     delay, 
     isValidURL,
     getHostNameFromUrl,
     checkMemoryUsage,
     getCpuUsagePercentage
} = require('./utils.js');
     
const { URL } = require('url');
const omitEmpty = require('omit-empty');
const cheerio = require("cheerio");
const db = require('./config.js');
const os = require('os');


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
async function insertHost(host) {
     const existsQuery = `
          SELECT * FROM host h
          where h."host"=$1
     `

     const query = `
          insert into host ("host")
          values ($1)
     `;

     try {
          const urlInDb = await db.oneOrNone(existsQuery, [host]);
          if (!urlInDb) {
               const result = await db.oneOrNone(query, [host]);
               return result;
          }
     } catch (error) {
          console.log("Error in insertHost :", error.message);
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


// ============================================ getProductUrlsFromGoogle
async function getProductUrlsFromGoogle(page, productName, url) {
     let UniqueHosts = [];
     try {
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

               // Extract Host From URLs
               const hosts = urls.map(url => {
                    const validationUrl = isValidURL(url);
                    if (validationUrl) {
                         const host = getHostNameFromUrl(url);
                         return host;
                    }
               })

               // Find Unique HostName
               UniqueHosts = Array.from(new Set(hosts));
               UniqueHosts = omitEmpty(UniqueHosts);
          }


     } catch (error) {
          console.log("Error In getProductUrlsFromGoogle :", error);
          await insertToProblem(productName);
     }
     finally {
          return UniqueHosts;
     }

}


// ============================================ Main
async function main() {
     let product;
     let browser;
     let page;
     try {
          const GOOGLE = 'https://www.google.com/'

          // Get Product Name From Db And Remove it From Unvisited
          product = await removeProductName();
          if (product) {
               const productName = product.name;
               console.log(`\n======================== Start Search For : \n${productName}`);


               // get random proxy
               const proxyList = [''];
               const randomProxy = getRandomElement(proxyList);


               // Lunch Browser
               browser = await getBrowser(randomProxy, true, false);
               page = await browser.newPage();
               await page.setViewport({
                    width: 1440,
                    height: 810,
               });

               
               // Find Hosts
               const hosts = (await getProductUrlsFromGoogle(page, productName, GOOGLE)).slice(0, 10);
               

               // Add Hosts To host Table
               for (let i = 0; i < hosts.length; i++) {
                    if (i == 0) {
                         console.log("Importing Hosts to Db");
                    }
                    const host = hosts[i];
                    await insertHost(host);
                    await delay(250);
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
          await page.close();
          await browser.close();
          await delay(1000);
     }


}





let usageMemory = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024);
let memoryUsagePercentage = checkMemoryUsage();
let cpuUsagePercentage = getCpuUsagePercentage();

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
     for(let i = 0; i < 95; i++){
          if (memoryUsagePercentage <= 70 && cpuUsagePercentage <= 50 && usageMemory <= 12) {
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
          await delay(1000);
     }
}



main_2();
