

const { decodeAppendedGS1s, sort_coupons_by_discount_in_cents, parseConsumer8112 } = require("./util");
const { validate_basket_helper } = require("./validate_basket");



// From the list of scanned coupons, resolve fetch code and returns the list of serialized coupons
// FSI will stay as it is, during fetch code resolution, we will add the purchase requirements to the purchase_requirements object
// Returns array {gs1: gs1, purchase_requirement: purchase_requirement || null}
async function get_expanded_coupons(coupons, retailer_email_domain, axiosApiClient) {
    // Divide the coupons into serialized coupon, FSI (non serialized) and fetch code array
    let serialized_coupons = [];
    let fetch_code_coupons = [];
    let fsi_coupons = [];

    for ( let i=0; i<coupons.length; i++ ) {
        if ( coupons[i].length === 16 ) {
            fetch_code_coupons.push(coupons[i]);
        } else if ( coupons[i].indexOf("81122") === 0 ) {
            fsi_coupons.push({
                gs1: coupons[i],
                purchase_requirement: null
            });
        } else {
            let bundled_coupons = decodeAppendedGS1s(coupons[i]);
            for ( let j=0; j<bundled_coupons.length; j++ ) {
                serialized_coupons.push({
                    gs1: bundled_coupons[j],
                    purchase_requirement: null
                });
            }
        }
    }

    
    // If it is fetch code, call redemption api with pre_process = yes
    if ( fetch_code_coupons.length > 0 ) {
        // Use pre_process = yes, include_check_digit = yes, offline = no to get
        // purcahse requirements from fetch code coupons
        let redemption_response = await redeem(
            fetch_code_coupons, 
            retailer_email_domain, 
            axiosApiClient,
            "yes", 
            "yes", 
            "no",
            true,
            redisClient);


        // If redemption_response is null, it means there is an error in redeem call, 
        // we have to ignore the fetch codes as we could not retrieve the serialized gs1s
        if ( redemption_response && redemption_response.status === 'success' && redemption_response.newly_redeemed.length > 0 ) {
            for ( let i=0; i<redemption_response.newly_redeemed.length; i++ ) {
                serialized_coupons.push({
                    gs1: redemption_response.newly_redeemed[i].gs1,
                    purchase_requirement: redemption_response.master_offer_files[redemption_response.newly_redeemed[i].master_offer_file],
                    tcb_validates: true
                });
            }
        } else if ( redemption_response && redemption_response.status === 'error' && redemption_response.code === 'EXCEED_MAXIMUM' ) {
            // Get returned gs1s which will have more than 15 coupons - but these are serialized coupons not fetch code
            // we can add them to the serialized_coupons array and continue with local database
            let returned_gs1s = redemption_response.gs1s;
            
            // Convert into {gs1: gs1, purchase_requirement: purchase_requirement || null}
            returned_gs1s = returned_gs1s.map(gs1 => {
                return {
                    gs1: gs1,
                    purchase_requirement: null
                };
            });

            // Add to serialized_coupons
            serialized_coupons = [...serialized_coupons, ...returned_gs1s];
        }
        
    }

    // Add fsi coupons to the serialized_coupons
    if ( fsi_coupons.length > 0 ) {
        serialized_coupons = [...serialized_coupons, ...fsi_coupons];
    }

    return serialized_coupons;
}

