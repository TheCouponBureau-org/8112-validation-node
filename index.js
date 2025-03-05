const Ajv = require("ajv");
const axios = require("axios");
const axiosRetry = require('axios-retry').default;

const { INPUT_SCHEMA } = require("./constant");
const { tcb_process_coupons, mof_sync, redeem } = require("./tcb");
const { validate_basket_helper } = require("./validate_basket");

const ajv = new Ajv({ allErrors: true });

let redisClient = null;
function set_redis_client(client) {
    redisClient = client;
}


let axiosApiClient = null;
async function configure_api_client(tcb_api_endpoint, http_timeout, no_of_retries, retry_interval) {
    if ( axiosApiClient !== null) {
        return axiosApiClient;
    }
    
    // Set up Axios instance with retry and timeout
    const apiClient = axios.create({
        baseURL: tcb_api_endpoint,
        timeout: http_timeout, // Timeout for each request (in milliseconds)
    });

    // Apply retry interceptor to axios instance
    axiosRetry(apiClient, {
        retries: no_of_retries, // Number of retries
        retryDelay: (retryCount) => {
            return retryCount * retry_interval; // time interval between retries (in milliseconds)
        },
        retryCondition: (error) => {
            // Retry only if the error was due to a network or a 5xx status code
            return error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED' || axiosRetry.isNetworkOrIdempotentRequestError(error);
        },
    });

    axiosApiClient = apiClient;
}

function redisConfigured() {
    if (!redisClient) {
        throw new Error("Redis client is not initialized. Call set_redis_client first.");
    }
}

function apiClientConfigured() {
    if (!axiosApiClient) {
        throw new Error("API client is not initialized. Call configure_api_client first.");
    }
}

function apiTokenConfigured() {
    if (!axiosApiClient) {
        throw new Error("API client is not initialized. Call configure_api_client first.");
    }

    if ( !axiosApiClient.defaults.headers["x-access-token"] || !axiosApiClient.defaults.headers["x-api-key"] ) {
        throw new Error("API token is not initialized. Call set_access_token first.");
    }
}

function set_auth_headers(access_key, access_token) {
    if (!axiosApiClient) {
        throw new Error("API client is not initialized. Call configure_api_client first.");
    }

    axiosApiClient.defaults.headers["x-api-key"] = access_key;
    axiosApiClient.defaults.headers["x-access-token"] = access_token;
    axiosApiClient.defaults.headers["Content-Type"] = "application/json";
}


// Get access token from TCB API
async function get_access_token(access_key, secret_key) {

    apiClientConfigured();
    
    const response = await axiosApiClient.post(`/access_token`, {
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

async function set_access_token(access_key, access_token) {
    set_auth_headers(access_key, access_token);
}

// Find applicable coupons and calculate discount_in_cents for each coupon against basket and total discount_in_cents
async function coupons_valid_for_basket(input, retailer_email_domain) {

    apiClientConfigured();
    apiTokenConfigured();

    const validate = ajv.compile(INPUT_SCHEMA);
    const valid = validate(input);
    if (!valid) {
        throw new Error('Invalid input', validate.errors);
    }

    
    // TCB Vlidate with pre_process = yes, include_check_digit = yes, offline = no
    let { coupons, without_redis } = await tcb_process_coupons(input.basket, input.coupons, retailer_email_domain, redisClient, axiosApiClient);
    if ( without_redis ) {
        let { coupons } = await tcb_process_coupons(input.basket, input.coupons, retailer_email_domain, null, axiosApiClient);
        input.coupons = coupons;
    } else {
        input.coupons = coupons;
    }

    // Validate basket and find applicable coupons
    const {basket_validation_output} = validate_basket_helper(input);

    return basket_validation_output;

}

async function redeem_coupons(coupons, retailer_email_domain, offline = "no") {

    apiClientConfigured();
    apiTokenConfigured();
    set_redis_client(redisClient);
    const redeem_response = await redeem(coupons, retailer_email_domain, axiosApiClient, "no", "yes", offline, false, redisClient);
    let redeemed_coupons = redeem_response.coupons.map(coupon => coupon.gs1);
    return redeemed_coupons;
    
}

// Rollback coupons
async function rollback_coupons(coupons, mode) {

    apiClientConfigured();
    apiTokenConfigured();
    if ( mode === undefined ) {
        mode = "retailer";
    }
    let promises = [];
    for (let coupon of coupons) {
        promises.push(axiosApiClient.delete(`/${mode}/rollback/${coupon}`));
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

// get purchase requirements from server and populate local database for faster processing
async function populate_local_database( from_date, to_date ) {

    redisConfigured();
    apiClientConfigured();
    apiTokenConfigured();
    console.log("Syncing MOF from", from_date, "to", to_date);
    let mof_synced = await mof_sync(from_date, to_date, redisClient, axiosApiClient);
    return mof_synced;
}

module.exports = {
    set_redis_client,
    get_access_token,
    set_access_token,
    coupons_valid_for_basket,
    redeem_coupons,
    rollback_coupons,
    populate_local_database,
    configure_api_client
}