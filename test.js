require("dotenv").config();
const { validate_basket, rollback_coupons, get_access_token } = require(".");

(async () => {
    const tcb_endpoint = "https://api.try.thecouponbureau.org";
    const access_key = process.env.TCB_ACCESS_KEY;
    const secret_key = process.env.TCB_SECRET_KEY;
    const retailer_email_domain = process.env.RETAILER_EMAIL_DOMAIN;

    
    

    let input = {
        "basket": [
          {
              "product_code": "041000077210",
              "price": 2.25,
              "quantity": 2,
              "unit": "item"
          }
        ],
        "coupons": [
            "81120411223344565467899885918082540605"  
        ]
    };


    let output = await validate_basket(input, tcb_endpoint, access_key, secret_key, retailer_email_domain);
    console.log(JSON.stringify(output, null, 2));

    // Rollback the applied coupons
    let rollback_output = await rollback_coupons(output.basket_validation_output.applied_coupons.map(coupon => coupon.coupon_code), tcb_endpoint, "accelerator", access_key, secret_key);
    console.log(JSON.stringify(rollback_output, null, 2));

})();