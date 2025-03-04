
const ioredis = require('ioredis');
const { coupons_valid_for_basket, redeem_coupons, rollback_coupons, set_redis_client, populate_local_database, set_access_token, configure_api_client, get_access_token } = require(".");

const tcb_endpoint = "https://api.try.thecouponbureau.org";
const access_key = "e5896b3f738a524882f96998740deaa3";
const secret_key = "b197a166797f2f38dc73bd9425815823";
const retailer_email_domain = null; // If you are using accelerator API, pass the retailer email domain

let redisConnObj = {
    host: '127.0.0.1',
    port: 6379,
};

// const redisClient = null;
const redisClient = new ioredis(redisConnObj);

(async() => {

        set_redis_client(redisClient);

        // Configure API client
        await configure_api_client(tcb_endpoint, 10000, 3, 1000);
        
        // Get access token from TCB API
        const token =await get_access_token(access_key, secret_key);
        set_access_token(access_key, token);
        // console.log(token);

        // Sync local database
        const mof_synced = await populate_local_database("2025-01-01", "2025-03-04");
        console.log("MOF Synced", mof_synced.length);

        const input = {
            "basket": [
              {
                "product_code": "037000930396",
                "price": 1.29,
                "quantity": 12,
                "unit": "item"
              },
              {
                "product_code": "7106919588011",
                "price": 1.81,
                "quantity": 13,
                "unit": "item"
              },
              {
                "product_code": "030772036433",
                "price": 5.44,
                "quantity": 2,
                "unit": "item"
              },
              {
                "product_code": "037000925033",
                "price": 1.59,
                "quantity": 13,
                "unit": "item"
              },
              {
                "product_code": "8952803493171",
                "price": 4.67,
                "quantity": 9,
                "unit": "item"
              },
              {
                "product_code": "037000590804",
                "price": 5.11,
                "quantity": 4,
                "unit": "item"
              },
              {
                "product_code": "030772094969",
                "price": 4.76,
                "quantity": 4,
                "unit": "item"
              },
              {
                "product_code": "2066196461818",
                "price": 3.43,
                "quantity": 4,
                "unit": "item"
              },
              {
                "product_code": "037000758365",
                "price": 1.99,
                "quantity": 13,
                "unit": "item"
              },
              {
                "product_code": "030772075258",
                "price": 5.64,
                "quantity": 3,
                "unit": "item"
              },
              {
                "product_code": "037000930419",
                "price": 8.07,
                "quantity": 11,
                "unit": "item"
              },
              {
                "product_code": "6013644404626",
                "price": 5.35,
                "quantity": 2,
                "unit": "item"
              },
              {
                "product_code": "030772094990",
                "price": 2.22,
                "quantity": 2,
                "unit": "item"
              },
              {
                "product_code": "030772076880",
                "price": 5.52,
                "quantity": 7,
                "unit": "item"
              },
              {
                "product_code": "5901234123457",
                "price": 15.01,
                "quantity": 1,
                "unit": "item"
              },
              {
                "product_code": "037000530916",
                "price": 4.41,
                "quantity": 3,
                "unit": "item"
              },
              {
                "product_code": "037000653172",
                "price": 8.03,
                "quantity": 1,
                "unit": "item"
              },
              {
                "product_code": "037000916192",
                "price": 9.69,
                "quantity": 1,
                "unit": "item"
              }
            ],
            "coupons": [
              "8112009988459000129133768829435944",
              "8112009988459000229133701244303366",
              "8112009988459000259133185516163434",
              "811200998845900014913380504049555",
              "8112009988459000239133444997582211",
              "8112009988459000219133223879896344",
              "8112009988459000169133736410030266",
              "8112009988459000209133587882077144",
              "8112009988459000079133769222789444",
              "811200998845900015913358979002351",
              "8112009988459000049133103414813988",
              "8112009988459000089133226130651611",
              "8112009988459000099133820075347100",
              "811200998845900018913321118603722",
              "8112009988459000069133619787447344",
              "8112009988459000249133903816873999",
              "8112009988459000139133267545843888",
              "8112009988459000199133504710017888",
              "8112009988459000059133140178143666",
              "8112009988459000179133911731890777",
              "8112009988459000109133290291921444"
            ]
          }

        // Get all coupons valid for the basket
        let basket_validation_output = await coupons_valid_for_basket(input, retailer_email_domain, redisClient);
        console.log("Basket Validation Output", JSON.stringify(basket_validation_output, null, 2));

        // // Create a new array of coupons which are applied in the basket from the basket_validation_output
        const applied_coupons = basket_validation_output.applied_coupons.map(coupon => coupon.coupon_code);
        console.log("Applied Coupons", JSON.stringify(applied_coupons, null, 2));

        // // Redeem the coupons 
        let redeemed_coupons = await redeem_coupons(applied_coupons, retailer_email_domain);
        console.log("Redeemed Coupons Output", JSON.stringify(redeemed_coupons, null, 2));

        // // In case of any issues or transaction failure, rollback the coupons
        let rolled_back_coupons = await rollback_coupons(redeemed_coupons, retailer_email_domain ? "accelerator" : "retailer");
        console.log("Rolled Back Coupons Output", JSON.stringify(rolled_back_coupons, null, 2));

})()
