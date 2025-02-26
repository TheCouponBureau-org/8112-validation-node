const INPUT_SCHEMA = {
    type: "object",
    properties: {
        basket: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                properties: {
                    product_code: { type: "string", minLength: 1 },
                    price: { type: "number", minimum: 0 },
                    quantity: { type: "integer", minimum: 1 },
                    unit: { type: "string", minLength: 1 },
                    product_type: { type: "string", minLength: 1 },
                },
                required: ["product_code", "price", "quantity", "unit"],
                additionalProperties: false
            }
        },
        coupons: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 }
        }
    },
    required: ["basket", "coupons"],
    additionalProperties: false
};

module.exports = {
    INPUT_SCHEMA
}