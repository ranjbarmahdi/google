const { 
     delay,
     readCsv, 
} = require('./utils.js');

const {db, dbv} = require('./config.js'); 
const fs = require('fs');
const path = require('path');
const input = './input'


// ============================================ insertHost
async function insertProductNamesToUnvisited(input) {
     const existsQuery = `
          SELECT * FROM unvisited p
          where p."name" = $1 
     `

     const query = `
          insert into unvisited ("name")
          values($1);
     `;

     try {
          const name = await db.oneOrNone(existsQuery, input);
          if (!name) {
               const name = await db.oneOrNone(query, input);
               return name;
          }
     } catch (error) {
          console.log("Error in insertProductNamesToUnvisited :", error.message);
     }
}




async function main(){
    if(!fs.existsSync(input)){
        fs.mkdir(input)
    }

    const csvs = fs.readdirSync(input).filter(file => file.endsWith('csv'));

    for(const csvName of csvs){
        try {
            const csvPath = path.join(__dirname, input, csvName);
            const csv = await readCsv(csvPath);    

            const total = csv.length;
            let counter = 1

            for(const row of csv){
                console.log(`============= ${counter} from ${total}`);
                const productName = row.name || row['نام'] || null;
                if(productName) await insertProductNamesToUnvisited(productName);
                counter ++;
            }
        } catch (error) {
            console.log("Error in main function :", error);
        }
        
    }
}

main();