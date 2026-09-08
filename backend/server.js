const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port=3000;







// =========================================
// SATARK RISK ENGINE
// =========================================

// Keep value between 0 and 100
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}


// =========================================
// RAIN RISK
// Maximum 25 points
// =========================================

function calculateRainRisk(daily, hourly) {

    let score = 0;

    // Today's precipitation probability
    const precipitationProbability =
        daily.precipitation_probability_max?.[0] ?? 0;

    // Today's expected precipitation
    const precipitation =
        daily.precipitation_sum?.[0] ?? 0;


    // Probability contribution
    if (precipitationProbability >= 90) {
        score += 15;
    }
    else if (precipitationProbability >= 70) {
        score += 12;
    }
    else if (precipitationProbability >= 50) {
        score += 9;
    }
    else if (precipitationProbability >= 30) {
        score += 5;
    }
    else if (precipitationProbability >= 10) {
        score += 2;
    }


    // Rainfall amount contribution
    if (precipitation >= 20) {
        score += 10;
    }
    else if (precipitation >= 10) {
        score += 8;
    }
    else if (precipitation >= 5) {
        score += 5;
    }
    else if (precipitation >= 2) {
        score += 3;
    }
    else if (precipitation > 0) {
        score += 1;
    }


    return clamp(score, 0, 25);
}


// =========================================
// WIND RISK
// Maximum 15 points
// =========================================

function calculateWindRisk(daily) {

    const gust =
        daily.wind_gusts_10m_max?.[0] ?? 0;

    const wind =
        daily.wind_speed_10m_max?.[0] ?? 0;


    let score = 0;


    // Gusts are more important for travel safety
    if (gust >= 60) {
        score = 15;
    }
    else if (gust >= 50) {
        score = 12;
    }
    else if (gust >= 40) {
        score = 9;
    }
    else if (gust >= 30) {
        score = 6;
    }
    else if (gust >= 20) {
        score = 3;
    }


    // Slight additional consideration for sustained wind
    if (wind >= 30) {
        score += 3;
    }
    else if (wind >= 20) {
        score += 2;
    }


    return clamp(score, 0, 15);
}


// =========================================
// VISIBILITY RISK
// Maximum 15 points
// =========================================

function calculateVisibilityRisk(hourly) {

    const visibilityValues =
        hourly.visibility || [];


    if (visibilityValues.length === 0) {
        return 0;
    }


    // Look at the next 24 hours
    const next24Hours =
        visibilityValues.slice(0, 24);


    const minimumVisibility =
        Math.min(...next24Hours);


    let score = 0;


    if (minimumVisibility < 500) {
        score = 15;
    }
    else if (minimumVisibility < 1000) {
        score = 12;
    }
    else if (minimumVisibility < 2000) {
        score = 9;
    }
    else if (minimumVisibility < 5000) {
        score = 5;
    }
    else if (minimumVisibility < 10000) {
        score = 2;
    }


    return clamp(score, 0, 15);
}


// =========================================
// SNOW RISK
// Maximum 15 points
// =========================================

function calculateSnowRisk(daily, hourly) {

    const snowfall =
        daily.snowfall_sum?.[0] ?? 0;


    const hourlySnowfall =
        hourly.snowfall || [];


    const next24Hours =
        hourlySnowfall.slice(0, 24);


    const maxHourlySnow =
        next24Hours.length > 0
            ? Math.max(...next24Hours)
            : 0;


    let score = 0;


    if (snowfall >= 20) {
        score += 12;
    }
    else if (snowfall >= 10) {
        score += 9;
    }
    else if (snowfall >= 5) {
        score += 6;
    }
    else if (snowfall > 0) {
        score += 3;
    }


    // Heavy snowfall in a single hour
    if (maxHourlySnow >= 5) {
        score += 3;
    }


    return clamp(score, 0, 15);
}


// =========================================
// TEMPERATURE RISK
// Maximum 10 points
// =========================================

function calculateTemperatureRisk(daily) {

    const minTemperature =
        daily.temperature_2m_min?.[0] ?? 0;

    const maxTemperature =
        daily.temperature_2m_max?.[0] ?? 0;


    let score = 0;


    // Very low temperature
    if (minTemperature <= -10) {
        score += 6;
    }
    else if (minTemperature <= -5) {
        score += 5;
    }
    else if (minTemperature <= 0) {
        score += 3;
    }


    // Very high temperature
    if (maxTemperature >= 45) {
        score += 6;
    }
    else if (maxTemperature >= 40) {
        score += 5;
    }
    else if (maxTemperature >= 35) {
        score += 3;
    }


    return clamp(score, 0, 10);
}


