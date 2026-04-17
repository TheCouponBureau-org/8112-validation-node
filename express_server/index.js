const dotenv = require('dotenv');
dotenv.config();

const express = require("express");
const ioredis = require('ioredis');
const { get_access_token, set_access_token, coupons_valid_for_basket, redeem_coupons, rollback_coupons, configure_api_client, set_redis_client } = require("pos-validation-sdk");
const app = express();

const tcb_endpoint = process.env.TBC_ENDPOINT;

app.use(express.json({
    verify: (req, res, buf, encoding) => {
        req.rawBody = buf && buf.length ? buf.toString(encoding || "utf8") : "";
    }
}));

let redisConnObj = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
};

// const redisClient = null;
const redisClient = new ioredis(redisConnObj);

// GKE Ingress HTTP health checks hit GET / by default.
app.get("/", (req, res) => {
    res.status(200).json({ status: "ok", service: "pos-validation-sdk" });
});

app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok" });
});

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
        //const { retailer_email_domain, access_key, access_token, use_redis } = req.headers;
        // 🔥 FIXED HEADER EXTRACTION
        const retailer_email_domain = req.headers["x-retailer-domain"];
        const access_key = req.headers["x-api-key"];
        const access_token = req.headers["x-access-token"];
        const use_redis = req.headers["use_redis"];

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
        //const { access_key, access_token, use_redis } = req.headers;
        const access_key = req.headers["x-api-key"];
        const access_token = req.headers["x-access-token"];
        const use_redis = req.headers["use_redis"];

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
        //const { access_key, access_token } = req.headers;
        const access_key = req.headers["x-api-key"];
        const access_token = req.headers["x-access-token"];     

        await configure_api_client(tcb_endpoint, 10000, 3, 1000);
        set_access_token(access_key, access_token);
        const rolled_back_coupons = await rollback_coupons(coupons, retailer_email_domain);
        const end_time = performance.now();
        res.json({ rolled_back_coupons, execution_time_in_ms: Math.round(end_time - start_time) });
    } catch (error) {
        return return_error_response(res, error);
    }
});

// Handle malformed JSON payloads with a clean 400 response and server-side diagnostics.
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        const rawBody = typeof req.rawBody === "string" ? req.rawBody : "";
        const rawBodyPreview = rawBody.length > 2000 ? `${rawBody.slice(0, 2000)}...[truncated]` : rawBody;
        console.error("[INVALID_JSON_PAYLOAD]", {
            method: req.method,
            path: req.originalUrl,
            content_type: req.headers["content-type"],
            error: err.message,
            raw_body: rawBodyPreview
        });
        return res.status(400).json({
            status: "error",
            message: "Invalid JSON payload",
            details: err.message
        });
    }
    return next(err);
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
