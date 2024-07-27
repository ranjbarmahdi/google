const { readCsv, delay } = require('./utils.js');
const { db } = require('./config.js');
const input = './xpath_images.csv'


async function insertXpath(hostid, xpath) {
    const existsQuery = `
         SELECT * FROM xpath_image xi
         where xi."hostid"=$1 and xi."xpath"=$2
         limit 1
    `

    const query = `
         insert into xpath_image ("hostid", "xpath")
         values ($1, $2)
    `;

    try {
         const urlInDb = await db.oneOrNone(existsQuery, [hostid, xpath]);
         if (!urlInDb) {
              await db.query(query, [hostid, xpath]);
         }
    } catch (error) {
         console.log("Error in insertXpath :", error.message);
    }
}


async function main(){
    const xpaths = await readCsv(input);

    let i = 1;
    const totalLength = xpaths.length;
    for(const xpath of xpaths){
        try {
            if(xpath.xpath?.trim()){
                const insertInput = [
                    xpath.hostid,
                    xpath.xpath
                ];
    
                await insertXpath(...insertInput);
                 console.log(`====================== ${i++} from ${totalLength}`);

                await delay(150)
            }
        } catch (error) {
            console.log("Error in main for loop : ", error);
        }
    }
}




main()