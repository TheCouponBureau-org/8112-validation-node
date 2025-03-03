const Ajv = require("ajv");
const axios = require("axios");
const { INPUT_SCHEMA } = require("./constant");
const { tcb_process_coupons } = require("./tcb");
const { validate_basket_helper } = require("./validate_basket");

const ajv = new Ajv({ allErrors: true });


// Get access token from TCB API
async function access_token(tcb_endpoint, access_key, secret_key) {
    
    const response = await axios.post(`${tcb_endpoint}/access_token`, {
        access_key: access_key,
        secret_key: secret_key
    }, {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': access_key
        }
    });

    return response.data['x-access-token'];
    
}

// Find applicable coupons and calculate discount_in_cents for each coupon against basket and total discount_in_cents
async function coupons_valid_for_basket(input, tcb_endpoint, access_key, access_token, retailer_email_domain) {

    const validate = ajv.compile(INPUT_SCHEMA);
    const valid = validate(input);
    if (!valid) {
        throw new Error('Invalid input', validate.errors);
    }

    
    // TCB Vlidate with pre_process = yes, include_check_digit = yes, offline = no
    let { coupons } = await tcb_process_coupons(input.coupons, tcb_endpoint, access_key, access_token, retailer_email_domain);
    
    input.coupons = coupons;

    // Calculate discount_in_cents for each coupon
    for (let coupon of input.coupons) {
        let input_with_single_coupon = {
            basket: input.basket,
            coupons: [coupon]
        }
        let {basket_validation_output} = validate_basket_helper(input_with_single_coupon);
        coupon.discount_in_cents = basket_validation_output.discount_in_cents;
    }

    // Sort coupons by discount_in_cents in descending order
    input.coupons.sort((a, b) => b.discount_in_cents - a.discount_in_cents);

    // Validate basket and find applicable coupons
    const {basket_validation_output} = validate_basket_helper(input);

    
    return basket_validation_output;

}

async function redeem_coupons(coupons, tcb_endpoint, access_key, access_token, retailer_email_domain) {
    
    const redeem_response = await tcb_process_coupons(coupons, tcb_endpoint, access_key, access_token, retailer_email_domain, "no", "yes", "yes");
    let redeemed_coupons = redeem_response.coupons.map(coupon => coupon.gs1);
    return redeemed_coupons;
    
}

// Rollback coupons
async function rollback_coupons(coupons, tcb_endpoint, mode, access_key, access_token) {
   
    
    let promises = [];
    for (let coupon of coupons) {
        promises.push(axios.delete(`${tcb_endpoint}/${mode}/rollback/${coupon}`, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': access_key,
                'x-access-token': access_token
            }
        }));
    }

    let responses = await Promise.allSettled(promises);
    // Check if all promises are fulfilled = return the coupons rolled back else return coupons requires to be retried
    // There could be promises that are rejected due to network issues or other reasons
    // Promises those are rejected, same index value from coupons array needs to be retried
    let rolled_back_coupons = [];   
    for (let i = 0; i < responses.length; i++) {
        if (responses[i].status === 'fulfilled') {
            rolled_back_coupons.push(coupons[i]);
        }
    }

    return rolled_back_coupons;
    
}

module.exports = {
    access_token,
    coupons_valid_for_basket,
    redeem_coupons,
    rollback_coupons
}