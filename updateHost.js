const { readCsv, delay } = require('./utils.js');
const { db } = require('./config.js');
const input = './host.csv'

async function updateHost(updateInput) {
    const updateHostQuery = `
    update host 
    set sellername = $2, sellerid = $3, currency = $4, black = $5
    where "id" = $1 
    `
    try {
         await db.query(updateHostQuery, updateInput);
    } catch (error) {
         console.log("Error in updateHost :", error);
    }
}

async function main(){
    const hosts = await readCsv(input);
    
    for(const host of hosts){
        try {
            const updateInput = [
                host.id,
                host.sellername || null,
                host.sellerid || null,
                host.currency || null,
                host.black || null
             ]
            await updateHost(updateInput);
            await delay(200)
        } catch (error) {
            console.log("Error in main for loop : ", error);
        }
    }
}


main()