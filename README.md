```
npm install pos-validation-sdk
```

# Sample Usage

```

const pos_sdk = require("pos-validation-sdk");

(async () => {
    const tcb_endpoint = "https://api.try.thecouponbureau.org";
    const access_key = "18ac58#################82830cdb3";
    const secret_key = "f20742#################718df7844";

    // Get Access Token
    let token_response = await pos_sdk.access_token(tcb_endpoint, access_key, secret_key);
    let token = token_response.access_token;
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


    let output = await pos_sdk.validate_basket(input, tcb_endpoint, access_key, token);
    console.log(JSON.stringify(output, null, 2));

})();
```