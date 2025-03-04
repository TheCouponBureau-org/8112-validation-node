const { access_token, coupons_valid_for_basket, redeem_coupons, rollback_coupons } = require(".");

const tcb_endpoint = "https://api.try.thecouponbureau.org";
const access_key = "e5896b3f738a524882f96998740deaa3";
const secret_key = "b197a166797f2f38dc73bd9425815823";
const retailer_email_domain = null; // If you are using accelerator API, pass the retailer email domain

const redisClient = null;

(async() => {
        
        // Get access token from TCB API
        const token = await access_token(tcb_endpoint, access_key, secret_key);
        // console.log(token);

        const input = {
            "basket": [
                {
                    "product_code": "037000930396",
                    "price": 1.29,
                    "quantity": 30,
                    "unit": "item"
                }
            ],
            "coupons": [
                "8112009988459000019133570599912488", "8112009988459000019133877781226974", "8112009988459000019133859965768722", "8112009988459000019133224368489804", "8112009988459000019133713364281900", "8112009988459000019133987126069024", "8112009988459000019133890698431742", "8112009988459000019133651508675273", "8112009988459000019133336271799037", "8112009988459000019133176628909224", "8112009988459000019133750058365188", "8112009988459000019133929035621087", "8112009988459000019133492823346639", "8112009988459000019133323532027732", "8112009988459000019133335249479771", "8112009988459000019133288224295044", "8112009988459000019133394466602663", "8112009988459000019133166388485468", "8112009988459000019133114592795480", "8112009988459000019133229499668809"
            ]
        }

        // Get all coupons valid for the basket
        let basket_validation_output = await coupons_valid_for_basket(input, tcb_endpoint, access_key, token, retailer_email_domain, redisClient);
        console.log("Basket Validation Output", JSON.stringify(basket_validation_output, null, 2));

        // Create a new array of coupons which are applied in the basket from the basket_validation_output
        const applied_coupons = basket_validation_output.applied_coupons.map(coupon => coupon.coupon_code);
        console.log("Applied Coupons", JSON.stringify(applied_coupons, null, 2));

        // Redeem the coupons 
        let redeemed_coupons = await redeem_coupons(applied_coupons, tcb_endpoint, access_key, token, retailer_email_domain);
        console.log("Redeemed Coupons Output", JSON.stringify(redeemed_coupons, null, 2));

        // In case of any issues or transaction failure, rollback the coupons
        let rolled_back_coupons = await rollback_coupons(redeemed_coupons, tcb_endpoint, "retailer", access_key, token);
        console.log("Rolled Back Coupons Output", JSON.stringify(rolled_back_coupons, null, 2));

})()
