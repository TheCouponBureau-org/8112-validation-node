const dotenv = require('dotenv');
dotenv.config();

const ioredis = require('ioredis');
const { get_access_token, set_access_token, configure_api_client, set_redis_client, populate_local_database } = require("../index");

const tcb_endpoint = process.env.TBC_ENDPOINT;
const tcb_access_key = process.env.TBC_ACCESS_KEY;
const tcb_secret_key = process.env.TBC_SECRET_KEY;

const redisConnObj = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
};

const redisClient = new ioredis(redisConnObj);

(async() => {
    await configure_api_client(tcb_endpoint, 10000, 3, 1000);
    const token = await get_access_token(tcb_access_key, tcb_secret_key);;
    set_access_token(tcb_access_key, token);
    set_redis_client(redisClient);

    // Check if the database is synched once, if not, sync last 6 months data else last 2 days data
    const last_synced_date = await redisClient.get("LAST_SYNCED_DATE");
    if (!last_synced_date) {
        let six_months_ago = new Date();
        six_months_ago.setMonth(six_months_ago.getMonth() - 6);
        console.log("Syncing last 6 months data");
        await populate_local_database(six_months_ago.toISOString().split('T')[0], new Date().toISOString().split('T')[0]);
    } else {
        console.log("Syncing last 2 days data");
        let two_days_ago = new Date();
        two_days_ago.setDate(two_days_ago.getDate() - 2);   
        await populate_local_database(two_days_ago.toISOString().split('T')[0], new Date().toISOString().split('T')[0]);
    }

    await redisClient.set("LAST_SYNCED_DATE", new Date().toISOString().split('T')[0]);

    process.exit(0);
})();