// Input {gs1: gs1, purchase_requirement: null} add the actual purchase requirement to the purchase_requirement key
async function get_purchase_requirements(coupons, retailer_email_domain, redisClient, axiosApiClient) {
    
    // Get the purchase requirements from redis
    
    let missing_purchase_requirements = [];
    let redisPromises = [];
    let redisInputKeys = [];
    let invalid_coupons = [];

    for (let i = 0; i < coupons.length; i++) {
        let parsed_coupon = null;

        if (coupons[i].gs1.startsWith("81122")) {
            parsed_coupon = {
                base_gs1: coupons[i].gs1.slice(0, -4), // Remove last 4 digits (tracking code in 81122 coupons)
                message: "success"
            };
        } else {
            parsed_coupon = parseConsumer8112(coupons[i].gs1);
        }

        if (parsed_coupon.message === "success") {
            coupons[i].base_gs1 = parsed_coupon.base_gs1;
            redisInputKeys.push(parsed_coupon.base_gs1);
            redisPromises.push(
                redisClient.get(parsed_coupon.base_gs1)
            );
        } else {
            invalid_coupons.push(coupons[i]);
        }
    }

    

    // Execute all Redis queries in parallel
    let redisResponses = await Promise.allSettled(redisPromises);
    // console.log("redisResponses", redisResponses);
    for ( let i=0; i<redisResponses.length; i++ ) {
        if ( redisResponses[i].status === 'fulfilled' ) {
            // Find all coupons with base_gs1 = redisInputKeys[i]
            let coupons_with_base_gs1 = coupons.filter(coupon => coupon.base_gs1 === redisInputKeys[i]);
            for ( let j=0; j<coupons_with_base_gs1.length; j++ ) {
                coupons_with_base_gs1[j].purchase_requirement = JSON.parse(redisResponses[i].value);
            }
        }
    }

    // Remove invalid coupons from coupons array
    coupons = coupons.filter(coupon => !invalid_coupons.some(invalid_coupon => invalid_coupon.gs1 === coupon.gs1));

    // Identify missing purchase requirements
    missing_purchase_requirements = coupons.filter(coupon => !coupon.purchase_requirement);
    
    // Remove the coupons from coupons array which are not having purchase requirement
    coupons = coupons.filter((coupon) => coupon.purchase_requirement);

    // If there are missing purchase requirements, call redemption api with pre_process = yes to get the purchase requirements
    if ( missing_purchase_requirements.length > 0 ) {
        let gs1s_for_redemption_api = missing_purchase_requirements.map(coupon => coupon.gs1);

        let redemption_response = null;

        try {
            redemption_response = await redeem(
                gs1s_for_redemption_api,
                retailer_email_domain,
                axiosApiClient,
                "yes",
                "yes",
                "no",
                false,
                redisClient,
                true
            );

            // console.log("redemption_response", redemption_response);

            // If the redemption_response is null, it means there is an error in redeem call, 
            // we will have to ignore these coupons as we could not retrieve the purchase requirements
            if ( redemption_response && redemption_response.length > 0 ) {
                for ( let i=0; i<redemption_response.length; i++ ) {
                    let purchase_requirement = redemption_response[i].purchase_requirement;
                    let parsed_coupon = parseConsumer8112(redemption_response[i].gs1);
                    // Store this purchase requirement in redis
                    await redisClient.set(parsed_coupon.base_gs1, JSON.stringify(purchase_requirement));
                    for ( let j=0; j<missing_purchase_requirements.length; j++ ) {
                        if ( missing_purchase_requirements[j].gs1 === redemption_response[i].gs1 ) {
                            missing_purchase_requirements[j].purchase_requirement = purchase_requirement;
                            missing_purchase_requirements[j].tcb_validates = true;
                        }
                    }
                }
            }
        } catch (error) {
            // Error in redeem call
        }
    }

    // Add all missing purchase requirements to coupons if it has received purchase requirements from redeem call
    for ( let i=0; i<missing_purchase_requirements.length; i++ ) {
        if ( missing_purchase_requirements[i].purchase_requirement ) {
            coupons.push(missing_purchase_requirements[i]);
        }
    }

    // Return coupons with purchase requirements
    return coupons;
}

// From the list of scanned coupons, resolve fetch code and returns the list of serialized coupons

// Returns array {gs1: gs1, base_gs1: base_gs1, purchase_requirement: purchase_requirement || null}
async function tcb_process_coupons(basket, coupons, retailer_email_domain, redisClient = null, axiosApiClient, pre_process = "yes", include_check_digit = "yes", offline = "no") {
    
    if ( redisClient ) {
        try {
            await redisClient.get("TEST_MOF");
            coupons = await get_expanded_coupons(coupons, retailer_email_domain, axiosApiClient, redisClient);
            coupons = await get_purchase_requirements(coupons, retailer_email_domain, redisClient, axiosApiClient); // coupons with purchase requirements

            coupons = sort_coupons_by_discount_in_cents(basket, coupons);
            // Get applicable coupons
            let {basket_validation_output} = validate_basket_helper({ basket: basket, coupons: coupons });
            let applied_coupons = basket_validation_output.applied_coupons.map(coupon => coupon.coupon_code);

            // Validate in TCB with pre_process = yes, include_check_digit = yes, offline = no
            let tcb_validated_coupons = await redeem(applied_coupons, retailer_email_domain, axiosApiClient, "yes", "yes", "no", false, redisClient);
            
            // Find the coupons that are not validated by TCB
            let tcb_not_validated_coupons = coupons.filter(coupon => !tcb_validated_coupons.coupons.some(tcb_coupon => tcb_coupon.gs1 === coupon.gs1));
            if ( tcb_not_validated_coupons.length > 0 ) {
                // Some coupons that are applied on the basket is not valid in TCB, remove them from coupons 
                // and revalidate basket. These coupons are valid for basket as well as tcb validated
                coupons = coupons.filter(coupon => tcb_validated_coupons.coupons.some(tcb_coupon => tcb_coupon.gs1 === coupon.gs1));
            }
            
            return {coupons};
        } catch ( err ) {
            throw new Error("Redis connection error");
        }
    }
    
    // console.log('headers', headers);
    let applied_coupons = await redeem(coupons, retailer_email_domain, axiosApiClient, pre_process, include_check_digit, offline, false, redisClient);
    applied_coupons = applied_coupons.coupons;
    applied_coupons = sort_coupons_by_discount_in_cents(basket, applied_coupons);
    
    return {coupons: applied_coupons};
}





