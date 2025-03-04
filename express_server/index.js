const express = require("express");
const { get_access_token, set_access_token, coupons_valid_for_basket, redeem_coupons, rollback_coupons } = require("../index");
const app = express();

app.use(express.json());

app.post("/get_access_token", async (req, res) => {
    const { access_key, secret_key } = req.body;
    const token = await get_access_token(access_key, secret_key);
    res.json({ token });
});

app.post("/coupons_valid_for_basket", async (req, res) => {
    const input = req.body;
    const { retailer_email_domain, access_key, access_token } = req.headers;
    set_access_token(access_key, access_token);
    const basket_validation_output = await coupons_valid_for_basket(input, retailer_email_domain);
    res.json(basket_validation_output);
});

app.post("/redeem_coupons", async (req, res) => {
    const { coupons, retailer_email_domain } = req.body;
    const { access_key, access_token } = req.headers;
    set_access_token(access_key, access_token);
    const redeemed_coupons = await redeem_coupons(coupons, retailer_email_domain);
    res.json(redeemed_coupons);
});

app.post("/rollback_coupons", async (req, res) => {
    const { coupons, retailer_email_domain } = req.body;
    const { access_key, access_token } = req.headers;
    set_access_token(access_key, access_token);
    const rolled_back_coupons = await rollback_coupons(coupons, retailer_email_domain);
    res.json(rolled_back_coupons);
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
