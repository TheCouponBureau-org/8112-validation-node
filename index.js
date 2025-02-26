const Ajv = require("ajv");
const axios = require("axios");
const fs = require("fs");
const { INPUT_SCHEMA } = require("./constant");
const { validate_coupons } = require("./tcb");
const { validate_basket_helper } = require("./validate_basket");

const ajv = new Ajv({ allErrors: true });


async function get_access_token(tcb_endpoint, access_key, secret_key) {
    // Check local file .tcb_<access_key> in sync
    try {
        let access_token_value = fs.readFileSync(`.tcb_${access_key}`, 'utf8');
        access_token_value = JSON.parse(access_token_value);
        // console.log("*** access_token_value", access_token_value);
        if (access_token_value.valid_till < Date.now() || !access_token_value.access_token) {
            let access_token_response = await access_token(tcb_endpoint, access_key, secret_key);
            access_token_value = {
                access_token: access_token_response.access_token,
                valid_till: Date.now() + 23 * 60 * 60 * 1000 // 23 hours from now in epoch time
            }
            fs.writeFileSync(`.tcb_${access_key}`, JSON.stringify(access_token_value));
        }
        return access_token_value.access_token;
    } catch (error) {
        let access_token_response = await access_token(tcb_endpoint, access_key, secret_key);
        access_token_value = {
            access_token: access_token_response.access_token,
            valid_till: Date.now() + 23 * 60 * 60 * 1000 // 23 hours from now in epoch time
        };
        fs.writeFileSync(`.tcb_${access_key}`, JSON.stringify(access_token_value));
        return access_token_value.access_token;
    }

}

// Get access token from TCB API
async function access_token(tcb_endpoint, access_key, secret_key) {
    try {
        const response = await axios.post(`${tcb_endpoint}/access_token`, {
            access_key: access_key,
            secret_key: secret_key
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': access_key
            }
        });

        return {
            status: "success",
            access_token: response.data['x-access-token'],
            access_key: access_key
        }
    } catch (error) {
        return {
            status: "error",
            message: error.message
        }
    }
}

// Validate basket input
async function validate_basket(input, tcb_endpoint, access_key, secret_key, retailer_email_domain) {

    let start_time = performance.now();
    const validate = ajv.compile(INPUT_SCHEMA);
    const valid = validate(input);
    if (!valid) {
        throw new Error('Invalid input', validate.errors);
    }

    let access_token = await get_access_token(tcb_endpoint, access_key, secret_key);

    // Validate coupons
    let { coupons, tcb_execution_time_in_ms, tcb_network_latency_in_ms } = await validate_coupons(input.coupons, tcb_endpoint, access_key, access_token, retailer_email_domain);
    
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

    // Validate basket
    const {basket_validation_output} = await validate_basket_helper(input);

    let end_time = performance.now();
    let lib_execution_time_in_ms = (end_time - start_time - tcb_execution_time_in_ms - tcb_network_latency_in_ms) ;

    // If applied_coupons is > 0, do actual redemption
    if (basket_validation_output.applied_coupons.length > 0) {
        let coupons = basket_validation_output.applied_coupons.map(coupon => coupon.coupon_code);
        // Redeem coupons actually
        const redeem_response = await validate_coupons(coupons, tcb_endpoint, access_key, access_token, retailer_email_domain, "no", "yes", "no");
        tcb_execution_time_in_ms += redeem_response.tcb_execution_time_in_ms;
        tcb_network_latency_in_ms += redeem_response.tcb_network_latency_in_ms;
    }

    return {
        basket_validation_output,
        // lib_execution_time_in_ms,
        tcb_execution_time_in_ms,
        tcb_network_latency_in_ms
    };

}

async function rollback_coupons(coupons, tcb_endpoint, mode, access_key, secret_key) {
    let start_time = performance.now();
    let access_token = await get_access_token(tcb_endpoint, access_key, secret_key);
    try {
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
        let failed_coupons = [];
        let rolled_back_coupons = [];   
        for (let i = 0; i < responses.length; i++) {
            if (responses[i].status === 'fulfilled') {
                rolled_back_coupons.push(coupons[i]);
                // Get execution_time_in_ms from response from responses[i] data
                let execution_time_in_ms = responses[i].value.data.execution_time_in_ms;
                
            } else {
                failed_coupons.push(coupons[i]);
            }
        }

        let end_time = performance.now();

        return {
            status: "success",
            rolled_back_coupons,
            failed_coupons,
            lib_execution_time_in_ms: end_time - start_time
        }
    } catch (error) {
        return {
            status: "error",
            message: error.message
        }
    }
}

module.exports = {
    get_access_token,
    validate_basket,
    rollback_coupons
}