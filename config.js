const pgp = require('pg-promise')();
require('dotenv').config();

class Database {
    constructor() {
        if (!Database.instance) {
            // Construct the connection strings for both databases
            const db1ConnectionString = `postgres://${process.env.DB_USER_1}:${process.env.DB_PASSWORD_1}@${process.env.DB_HOST_1}:${process.env.DB_PORT_1}/${process.env.DB_NAME_1}`;
            const db2ConnectionString = `postgres://${process.env.DB_USER_2}:${process.env.DB_PASSWORD_2}@${process.env.DB_HOST_2}:${process.env.DB_PORT_2}/${process.env.DB_NAME_2}`;

            // Create PostgreSQL database instances
            this.db1 = pgp(db1ConnectionString);
            this.db2 = pgp(db2ConnectionString);

            Database.instance = this;
        }

        return Database.instance;
    }

    getDB1() {
        return this.db1;
    }

    getDB2() {
        return this.db2;
    }
}

const db = new Database();

module.exports = {
    db: db.getDB1(),
    dbv: db.getDB2()
};