// =========================================
// ALTITUDE EXPOSURE
// Maximum 20 points
// =========================================

function calculateAltitudeRisk(elevation) {

    elevation = Number(elevation) || 0;


    if (elevation >= 5000) {
        return 20;
    }

    if (elevation >= 4000) {
        return 17;
    }

    if (elevation >= 3000) {
        return 14;
    }

    if (elevation >= 2500) {
        return 10;
    }

    if (elevation >= 1500) {
        return 5;
    }

    return 0;
}


// =========================================
// RISK LEVEL
// =========================================

function getRiskLevel(score) {

    if (score >= 75) {
        return "EXTREME";
    }

    if (score >= 55) {
        return "HIGH";
    }

    if (score >= 30) {
        return "MODERATE";
    }

    return "LOW";
}


// =========================================
// MAIN SATARK RISK CALCULATOR
// =========================================

function calculateSatarkRisk(weatherData, elevation) {

    const current =
        weatherData.current || {};

    const hourly =
        weatherData.hourly || {};

    const daily =
        weatherData.daily || {};


    const rainRisk =
        calculateRainRisk(daily, hourly);

    const windRisk =
        calculateWindRisk(daily);

    const visibilityRisk =
        calculateVisibilityRisk(hourly);

    const snowRisk =
        calculateSnowRisk(daily, hourly);

    const temperatureRisk =
        calculateTemperatureRisk(daily);

    const altitudeRisk =
        calculateAltitudeRisk(elevation);


    const totalScore =
        rainRisk +
        windRisk +
        visibilityRisk +
        snowRisk +
        temperatureRisk +
        altitudeRisk;


    return {

        score: totalScore,

        level: getRiskLevel(totalScore),

        factors: {

            rain: {
                score: rainRisk,
                max_score: 25
            },

            wind: {
                score: windRisk,
                max_score: 15
            },

            visibility: {
                score: visibilityRisk,
                max_score: 15
            },

            snow: {
                score: snowRisk,
                max_score: 15
            },

            temperature: {
                score: temperatureRisk,
                max_score: 10
            },

            altitude: {
                score: altitudeRisk,
                max_score: 20
            }

        },

        raw_indicators: {

            current_temperature_c:
                current.temperature_2m ?? null,

            current_apparent_temperature_c:
                current.apparent_temperature ?? null,

            current_humidity_percent:
                current.relative_humidity_2m ?? null,

            current_wind_kmh:
                current.wind_speed_10m ?? null,

            current_wind_gust_kmh:
                current.wind_gusts_10m ?? null,

            current_visibility_m:
                current.visibility ?? null,

            elevation_m:
                elevation

        }

    };

}







