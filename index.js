const Ajv = require("ajv");
const axios = require("axios");
const { INPUT_SCHEMA } = require("./constant");
const { validate_coupons } = require("./tcb");
const { validate_basket_helper } = require("./validate_basket");

const ajv = new Ajv({ allErrors: true });

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

        return response.data['x-access-token'];
    } catch (error) {
        throw new Error('Error getting access token:', error.message);
    }
}

// Validate basket input
async function validate_basket(input, tcb_endpoint, access_key, access_token) {
    let start_time = performance.now();
    const validate = ajv.compile(INPUT_SCHEMA);
    const valid = validate(input);
    if (!valid) {
        throw new Error('Invalid input', validate.errors);
    }

    // Validate coupons
    const { coupons, tcb_execution_time_in_ms, tcb_network_latency_in_ms } = await validate_coupons(input.coupons, tcb_endpoint, access_key, access_token);
    
    input.coupons = coupons;

    // Validate basket
    const basket_validation_output = await validate_basket_helper(input);

    let end_time = performance.now();
    let lib_execution_time_in_ms = end_time - start_time - tcb_execution_time_in_ms - tcb_network_latency_in_ms;

    // If applied_coupons is > 0, do actual redemption

    return {
        basket_validation_output,
        lib_execution_time_in_ms,
        tcb_execution_time_in_ms,
        tcb_network_latency_in_ms
    };

}

module.exports = {
    access_token,
    validate_basket
}