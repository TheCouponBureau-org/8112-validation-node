# 8112 Validation Functions

This document provides information on how to use the libraries defined in (AI) 8112 Validation Function for Point Of Sale.

## 📌 Functions

- [access_token](#access_token)
- [coupons_valid_for_basket](#coupons_valid_for_basket)
- [redeem_coupons](#redeem_coupons)
- [rollback_coupons](#rollback_coupons)

---

## 🔑 Access Token

### **Function Signature:**

```js
access_token(tcb_endpoint, access_key, secret_key);
```

The **tcb_endpoint** is the endpoint of the TCB backend. The **access_key** and **secret_key** are the credentials of the TCB backend.

The function returns an **access token** which is used in other functions.

If the function fails, it will throw an exception.

---

## 🛒 Get Coupons Valid for Basket (coupons_valid_for_basket)

### **Function Signature:**

```js
coupons_valid_for_basket(
  input,
  tcb_endpoint,
  access_key,
  access_token,
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

The **tcb_endpoint** is the endpoint of the TCB backend. Get **access_token** from [access_token](#access_token) function.

**retailer_email_domain** is the email domain of the retailer. It must be provided to validate the coupons using accelerator API. If you are using retailer API, you can skip this parameter (pass `null`).

The function calculates the **discount**, makes necessary API calls to the **TCB backend**, and selects the optimal possible discount. It returns:

### **Output Format:**

```json
{
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

### **Function Signature:**

```js
redeem_coupons(
  coupons,
  tcb_endpoint,
  access_key,
  access_token,
  retailer_email_domain
);
```

**coupons** is the list of coupons to redeem.

The **tcb_endpoint** is the endpoint of the TCB backend. Get **access_token** from [access_token](#access_token) function.

**retailer_email_domain** is the email domain of the retailer. It must be provided to validate the coupons using accelerator API. If you are using retailer API, you can skip this parameter (pass `null`).

The function returns the list of **successfully redeemed coupons**.

---

## 🔄 Rollback Coupons

### **Function Signature:**

```js
rollback_coupons(coupons, tcb_endpoint, mode, access_key, access_token);
```

**coupons** is the list of coupons to rollback.

The **tcb_endpoint** is the endpoint of the TCB backend. Get **access_token** from [access_token](#access_token) function.

use **mode** as `"accelerator"` to rollback coupons via accelerator API. Else use **mode** as `"retailer"`.

### **Example Usage:**

The function returns the list of **successfully rolled back coupons**.

---

## ✅ Conclusion

This document outlines how to use **8112 validation functions** for point-of-sale systems, including **get coupons valid for basket**, **redeem coupons** and **roll back coupons**. For further details, refer to **The Coupon Bureau (TCB) API Documentation**.

---

## 📄 License

This project follows **MIT License**.
