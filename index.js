// index.js

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Connect to Redis ---
let redisClient;
(async () => {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL
  });
  redisClient.on('error', (error) => console.error(`Redis Error: ${error}`));
  await redisClient.connect();
  console.log('Connected to Redis successfully.');
})();


// --- The Core API Logic ---
async function fetchWeather(req, res) {
  const { city } = req.params;
  const cacheKey = `weather:${city}`;
  const CACHE_EXPIRATION_SECONDS = 43200; // 12 hours

  try {
    // 1. Check Redis Cache First
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log('Cache HIT');
      return res.json(JSON.parse(cachedData));
    }

    console.log('Cache MISS');
    // 3. If not in cache, request from 3rd Party API
    const apiResponse = await axios.get(
      `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${city}?unitGroup=metric&key=${process.env.WEATHER_API_KEY}&contentType=json`
    );
    
    // 4. Get the API response data
    const weatherData = apiResponse.data;

    // 5. Save the results to the cache with an expiration
    await redisClient.setEx(
        cacheKey, 
        CACHE_EXPIRATION_SECONDS, 
        JSON.stringify(weatherData)
    );

    // Return the response to the client
    return res.json(weatherData);

  } catch (error) {
    console.error(error);
    // Handle errors properly
    if (error.response && error.response.status === 400) {
        return res.status(404).json({ message: 'City not found.' });
    }
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

app.get('/weather/:city', fetchWeather);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});