const { 
     delay, 
     getHostNameFromUrl,
     checkMemoryUsage,
     getCpuUsagePercentage,
} = require('./utils.js');

const {db, dbv} = require('./config.js'); 
const os = require('os');


// ============================================ getAllPrice
async function getPrice(offset, batchSize) {
     const query = `
     SELECT * FROM price
     LIMIT ${batchSize}
     OFFSET ${offset}
    `
     try {
          const price = await db.oneOrNone(query);
          return price;
     } catch (error) {
          console.log("Error in getAllPrice :", error);
     }
}


// ============================================ getAllPrice
async function getPriceTotalCount() {
     let count = 0;
     const query = `
     select count(*) from price;
    `
     try {
          count = (await db.oneOrNone(query)).count || 0;
     } catch (error) {
          console.log("Error in getPriceTotalCount :", error);
     }
     finally {
          return count;
     }
}


// ============================================ existsProductOffer
async function existsProductOffer(sellerid, productid) {
     const existsProductOfferQuery = `
          select *
          from product_offers po 
          where po."sellerId" = $1 and po."productId" = $2
          limit 1
     `
     try {
          const row = await dbv.oneOrNone(existsProductOfferQuery, [sellerid, productid]);
          if (row) {
               return true;
          }
          else {
               return false;
          }
     } catch (error) {
          console.log("Error in existsProductOffer :", error);
     }

}


// ============================================ createProductOffer
async function createProductOffer(sellerid, productid) {
     const createProductOfferQuery = `
          INSERT INTO product_offers ("productId", "sellerId")
          VALUES ($1, $2)
          RETURNING *;
          `;
     try {
          await dbv.one(createProductOfferQuery, [productid, sellerid]);
     } catch (error) {
          console.log("Error in createProductOffer :", error);
     }

}


// ============================================ createProductOffer
async function createProductPrice(productid, sellerid, amount, isPublic, createdById) {
     const createProductPriceQuery = `
          INSERT INTO product_prices ("productId", "sellerId" ,"amount" ,"isPublic","createdById")
          VALUES ($1,$2,$3,$4,$5)
          RETURNING *;
          `;
     try {
          await dbv.one(createProductPriceQuery, [productid, sellerid, amount, isPublic, createdById]);
     } catch (error) {
          console.log("Error in createProductPrice :", error);
     }

}


// ============================================ createProductOffer
async function updateOfferUrl(productid, sellerid) {
     const updateOfferUrlQuery = `
     update product_offers 
     set "url" = $3
     where "productId" = $1 and "sellerId" = $2
     `
     try {
          await dbv.one(updateOfferUrlQuery, [productid, sellerid]);
     } catch (error) {
          console.log("Error in createProductPrice :", error);
     }

}




async function main() {
     let offset = 0;
     let totalCount = 0;
     const batchSize = 1;

     totalCount = await getPriceTotalCount();
     console.log("total count :", totalCount);

     
     while (offset < totalCount) {
          const {
               id,
               url,
               xpath,
               amount,
               productid,
               sellerid,
               createdat,
          } = await getPrice(offset, batchSize);



          
          if (amount != 0) {
               await createProductPrice(productid, sellerid, amount, true, 1)
          }


          // const existsOffer = await existsProductOffer(sellerid, productid);

          await createProductOffer(sellerid, productid);



          offset += batchSize;

          await delay(500)
     }
}








main()

