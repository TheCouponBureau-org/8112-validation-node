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
    await populate_local_database("2024-05-01", "2025-01-31");
    process.exit(0);
})();