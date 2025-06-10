
# 🚀 POS Validation SDK Express Server Using Docker

This project provides a server to interact with the POS Validation SDK for validating, redeeming, and rolling back coupons. It includes Docker support for containerizing the application and Redis setup using Docker Compose.

## ✨ Features

✅ Validate coupons for a basket.  
✅ Redeem coupons.  
✅ Rollback redeemed coupons.  
✅ Get access token via API.  
✅ Redis caching support.  
✅ Docker and Docker Compose for easy deployment.

---

## ⚙️ Prerequisites

Make sure you have the following installed:
- Node.js (v18+ recommended)
- Docker & Docker Compose
- curl for API testing (optional)

---

## 📦 Step 1: Create a Dockerfile (If Not Already Present)

Inside `express_server` directory (where `index.js` is located), create a file named `Dockerfile`:

```bash
touch Dockerfile
```

Add the following content to the Dockerfile:

```Dockerfile
# Use Node.js 18 as the base image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the application files to the container
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "index.js"]
```

---

## ⚙️ Step 2: Create a .dockerignore File (If Not Already Present)

Create a `.dockerignore` file to exclude unnecessary files:

```bash
touch .dockerignore
```

Add the following content:

```
node_modules
npm-debug.log
.DS_Store
.env
```

---

## 📝 Step 3: Create docker-compose.yml (Optional, Recommended for Redis) (If Not Already Present)

If you also want to run Redis along with your Node.js app, create a `docker-compose.yml` file:

```bash
touch docker-compose.yml
```

Add the following content:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - TBC_ENDPOINT=https://api.try.thecouponbureau.org
    depends_on:
      - redis
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules

  redis:
    image: "redis:6.2"
    ports:
      - "6379:6379"
```

---

## 📚 Step 4: Add package.json (If Not Already Present)

Ensure your `package.json` has the required dependencies:

```json
{
  "name": "pos-validation-sdk",
  "version": "1.0.0",
  "description": "POS Validation SDK Server",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "ioredis": "^5.5.0",
    "pos-validation-sdk": "^1.2.2"
  }
}
```

---

## 📝 Step 5: Set Up .env File (If Not Already Present)

Create a `.env` file:

```bash
touch .env
```

Add the following environment variables:

```
PORT=3000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
TBC_ENDPOINT=https://api.try.thecouponbureau.org
```

---

## 🐳 Step 6: Build and Run Docker Container

### 🚀 To Build the Docker Image

```bash
# Build the Docker image
docker build -t pos-validation-sdk .
```

### 📡 To Run the Docker Container

```bash
# Run the container
docker run -p 3000:3000 --env-file .env pos-validation-sdk
```

### 📦 To Run with Docker Compose (if using Redis)

```bash
# Run with docker-compose
docker-compose up --build
```

---

## 🔎 Step 7: Test the Application

After running the container, your app should be available at:

```
http://localhost:3000
```

---

## 📝 API Endpoints

### 1. Get Access Token

```bash
curl -X POST http://localhost:3000/get_access_token -H "Content-Type: application/json" -d '{
  "access_key": "<your_access_key>",
  "secret_key": "<your_secret_key>"
}'
```

### 2. Coupons Valid for Basket

```bash
curl -X POST http://localhost:3000/coupons_valid_for_basket -H "Content-Type: application/json" -H "retailer_email_domain: <your_retailer_email>" -H "access_key: <your_access_key>" -H "access_token: <your_access_token>" -H "use_redis: true" -d '{
  "basket": [
    {
      "product_code": "037000930396",
      "price": 1.29,
      "quantity": 1,
      "unit": "item"
    },
    {
      "product_code": "037000934677",
      "price": 1.34,
      "quantity": 1,
      "unit": "item"
    }
  ],
  "coupons": [
    "8112009988459000019133294756263722"
  ]
}'
```

### 3. Redeem Coupons

```bash
curl -X POST http://localhost:3000/redeem_coupons -H "Content-Type: application/json" -H "retailer_email_domain: <your_retailer_email>" -H "access_key: <your_access_key>" -H "access_token: <your_access_token>" -H "use_redis: true" -d '{
  "coupons": [
    "8112009988459000019133294756263722"
  ],
  "retailer_email_domain": "<your_retailer_email>"
}'
```

### 4. Rollback Coupons

```bash
curl -X POST http://localhost:3000/rollback_coupons -H "Content-Type: application/json" -H "access_key: <your_access_key>" -H "access_token: <your_access_token>" -d '{
  "coupons": [
    "8112009988459000019133294756263722"
  ],
  "retailer_email_domain": "<your_retailer_email>"
}'
```

---

## 🛑 Troubleshooting

1. Check logs if something fails:

```bash
docker logs <container_id>
```

2. Check if Redis is running:

```bash
docker-compose ps
```

3. Restart the containers:

```bash
docker-compose down
docker-compose up --build
```

---

## 📄 License

This project is licensed under the ISC License.
