const pgp = require('pg-promise')();
const db = pgp(`postgres://user:password@5.9.251.84:5435/price`);

const { 
     delay,
     readCsv, 
} = require('./utils.js');

async function updateEmergency(productId) {
    try {
        const query = `
            update bot_price bp
            set emergency_call = true
            where productid=${productId}
        `

        await db.query(query);
    } catch (error) {
        console.log("Error in updateEmergency : ", error);
    }
}
async function main() {
    
    const csv = await readCsv('./product_id.csv');
   

    Promise.all(csv.map(async (row) => {
        await updateEmergency(row.id);
        await delay(250)
    }))
}

main()
