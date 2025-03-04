const express = require("express");
const ioredis = require('ioredis');
const { get_access_token, set_access_token, coupons_valid_for_basket, redeem_coupons, rollback_coupons, configure_api_client, set_redis_client } = require("../index");
const app = express();

const tcb_endpoint = "https://api.try.thecouponbureau.org";

app.use(express.json());

let redisConnObj = {
    host: '127.0.0.1',
    port: 6379,
};

// const redisClient = null;
const redisClient = new ioredis(redisConnObj);

app.post("/get_access_token", async (req, res) => {
    const { access_key, secret_key } = req.body;
    await configure_api_client(tcb_endpoint, 10000, 3, 1000);
    const token = await get_access_token(access_key, secret_key);
    res.json({ token });
});

app.post("/coupons_valid_for_basket", async (req, res) => {
    const start_time = performance.now();
    const input = req.body;
    const { retailer_email_domain, access_key, access_token, user_redis } = req.headers;
    await configure_api_client(tcb_endpoint, 10000, 3, 1000);
    set_access_token(access_key, access_token);
    if ( user_redis ) set_redis_client(redisClient);
    const basket_validation_output = await coupons_valid_for_basket(input, retailer_email_domain);
    const end_time = performance.now();
    res.json({ basket_validation_output, time_taken: end_time - start_time });
});

app.post("/redeem_coupons", async (req, res) => {
    const { coupons, retailer_email_domain } = req.body;
    const { access_key, access_token } = req.headers;
    await configure_api_client(tcb_endpoint, 10000, 3, 1000);
    set_access_token(access_key, access_token);
    const redeemed_coupons = await redeem_coupons(coupons, retailer_email_domain);
    res.json(redeemed_coupons);
});

app.post("/rollback_coupons", async (req, res) => {
    const { coupons, retailer_email_domain } = req.body;
    const { access_key, access_token } = req.headers;
    await configure_api_client(tcb_endpoint, 10000, 3, 1000);
    set_access_token(access_key, access_token);
    const rolled_back_coupons = await rollback_coupons(coupons, retailer_email_domain);
    res.json(rolled_back_coupons);
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
