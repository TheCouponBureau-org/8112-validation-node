const { validate_basket, rollback_coupons, get_access_token } = require(".");

(async () => {
    const tcb_endpoint = "https://api.try.thecouponbureau.org";
    const access_key = process.env.TCB_ACCESS_KEY;
    const secret_key = process.env.TCB_SECRET_KEY;

    

    let input = {
        "basket": [
          {
              "product_code": "5012345678900",
              "price": 0.25,
              "quantity": 2,
              "unit": "item"
          },
          {
              "product_code": "037000934677",
              "price": 1.34,
              "quantity": 3,
              "unit": "item"
          }
        ],
        "coupons": [
            "8112009988459000019133983841909890", 
            "8112009988459000019133512853382124"
        ]
      };


    let output = await validate_basket(input, tcb_endpoint, access_key, secret_key);
    console.log(JSON.stringify(output, null, 2));

    // Rollback the applied coupons
    let rollback_output = await rollback_coupons(output.basket_validation_output.applied_coupons.map(coupon => coupon.coupon_code), tcb_endpoint, "retailer", access_key, secret_key);
    console.log(JSON.stringify(rollback_output, null, 2));

})();