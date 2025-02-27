const axios = require("axios");

// From the list of scanned coupons, resolve fetch code and returns the list of serialized coupons

// Returns array {gs1: gs1, base_gs1: base_gs1, purchase_requirement: purchase_requirement || null}
async function validate_coupons(coupons, tcb_endpoint, access_key, access_token, retailer_email_domain, pre_process = "yes", include_check_digit = "yes", offline = "no") {
    let startTime = performance.now();
    let headers = {
        'Content-Type': 'application/json',
        'x-access-token': access_token,
        'x-api-key': access_key
    };
    // console.log('headers', headers);

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

        // console.log("redeemParams", tcb_endpoint, redeemParams);
        const response = await axios.post(`${tcb_endpoint}/retailer/redeem`, redeemParams, {
            headers: headers
        });
        let endTime = performance.now();
        let tcb_execution_time_in_ms = response.data.execution_time_in_ms;

        // console.log("response", response.data);

        // Convert newly_redeemed to {gs1: "...", purchase_requirement: {}}
        let coupons_adapted = [];
        for ( let i = 0; i < response.data.newly_redeemed.length; i++ ) {
            coupons_adapted.push({
                gs1: response.data.newly_redeemed[i].gs1,
                purchase_requirement: response.data.master_offer_files[response.data.newly_redeemed[i].master_offer_file]
            });
        }
        
        return {
            coupons: coupons_adapted,
            tcb_execution_time_in_ms: tcb_execution_time_in_ms,
            tcb_network_latency_in_ms: endTime - startTime - tcb_execution_time_in_ms
        };
    } catch (error) {
        
        // console.log("*** redeem error", error);
        if ( error?.response?.data && error.response.data.code === 'EXCEED_MAXIMUM' ) {
            
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

                let promise = axios.post(`${tcb_endpoint}/retailer/redeem`, redeemParams, {
                    headers: headers
                });
                
                promises.push(promise);
            }
            let tcb_execution_time_in_ms_start = performance.now();
            let redemption_outputs = await Promise.allSettled(promises);
            let tcb_execution_time_in_ms_end = performance.now();
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
            let endTime = performance.now();
            let tcb_network_latency_in_ms = endTime - startTime;

            return {
                coupons: newly_redeemed,
                tcb_execution_time_in_ms: tcb_execution_time_in_ms_end - tcb_execution_time_in_ms_start,
                tcb_network_latency_in_ms: tcb_network_latency_in_ms
            }
            
        }

        let endTime = performance.now();
        return {
            coupons: [],
            tcb_execution_time_in_ms: 0,
            tcb_network_latency_in_ms: endTime - startTime
        }
    }
}

module.exports = {
    validate_coupons
}