app.get("/api/health",(req,res)=>{
    res.json({
        Status:"OK",
        service:"Satark Backend"
    });
});
app.get("/api/location",async(req,res)=>{
    try{
        const {name} = req.query;
        if(!name){
            return res.status(400).json({error:"Missing 'name' query parameter"});
        }
        const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
        const response=await fetch(url);
        if(!response.ok){
            throw new Error(`Error fetching location data: ${response.statusText}`);
        }
        const data=await response.json();
        if(!data.results || data.results.length === 0){
            return res.status(404).json({error:"Location not found"});
        }
        const location=data.results[0];
        res.json({
            name: location.name,
            country: location.country,
            latitude: location.latitude,
            longitude: location.longitude,
            elevation: location.elevation,
            timezone: location.timezone
        });
    }catch(error){
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch location data"
        });
    }
});
app.get("/api/weather",async(req,res)=>{
    try{
        const {latitude,longitude} = req.query;
        if(!latitude || !longitude){
            return res.status(400).json({error:"Missing 'latitude' or 'longitude' query parameters"});
        }
        const url=
            `https://api.open-meteo.com/v1/forecast`+
            `?latitude=${latitude}`+
            `&longitude=${longitude}`+
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,wind_speed_10m,wind_gusts_10m,visibility,surface_pressure`+
            `&timezone=auto`;
        const response=await fetch(url);
        if(!response.ok){
            throw new Error("Open-Meteo Weather API failed");
        }
        const data=await response.json();
        res.json(data);
    }catch(error){
        console.error(error);
        res.status(500).json({
            error: "Failed to fetch weather data"
        });
    }
});
app.get("/api/analyze",async(req,res)=>{
    try{
        const{location}=req.query;
        if (!location) {
            return res.status(400).json({
                error: "Location is required"
            });
        }
        const geoURL =
            `https://geocoding-api.open-meteo.com/v1/search` +
            `?name=${encodeURIComponent(location)}` +
            `&count=1` +
            `&language=en` +
            `&format=json`;
        const geoResponse = await fetch(geoURL);
        if (!geoResponse.ok) {
            throw new Error("Geocoding API failed");
        }
        const geoData = await geoResponse.json();
        if (!geoData.results || geoData.results.length === 0) {
            return res.status(404).json({
                error: "Location not found"
            });
        }
        const place = geoData.results[0];
        const latitude = place.latitude;
        const longitude = place.longitude;
        const weatherURL =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${latitude}` +
            `&longitude=${longitude}` +
            // =========================================
            // CURRENT WEATHER
            // =========================================
            `&current=` +
            `temperature_2m,` +
            `relative_humidity_2m,` +
            `apparent_temperature,` +
            `precipitation,` +
            `rain,` +
            `showers,` +
            `snowfall,` +
            `weather_code,` +
            `cloud_cover,` +
            `wind_speed_10m,` +
            `wind_direction_10m,` +
            `wind_gusts_10m,` +
            `visibility,` +
            `surface_pressure,` +
            `pressure_msl,` +
            `uv_index` +
            // =========================================
            // HOURLY FORECAST
            // =========================================
            `&hourly=` +
            `temperature_2m,` +
            `relative_humidity_2m,` +
            `apparent_temperature,` +
            `precipitation_probability,` +
            `precipitation,` +
            `rain,` +
            `showers,` +
            `snowfall,` +
            `snow_depth,` +
            `weather_code,` +
            `cloud_cover,` +
            `visibility,` +
            `wind_speed_10m,` +
            `wind_direction_10m,` +
            `wind_gusts_10m,` +
            `surface_pressure,` +
            `pressure_msl,` +
            `uv_index` +
            // =========================================
            // DAILY FORECAST
            // =========================================
            `&daily=` +
            `weather_code,` +
            `temperature_2m_max,` +
            `temperature_2m_min,` +
            `apparent_temperature_max,` +
            `apparent_temperature_min,` +
            `sunrise,` +
            `sunset,` +
            `daylight_duration,` +
            `sunshine_duration,` +
            `precipitation_sum,` +
            `rain_sum,` +
            `showers_sum,` +
            `snowfall_sum,` +
            `precipitation_probability_max,` +
            `wind_speed_10m_max,` +
            `wind_gusts_10m_max,` +
            `wind_direction_10m_dominant,` +
            `shortwave_radiation_sum,` +
            `uv_index_max` +
            `&timezone=auto`;
        const weatherResponse = await fetch(weatherURL);
        if (!weatherResponse.ok) {
            throw new Error("Weather API failed");
        }
        const weatherData = await weatherResponse.json();
        // =========================================
// STEP 4: CALCULATE SATARK RISK
// =========================================

const risk = calculateSatarkRisk(
    weatherData,
    place.elevation
);
        res.json({
            location: {
                name: place.name,
                country: place.country,
                latitude: latitude,
                longitude: longitude,
                elevation: place.elevation,
                timezone: place.timezone
            },

            weather: {

                // Current conditions
                current: weatherData.current,

                // Units for current conditions
                current_units: weatherData.current_units,

                // Hour-by-hour forecast
                hourly: weatherData.hourly,

                // Units for hourly forecast
                hourly_units: weatherData.hourly_units,

                // Daily forecast
                daily: weatherData.daily,

                // Units for daily forecast
                daily_units: weatherData.daily_units
                },
            risk: risk
        });
    }
    catch (error) {
        console.error("SATARK analysis error:", error);
        res.status(500).json({
            error: "Failed to analyze location"
        });
    }
});
app.listen(port, () => {
    console.log(`SATARK backend running on http://localhost:${port}`);
});