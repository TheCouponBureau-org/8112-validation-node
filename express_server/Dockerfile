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
