const { getBrowser, getRandomElement, delay } = require('./utils');
const { URL } = require('url');
const omitEmpty = require('omit-empty');
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const db = require('./config.js');
const path = require("path");
const fs = require("fs");
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
async function getSitesUrlFromGoogle(page, productName, url) {
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
          console.log("Error In getSitesUrlFromGoogle :", error);
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
                    width: 1920,
                    height: 1980,
               });

               const hosts = (await getSitesUrlFromGoogle(page, productName, GOOGLE)).slice(0, 10);


               // Add Hosts To host Table
               for (let i = 0; i < hosts.length; i++) {
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





