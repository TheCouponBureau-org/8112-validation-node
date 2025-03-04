const { validate_basket_helper } = require("./validate_basket");

function parseConsumer8112 (gs1) {

    
    if ( gs1.indexOf("8110") == 0 ) {
      // return parse8110(gs1);
      var result = {};
      result.message = "failure";
      result.gs1 = gs1;
      result.message = "GS1 Parse Error: 8110 is not supported";
      return result;
    }
  
    var result = {};
    result.message = "failure";
    result.gs1 = gs1;
    if (/^\d+$/.test(gs1) === false) {
      
      result.message = "GS1 Parse Error: must contain only digits";
      
      return result;
    }
    if (gs1.substr(0,4) != "8112") {
      result.message = "GS1 Parse Error: must start with 8112 / 8110";
      return result;
    }
    if (gs1.length > config.max_consumergs1_length_8112) {
      result.message = "GS1 Parse Error: cannot exceed 36 digits";
      return result;
    }

    // if (gs1.length < config.max_basegs1_length_8112) {
    //   result.message = "GS1 Parse Error: should exceed 23 digits";
    //   return result;
    // }
  
    var parsed_data = {};
    
    var start_i = 0;
    //var end_i = 4;
    var length_i = 4;
    
    var required_fields = [
      'ai',
      'coupon_format_digit',
      'vli_company_prefix',
      'company_prefix',
      'offer_code',
      'vli_serial_number',
      'serial_number'
    ];

    parsed_data.ai = gs1.substr(start_i,length_i);
    start_i += length_i;

    parsed_data.coupon_format_digit = gs1.charAt(start_i);
    start_i += 1;

    if ( parsed_data.coupon_format_digit !== '1' && parsed_data.coupon_format_digit !== '0' && parsed_data.coupon_format_digit !== '2' ) {
      result.message = "GS1 Parse Error: Invalid coupon format digit.";
      return result;
    }

    parsed_data.vli_company_prefix = gs1.charAt(start_i);
    length_i = 6 + parseInt(gs1.charAt(start_i));
    start_i ++;
    parsed_data.company_prefix = gs1.substr(start_i,length_i);
  
    start_i += length_i;
    length_i = 6;
    parsed_data.offer_code = gs1.substr(start_i,length_i);

    if ( parsed_data.offer_code.length != 6 ) {
      result.message = "GS1 Parse Error: invalid offer code";
      return result;
    }
  
    
    start_i += length_i;
    parsed_data.base_gs1 = gs1.substr(0, start_i);

    parsed_data.vli_serial_number = gs1.charAt(start_i);
    length_i = 6 + parseInt(gs1.charAt(start_i));
    start_i ++;
    parsed_data.serial_number = gs1.substr(start_i,length_i);

    //Check whether the serial number length is as expected
    if ( parsed_data.serial_number.length != length_i ) {
      result.message = "GS1 Parse Error: invalid serial number";
      return result;
    }
    
    start_i += length_i;
    if ( start_i < gs1.length ) {
      //There are more characters after offer code
      result.message = "GS1 Parse Error: Additional digits after serial number (" + parsed_data.serial_number + ")";
      return result;
    }

    parsed_data.gs1 = gs1;
    
    result.parsed_data = parsed_data;
    result.base_gs1 = parsed_data.base_gs1;

    result.message = "success";
    return result;
    
  }

exports.parseConsumer8112 = parseConsumer8112;
const config = {
    max_basegs1_length_8112: 24,
    max_consumergs1_length_8112: 36
};

