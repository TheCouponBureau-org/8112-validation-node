require("dotenv").config();
const { validate_basket, rollback_coupons, get_access_token } = require(".");

(async () => {
    const tcb_endpoint = "https://api.try.thecouponbureau.org";
    const access_key = process.env.TCB_ACCESS_KEY;
    const secret_key = process.env.TCB_SECRET_KEY;
    const retailer_email_domain = process.env.RETAILER_EMAIL_DOMAIN;

    
    

    let input = {
        basket: [
          {
            product_code: '037000930396',
            price: 1.29,
            quantity: 30,
            unit: 'item'
          }
        ],
        coupons: [
          '8112009988459000019133774893640444',
          '8112009988459000019133555526757981',
          '8112009988459000019133817787661822',
          '8112009988459000019133549599184472',
          '8112009988459000019133303184095717',
          '8112009988459000019133512137581366',
          '8112009988459000019133564530625101',
          '8112009988459000019133870122679640',
          '8112009988459000019133538076823548',
          '8112009988459000019133550935456933',
          '8112009988459000019133901129219977',
          '8112009988459000019133720438776348',
          '8112009988459000019133520137523950',
          '8112009988459000019133896910243738',
          '8112009988459000019133870258732708',
          '8112009988459000019133721195100106',
          '8112009988459000019133539131764212',
          '8112009988459000019133377262584729',
          '8112009988459000019133416654382106',
          '8112009988459000019133245581134181'
        ]
      };


    let output = await validate_basket(input, tcb_endpoint, access_key, secret_key, retailer_email_domain);
    console.log(JSON.stringify(output, null, 2));

    // Rollback the applied coupons
    let rollback_output = await rollback_coupons(output.basket_validation_output.applied_coupons.map(coupon => coupon.coupon_code), tcb_endpoint, "accelerator", access_key, secret_key);
    console.log(JSON.stringify(rollback_output, null, 2));

})();