# 8112 Validation Functions

This document provides information on how to use the libraries defined in (AI) 8112 Validation Function for Point Of Sale.

## 📌 Functions

- [validate_basket](#validate_basket)
- [rollback_coupons](#rollback_coupons)

---

## 🛒 Validate Basket

### **Function Signature:**
```js
validate_basket(input, tcb_endpoint, access_key, secret_key)
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
    "8112009988459000019133983841909890",
    "8112009988459000019133512853382124"
  ]
}
```

The **basket** contains the items a user has bought, and **coupons** include the **8112 coupons** scanned at the checkout counter. This can be a bundle ID, fetch code, single serialized data string, FSI coupon, or any combination.

The function calculates the **discount**, makes necessary API calls to the **TCB backend**, and selects the best possible discount. It returns:

### **Output Format:**
```json
{
  "discount_in_cents": 100,
  "applied_coupons": [
    {
      "coupon_code": "8112009988459000019133492376609383",
      "face_value_in_cents": 100,
      "product_codes": {
        "gtins": [
          "037000930396",
          "037000930396"
        ]
      }
    }
  ]
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

## 🔄 Rollback Coupons

### **Function Signature:**
```js
rollback_coupons(coupons, tcb_endpoint, mode, access_key, secret_key)
```

### **Example Usage:**
```js
const coupons = ["...", "..."]; // List of applied coupons (coupon_code from validate_basket function)
const tcb_endpoint = "https://api.try.thecouponbureau.org";
const access_key = "GET IT FROM TCB ENTERPRISE SETTINGS";
const secret_key = "GET IT FROM TCB ENTERPRISE SETTINGS";
```

The function **rolls back** applied coupons and returns the list of **reversed coupons**.

---

## 📂 Sample Code

### **1️⃣ Setup the Project**
Create a new folder:
```sh
mkdir test-pos-validation-sdk
cd test-pos-validation-sdk
```

Initialize the project:
```sh
npm init -y
```

Install the package:
```sh
npm install pos-validation-sdk
```

### **2️⃣ Configure `package.json`**
Add the following to `package.json`:
```json
"type": "module"
```

### **3️⃣ Create `index.js`**
Create the file:
```sh
touch index.js
```

Add the following code:
```js
import possdk from 'pos-validation-sdk';

(async () => {
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
              "quantity": 3,
              "unit": "item"
          }
        ],
        "coupons": [
            "8112009988459000019133983841909890",
            "8112009988459000019133512853382124"
        ]
    };

    let output = await possdk.validate_basket(
        input,
        "https://api.try.thecouponbureau.org",
        "18ac58d9ec97ad536f1715782830cdb3",
        "f20742cd9ba56ee8271f81b718df7844"
    );

    console.log(JSON.stringify(output, null, 2));

})();
```

### **4️⃣ Run the Code**
```sh
node index.js
```

---

## ✅ Conclusion
This document outlines how to use **8112 validation functions** for point-of-sale systems, including **validating baskets** and **rolling back coupons**. For further details, refer to **The Coupon Bureau (TCB) API Documentation**.

---

## 📄 License
This project follows **MIT License**.

