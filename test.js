const { access_token, validate_basket } = require(".");

(async () => {
    const tcb_endpoint = "https://api.try.thecouponbureau.org";
    const access_key = "18ac58d9ec97ad536f1715782830cdb3";
    const secret_key = "f20742cd9ba56ee8271f81b718df7844";

    let token = await access_token(tcb_endpoint, access_key, secret_key);
    // console.log("Access Token:", token);

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
            "quantity": 2,
            "unit": "item"
          }
        ],
        "coupons": [
          "8112009988459000019133629292599294", 
          "8112009988459000019133256068589971"
        ]
      };


    let output = await validate_basket(input, tcb_endpoint, access_key, token);
    console.log(output);

})();