async function redeem(coupons, retailer_email_domain, axiosApiClient, pre_process, include_check_digit, offline, no_exceed_maximum_retry = false, redisClient = null, store_mof_in_redis = false ) {
    
    try {

        const redeemParams = {
            gs1s: coupons,
            pre_process: pre_process,
            include_check_digit: include_check_digit,
            offline: offline
        }
        if ( retailer_email_domain ) {
            redeemParams.retailer_email_domain = retailer_email_domain;
        }

        // console.log("redeemParams", redeemParams);

        // console.log("redeemParams", tcb_endpoint, redeemParams);
        const response = await axiosApiClient.post(`/retailer/redeem`, redeemParams);
        // console.log("*** response", response.data);
        
        // Convert newly_redeemed to {gs1: "...", purchase_requirement: {}}
        let coupons_adapted = [];
        for ( let i = 0; i < response.data.newly_redeemed.length; i++ ) {
            coupons_adapted.push({
                gs1: response.data.newly_redeemed[i].gs1,
                purchase_requirement: response.data.master_offer_files[response.data.newly_redeemed[i].master_offer_file]
            });
        }

        if ( store_mof_in_redis ) {
            let redisPromises = [];
            for ( let base_gs1 in response.data.master_offer_files ) {
                console.log("Set MOF in redis", base_gs1);
                redisPromises.push(redisClient.set(base_gs1, JSON.stringify(response.data.master_offer_files[base_gs1])));
            }
            await Promise.allSettled(redisPromises);
        }

        
        return {
            coupons: coupons_adapted
        };
    } catch (error) {

        // console.log("*** error", redeemParams, error.response.data);

        // console.log("*** redeem error", error);
        if ( error?.response?.data && error.response.data.code === 'EXCEED_MAXIMUM' ) {

            if ( no_exceed_maximum_retry ) {
                return {
                    status: "error",
                    code: "EXCEED_MAXIMUM",
                    gs1s: error.response.data.gs1s
                }
            }
            
            let gs1s = error.response.data.gs1s;
            let gs1s_chunks = [];
            for ( let i = 0; i < gs1s.length; i += 15 ) {
                gs1s_chunks.push(gs1s.slice(i, i + 15));
            }
            // Redeem chunks one by one
            let promises = [];
            for ( let i = 0; i < gs1s_chunks.length; i++ ) {

                const redeemParams = {
                    gs1s: gs1s_chunks[i],
                    pre_process: pre_process,
                    include_check_digit: include_check_digit,
                    offline: offline
                }
                if ( retailer_email_domain ) {
                    redeemParams.retailer_email_domain = retailer_email_domain;
                }

                let promise = axiosApiClient.post(`/retailer/redeem`, redeemParams);
                
                promises.push(promise);
            }
            let redemption_outputs = await Promise.allSettled(promises);
            // Get all newly redeemed gs1s
            let newly_redeemed = [];
            // console.log("redemption_outputs", redemption_outputs);
            for ( let i=0; i<redemption_outputs.length; i++ ) {
                if (redemption_outputs[i].status === 'fulfilled') {
                    if ( redemption_outputs[i]?.value?.data?.newly_redeemed ) {
                        // convert newly_redeemed to {gs1: "...", purchase_requirement: {}}
                        let coupons_adapted = [];
                        for ( let j = 0; j < redemption_outputs[i].value.data.newly_redeemed.length; j++ ) {
                            coupons_adapted.push({
                                gs1: redemption_outputs[i].value.data.newly_redeemed[j].gs1,
                                purchase_requirement: redemption_outputs[i].value.data.master_offer_files[redemption_outputs[i].value.data.newly_redeemed[j].master_offer_file]
                            });
                        }
                        newly_redeemed = [...newly_redeemed, ...coupons_adapted];
                    }

                }
            }
            
            return {
                coupons: newly_redeemed
            }
            
        }

        return {
            coupons: []
        }
    }
}


async function mof_sync ( from_date, to_date, redisClient, axiosApiClient ) {

    try {
        await redisClient.get("TEST_MOF");
    } catch ( err ) {
        throw new Error("Redis connection error");
    }

    let pageNo = '';
    let total_count = 0;
    let mof_synced = [];
    
    while (true) {
        try {
            let response = await axiosApiClient.get(`/syncmof/${from_date}/${to_date}/updated?pageNo=${pageNo}`);

            response = response.data;
            let mof_array = response.data;
            
            pageNo = response.nextPageNo;

            total_count += mof_array.length;

            console.log("*** synced", mof_array.length, "mof");

            for ( let i = 0; i < mof_array.length; i++ ) {
                await redisClient.set(mof_array[i].base_gs1, JSON.stringify(mof_array[i]));
                mof_synced.push(mof_array[i].base_gs1);
            }

            if ( pageNo === null || pageNo === "-1" ) {
                break;
            }
        } catch ( err ) {
            console.log("*** sync mof error", err);
            break;
        }
    }

    return mof_synced.length;

}

module.exports = {
    tcb_process_coupons,
    mof_sync,
    redeem
}