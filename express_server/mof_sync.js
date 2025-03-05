const ioredis = require('ioredis');
const { get_access_token, set_access_token, configure_api_client, set_redis_client, populate_local_database } = require("../index");

const tcb_endpoint = "https://api.try.thecouponbureau.org";
const tcb_access_key = "e5896b3f738a524882f96998740deaa3";
const tcb_secret_key = "b197a166797f2f38dc73bd9425815823";

const redisConnObj = {
    host: '127.0.0.1',
    port: 6379,
};

const redisClient = new ioredis(redisConnObj);

(async() => {
    await configure_api_client(tcb_endpoint, 10000, 3, 1000);
    const token = await get_access_token(tcb_access_key, tcb_secret_key);;
    set_access_token(tcb_access_key, token);
    set_redis_client(redisClient);
    await populate_local_database("2025-05-01", "2025-01-31");
    process.exit(0);
})();