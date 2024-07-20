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
     SELECT * FROM price p
     ORDER BY p."id" ASC
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
     let exists = false;
     const existsProductOfferQuery = `
          select *
          from product_offers po 
          where po."sellerId" = $1 and po."productId" = $2
          limit 1
     `
     try {
          const row = await dbv.oneOrNone(existsProductOfferQuery, [sellerid, productid]);
          if (row) {
               exists = true;
          }
     } catch (error) {
          console.log("Error in existsProductOffer :", error);
     }
     finally {
          return exists;
     }

}


// ============================================ createProductOffer
async function createProductOffer(sellerid, productid, url) {
     const createProductOfferQuery = `
          INSERT INTO product_offers ("productId", "sellerId", "url")
          VALUES ($1, $2, $3)
          RETURNING *;`;
     try {
          await dbv.one(createProductOfferQuery, [productid, sellerid, url]);
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
async function updateOfferUrl(productid, sellerid, url) {
     console.log("update pffer : ", productid, sellerid);
     const updateOfferUrlQuery = `
          update product_offers 
          set "url" = $3,
          "createdAt" = NOW()
          where "productId" = $1 and "sellerId" = $2;
     `
     try {
          await dbv.query(updateOfferUrlQuery, [productid, sellerid, url]);

     } catch (error) {
          console.log("Error in updateOfferUrl :", error);
     }

}




async function main() {
     let offset = 0;
     let totalCount = 0;
     const batchSize = 1;

     totalCount = await getPriceTotalCount();
     console.log("total count :", totalCount);

     
 
     let i = 1
     while (offset < totalCount) {
          try {
               let {
                    id,
                    url,
                    xpath,
                    amount,
                    productid,
                    sellerid,
                    createdat,
               } = await getPrice(offset, batchSize);

               amount = parseInt(amount, 10) / 10;
               createdat = new Date();

               if (amount != 0 && !isNaN(amount)) {
                    await createProductPrice(productid, sellerid, amount, true, 1)
               }

               const existsOffer = await existsProductOffer(sellerid, productid);
               if (existsOffer) {
                    await updateOfferUrl(productid, sellerid, url)
               } else {
                    await createProductOffer(sellerid, productid, url);
               }

               offset += batchSize;
               console.log(`================= ${i} from ${totalCount}`);
               i++;
          } catch (error) {
               console.log("Error in while: ", error);
          }
     }
}








main()