const isNullOrUndefined = (value) => {
    return value === null || value === undefined;
};


  function parseBase8112 (gs1) {
  
    if ( gs1.indexOf("8110") == 0 ) {
      return parse8110(gs1);
    }

    var result = {};
    result.message = "error";
    result.gs1 = gs1;
    if (/^\d+$/.test(gs1) === false) {
      result.message = "GS1 Parse Error: must contain only digits";
      return result;
    }
    if (gs1.substr(0,4) != "8112") {
      result.message = "GS1 Parse Error: must start with 8112 / 8110";
      return result;
    }
    if (gs1.length > config.max_basegs1_length_8112) {
      result.message = "GS1 Parse Error: cannot exceed 24 digits";
      return result;
    }
  
    var parsed_data = {};
    
    var start_i = 0;
    //var end_i = 4;
    var length_i = 4;
    
    var required_fields = [
      'ai',
      'coupon_format_digit',
      'vli_company_prefix',
      'company_prefix',
      'offer_code'
    ];

    parsed_data.ai = gs1.substr(start_i,length_i);
    start_i += length_i;

    parsed_data.coupon_format_digit = gs1.charAt(start_i);
    start_i += 1;

    if ( parsed_data.coupon_format_digit !== '1' && parsed_data.coupon_format_digit !== '0' && parsed_data.coupon_format_digit !== '2' ) {
      result.message = "GS1 Parse Error: Invalid coupon format digit.";
      return result;
    }

    parsed_data.vli_company_prefix = gs1.charAt(start_i);
    length_i = 6 + parseInt(gs1.charAt(start_i));
    start_i ++;
    parsed_data.company_prefix = gs1.substr(start_i,length_i);
  
    start_i += length_i;
    length_i = 6;
    parsed_data.offer_code = gs1.substr(start_i,length_i);

    start_i += length_i;
    if ( start_i < gs1.length ) {
      //There are more characters after offer code
      result.message = "GS1 Parse Error: Additional digits after offer code (" + parsed_data.offer_code + ")";
      return result;
    }

    //Check if the offer code is 6 digit long
    if ( isNullOrUndefined(parsed_data.offer_code) || parsed_data.offer_code.length != 6 ) {
      result.message = "GS1 Parse Error: Invalid offer code";
      return result;
    } 
  
  
    result.parsed_data = parsed_data;
  
    result.message = "success";

    
    return result;
    
  }
  exports.parseBase8112 = parseBase8112;

  function parseBase8112InBundle (gs1) {
  
  var result = {};
  result.message = "error";
  result.gs1 = gs1;
  if (/^\d+$/.test(gs1) === false) {
    result.message = "GS1 Parse Error: must contain only digits";
    return result;
  }
  if (gs1.substr(0,4) != "8112") {
    result.message = "GS1 Parse Error: must start with 8112 / 8110";
    return result;
  }
  

  var parsed_data = {};
  
  var start_i = 0;
  //var end_i = 4;
  var length_i = 4;
  
  parsed_data.ai = gs1.substr(start_i,length_i);
  start_i += length_i;

  parsed_data.coupon_format_digit = gs1.charAt(start_i);
  start_i += 1;

  if ( parsed_data.coupon_format_digit !== '1' && parsed_data.coupon_format_digit !== '0' && parsed_data.coupon_format_digit !== '2' ) {
    result.message = "GS1 Parse Error: Invalid coupon format digit.";
    return result;
  }

  parsed_data.vli_company_prefix = gs1.charAt(start_i);
  length_i = 6 + parseInt(gs1.charAt(start_i));
  start_i ++;
  parsed_data.company_prefix = gs1.substr(start_i,length_i);

  start_i += length_i;
  length_i = 6;
  parsed_data.offer_code = gs1.substr(start_i,length_i);

  start_i += length_i;
  if ( start_i < gs1.length ) {
    //There are more characters after offer code
    parsed_data.additional = gs1.substr(start_i);
  }

  //Check if the offer code is 6 digit long
  if ( isNullOrUndefined(parsed_data.offer_code) || parsed_data.offer_code.length != 6 ) {
    result.message = "GS1 Parse Error: Invalid offer code";
    return result;
  } 

  parsed_data.base_gs1 = gs1.substr(0, start_i);

  result.parsed_data = parsed_data;

  result.message = "success";

  return result;
  
}



function parseAppended8112 (gs1) {

  var result = {};
  result.message = "failure";
  result.gs1 = gs1;
  if (/^\d+$/.test(gs1) === false) {
    result.message = "GS1 Parse Error: must contain only digits";
    return result;
  }
  if (gs1.substr(0,4) != "8112") {
    result.message = "GS1 Parse Error: must start with 8112 / 8110";
    return result;
  }
  

  var parsed_data = {};
  
  var start_i = 0;
  var length_i = 4;

  parsed_data.ai = gs1.substr(start_i,length_i);
  start_i += length_i;

  parsed_data.coupon_format_digit = gs1.charAt(start_i);
  start_i += 1;

  if ( parsed_data.coupon_format_digit !== '1' && parsed_data.coupon_format_digit !== '0' && parsed_data.coupon_format_digit !== '2' ) {
    result.message = "GS1 Parse Error: Invalid coupon format digit.";
    return result;
  }

  parsed_data.vli_company_prefix = gs1.charAt(start_i);
  length_i = 6 + parseInt(gs1.charAt(start_i));
  start_i ++;
  parsed_data.company_prefix = gs1.substr(start_i,length_i);

  start_i += length_i;
  length_i = 6;
  parsed_data.offer_code = gs1.substr(start_i,length_i);

  if ( parsed_data.offer_code.length != 6 ) {
    result.message = "GS1 Parse Error: invalid offer code";
    return result;
  }

  
  start_i += length_i;
  parsed_data.base_gs1 = gs1.substr(0, start_i);

  parsed_data.vli_serial_number = gs1.charAt(start_i);
  length_i = 6 + parseInt(gs1.charAt(start_i));
  start_i ++;
  parsed_data.serial_number = gs1.substr(start_i,length_i);

  if ( parsed_data.serial_number.length != length_i ) {
    result.message = "GS1 Parse Error: invalid serial number";
    return result;
  }
  
  start_i += length_i;
  
  return {
    gs1: gs1.substr(0, start_i),
    nextStart: gs1.substr(start_i),
    message: "success"
  };
  
}

function decodeAppendedGS1s(gs1) {  //gs1->long appened string, without comma
  let gs1s = [];
  while ( true ) {
    let resp = parseAppended8112(gs1);
    if ( resp.nextStart === '' || resp.message !== 'success' ) {
      if ( !isNullOrUndefined(resp.gs1) && resp.gs1.length > 0 ) {
        gs1s.push(resp.gs1);
      }
      break;
    }
    gs1s.push(resp.gs1);
    gs1 = resp.nextStart;
  }

  return gs1s; // converted to array 
}


function sort_coupons_by_discount_in_cents(basket, coupons) {
  // Calculate discount_in_cents for each coupon
  for (let coupon of coupons) {
        let input_with_single_coupon = {
            basket: basket,
            coupons: [coupon]
        }
        let {basket_validation_output} = validate_basket_helper(input_with_single_coupon);
        coupon.discount_in_cents = basket_validation_output.discount_in_cents;
    }

    // Sort coupons by discount_in_cents in descending order
    coupons.sort((a, b) => b.discount_in_cents - a.discount_in_cents);
    return coupons;
}


exports.decodeAppendedGS1s = decodeAppendedGS1s;
exports.sort_coupons_by_discount_in_cents = sort_coupons_by_discount_in_cents;