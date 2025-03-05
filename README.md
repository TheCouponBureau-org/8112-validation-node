# 8112 Validation Functions

This document provides information on how to use the libraries defined in (AI) 8112 Validation Function for Point Of Sale.

## 📌 Functions

- [set_redis_client](#set_redis_client)
- [configure_api_client](#configure_api_client)
- [get_access_token](#get_access_token)
- [set_access_token](#set_access_token)
- [coupons_valid_for_basket](#coupons_valid_for_basket)
- [redeem_coupons](#redeem_coupons)
- [rollback_coupons](#rollback_coupons)
- [populate_local_database](#populate_local_database)
---

## Inject Redis Client

This is optional step. If you want to use local database for optimization, inject a `ioredis` client to the SDK library. You will have to configure the `ioredis` client with the correct host, port, and password and then inject it to the SDK library.

### **Function Signature:**

```js
set_redis_client(redis_client);
```

### **Example Usage:**

```js
const redis = require('ioredis');
const redisClient = new redis({ host: 'localhost', port: 6379, password: 'password' });
set_redis_client(redisClient);
```


## Configure API Client

This is required step. You will have to configure the API client with the correct endpoint, timeout, number of retries, and retry interval.

### **Function Signature:**

```js
configure_api_client(tcb_endpoint, http_timeout, no_of_retries, retry_interval);
```

### **Example Usage:**

10000 - 10 seconds timeout
3 - 3 retries
1000 - 1 second retry interval

```js
configure_api_client('https://api.try.thecouponbureau.org', 10000, 3, 1000);
```



## 🔑 Get Access Token

### **Function Signature:**

```js
get_access_token(access_key, secret_key);
```

The **access_key** and **secret_key** are the credentials of the TCB backend.

The function returns an **access token** which is used in other functions.

If the function fails, it will throw an exception.

### **Example Usage:**

```js
const access_token = get_access_token('access_key', 'secret_key');
```

Response:

```json
{
  "token": "ACCESS_TOKEN"
}
```

---


## 🔑 Set Access Token

### **Function Signature:**

This is required step to use the SDK. Once you get the access token, initialize the SDK with the access token before using other functions.

```js
set_access_token(access_key, access_token);
```
---



## 🛒 Get Coupons Valid for Basket (coupons_valid_for_basket)

### **Function Signature:**

```js
coupons_valid_for_basket(
  input,
  retailer_email_domain
);
```

### **Input Format:**

```json
{
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
      "quantity": 3,
      "unit": "item"
    }
  ],
  "coupons": [
    "8112009988459000019133983841900001", 
    "8112009988459000019133983841900002"
  ]
}
```

The **basket** contains the items a user has bought, and **coupons** include the **8112 coupons** scanned at the checkout counter. This can be a bundle ID, fetch code, single serialized data string, FSI coupon, or any combination.

**retailer_email_domain** is the email domain of the retailer. It must be provided to validate the coupons using accelerator API. If you are using retailer API, you can skip this parameter (pass `null`).

The function calculates the **discount**, makes necessary API calls to the **TCB backend**, and selects the optimal possible discount. It returns:

### **Output Format:**

```json
{
  "basket_validation_output": {
    "discount_in_cents": 200,
    "applied_coupons": [
      {
        "coupon_code": "8112009988459000019133983841900001",
        "face_value_in_cents": 100,
        "product_codes": {
          "gtins": [
            "5012345678900"
            "037000934677"
          ]
        }
      },
      {
        "coupon_code": "8112009988459000019133983841900002",
        "face_value_in_cents": 100,
        "product_codes": {
          "gtins": [
            "037000934677"
          ]
        }
      }
    ]
  },
  "execution_time_in_ms": 1000
}
```

### **Description:**

- **discount_in_cents** → Total discount applied.
- **applied_coupons** → List of applied coupons.
  - **face_value_in_cents** → Discount per coupon.
  - **product_codes** → Basket items used to calculate the discount.

#### **Example POS Receipt Representation:**

```
1 coupon applied.          - $1
```

The **discount_in_cents** value can be used to **reduce the total payable amount**.

---

## 🛒 Redeem Coupons (redeem_coupons)

This function is used to redeem coupons. Execute this function only after you have validated the coupons using [coupons_valid_for_basket](#coupons_valid_for_basket) function and applied the discount to the basket. As soon as you finish the transaction, execute this function to redeem the coupons in TCB backend.

### **Function Signature:**

```js
redeem_coupons(
  coupons,
  retailer_email_domain
);
```

**coupons** is the list of coupons to redeem.

**retailer_email_domain** is the email domain of the retailer. It must be provided to validate the coupons using accelerator API. If you are using retailer API, you can skip this parameter (pass `null`).

The function returns the list of **successfully redeemed coupons**.

### **Example Usage:**

```js
const redeemed_coupons = redeem_coupons(coupons, retailer_email_domain);
```

Response:

```json
{
  "redeemed_coupons": ["8112009988459000019133983841900001", "8112009988459000019133983841900002"],
  "execution_time_in_ms": 1000
}
```

---

## 🔄 Rollback Coupons

Use this function to rollback coupons. This function is used to rollback coupons if transaction fails.

### **Function Signature:**

```js
rollback_coupons(coupons, retailer_email_domain);
```

**coupons** is the list of coupons to rollback.

**retailer_email_domain** is the email domain of the retailer. It must be provided to validate the coupons using accelerator API. If you are using retailer API, you can skip this parameter (pass `null`).

The function returns the list of **successfully rolled back coupons**.

### **Example Usage:**

```js
const rolled_back_coupons = rollback_coupons(coupons, retailer_email_domain);
```

Response:

```json
{
  "rolled_back_coupons": ["8112009988459000019133983841900001", "8112009988459000019133983841900002"],
  "execution_time_in_ms": 1000
}
```

---


## 📦 Populate Local Database

This function is used to populate the local database with all the master offer files purchase requirements. This is useful if you are using local database for optimization. Sample code to populate the local database is given below. Change the dates appropriately to get the master offer files for the desired date range.

### **Function Signature:**

```js
populate_local_database(from_date, to_date);
```

### **Example Usage:**

```js
const dotenv = require('dotenv');
dotenv.config();

const ioredis = require('ioredis');
const { get_access_token, set_access_token, configure_api_client, set_redis_client, populate_local_database } = require("../index");

const tcb_endpoint = process.env.TBC_ENDPOINT;
const tcb_access_key = process.env.TBC_ACCESS_KEY;
const tcb_secret_key = process.env.TBC_SECRET_KEY;

const redisConnObj = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
};

const redisClient = new ioredis(redisConnObj);

(async() => {
    await configure_api_client(tcb_endpoint, 10000, 3, 1000);
    const token = await get_access_token(tcb_access_key, tcb_secret_key);;
    set_access_token(tcb_access_key, token);
    set_redis_client(redisClient);

    // Check if the database is synched once, if not, sync last 6 months data else last 2 days data
    const last_synced_date = await redisClient.get("LAST_SYNCED_DATE");
    if (!last_synced_date) {
        let six_months_ago = new Date();
        six_months_ago.setMonth(six_months_ago.getMonth() - 6);
        console.log("Syncing last 6 months data");
        await populate_local_database(six_months_ago.toISOString().split('T')[0], new Date().toISOString().split('T')[0]);
    } else {
        console.log("Syncing last 2 days data");
        let two_days_ago = new Date();
        two_days_ago.setDate(two_days_ago.getDate() - 2);   
        await populate_local_database(two_days_ago.toISOString().split('T')[0], new Date().toISOString().split('T')[0]);
    }

    await redisClient.set("LAST_SYNCED_DATE", new Date().toISOString().split('T')[0]);

    process.exit(0);
})();
```


---

## 📦 Express Server

This is a sample express server to demonstrate how to use the SDK. It is a simple server that validates the coupons and redeems them.

Create a new directory and initialize the project with the following commands:

```bash
npm init -y
```


### **Install Dependencies:**

```bash
npm install dotenv express ioredis pos-validation-sdk
```

### **Sample Code:**

```js
const dotenv = require('dotenv');
dotenv.config();

const express = require("express");
const ioredis = require('ioredis');
const { get_access_token, set_access_token, coupons_valid_for_basket, redeem_coupons, rollback_coupons, configure_api_client, set_redis_client } = require("pos-validation-sdk");
const app = express();

const tcb_endpoint = process.env.TBC_ENDPOINT;

app.use(express.json());

let redisConnObj = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
};

// const redisClient = null;
const redisClient = new ioredis(redisConnObj);

function return_error_response(res, error) {
    if (error.response) {
        delete error.response.data.execution_start_time;
        delete error.response.data.execution_time_in_ms;
        return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({ status: "error", message: error.message });
}

app.post("/get_access_token", async (req, res) => {
    try {
        const { access_key, secret_key } = req.body;
        await configure_api_client(tcb_endpoint, 10000, 3, 1000);
        const token = await get_access_token(access_key, secret_key);
        res.json({ token });
    } catch (error) {
        return return_error_response(res, error);
    }
});

app.post("/coupons_valid_for_basket", async (req, res) => {
    try {
        const start_time = performance.now();
        const input = req.body;
        const { retailer_email_domain, access_key, access_token, use_redis } = req.headers;
        await configure_api_client(tcb_endpoint, 10000, 3, 1000);
        set_access_token(access_key, access_token);
        if ( use_redis ) set_redis_client(redisClient);
        const basket_validation_output = await coupons_valid_for_basket(input, retailer_email_domain);
        const end_time = performance.now();
        res.json({ basket_validation_output, execution_time_in_ms: Math.round(end_time - start_time) });
    } catch (error) {
        return return_error_response(res, error);
    }
});

app.post("/redeem_coupons", async (req, res) => {
    try {
        const start_time = performance.now();
        const { coupons, retailer_email_domain } = req.body;
        const { access_key, access_token, use_redis } = req.headers;
        await configure_api_client(tcb_endpoint, 10000, 3, 1000);
        set_access_token(access_key, access_token);
        if ( use_redis ) set_redis_client(redisClient);
        const redeemed_coupons = await redeem_coupons(coupons, retailer_email_domain);
        const end_time = performance.now();
        res.json({ redeemed_coupons, execution_time_in_ms: Math.round(end_time - start_time) });
    } catch (error) {
        return return_error_response(res, error);
    }
});

app.post("/rollback_coupons", async (req, res) => {
    try {
        const start_time = performance.now();
        const { coupons, retailer_email_domain } = req.body;
        const { access_key, access_token } = req.headers;
        await configure_api_client(tcb_endpoint, 10000, 3, 1000);
        set_access_token(access_key, access_token);
        const rolled_back_coupons = await rollback_coupons(coupons, retailer_email_domain);
        const end_time = performance.now();
        res.json({ rolled_back_coupons, execution_time_in_ms: Math.round(end_time - start_time) });
    } catch (error) {
        return return_error_response(res, error);
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});

```

This code is secure and uses the `access_key` and `secret_key` to get the access token. Without a valid `access_key` and `secret_key`, the server will not validate the coupons.

### **Run the Server:**

```bash
node index.js
```

### **Test the Server:**

Get access token from the server.

```bash
curl -X POST 'http://SERVER_IP/get_access_token' \
-H 'Content-Type: application/json' \
--data '{ 
    "access_key": "ACCESS_KEY", 
    "secret_key": "SECRET_KEY" 
}'
```

Validate coupons for a basket.

```bash
curl -X POST 'http://SERVER_IP/coupons_valid_for_basket' \
-H 'Content-Type: application/json' \
-H 'use_redis: yes' \
-H 'access_key: ACCESS_KEY' \
-H 'access_token: ACCESS_TOKEN' \
--data '{
            "basket": [
              {
                "product_code": "037000930396",
                "price": 1.29,
                "quantity": 12,
                "unit": "item"
              },
              {
                "product_code": "7106919588011",
                "price": 1.81,
                "quantity": 13,
                "unit": "item"
              },
              {
                "product_code": "030772036433",
                "price": 5.44,
                "quantity": 2,
                "unit": "item"
              }
            ],
            "coupons": [
              "8112009988459000129133768829435944",
              "8112009988459000229133701244303366",
              "8112009988459000259133185516163434",
              "811200998845900014913380504049555",
              "8112009988459000239133444997582211"
            ]
          }'
```

Redeem coupons.

```bash
curl -X POST 'http://SERVER_IP/redeem_coupons' \
-H 'Content-Type: application/json' \
-H 'use_redis: yes' \
-H 'access_key: ACCESS_KEY' \
-H 'access_token: ACCESS_TOKEN' \
--data '{
            "coupons": [
              "8112009988459000129133768829435944",
              "8112009988459000229133701244303366",
              "8112009988459000259133185516163434",
              "811200998845900014913380504049555",
              "8112009988459000239133444997582211"
            ]
          }'
```

Rollback coupons.

```bash
curl -X POST 'http://SERVER_IP/rollback_coupons' \
-H 'Content-Type: application/json' \
-H 'access_key: ACCESS_KEY' \
-H 'access_token: ACCESS_TOKEN' \
--data '{
            "coupons": [
              "8112009988459000129133768829435944",
              "8112009988459000229133701244303366",
              "8112009988459000259133185516163434",
              "811200998845900014913380504049555",
              "8112009988459000239133444997582211"
            ]
          }'
```
---

## ✅ Conclusion

This document outlines how to use **8112 validation functions** for point-of-sale systems, including **get coupons valid for basket**, **redeem coupons** and **roll back coupons**. For further details, refer to **The Coupon Bureau (TCB) API Documentation**.

---

## 📄 License

This project follows **MIT License**.
