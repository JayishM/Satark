const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port=3000;





// =========================================
// RAIN RISK
// Maximum: 25 points
// =========================================

function calculateRainRisk(daily, hourly) {

    let score = 0;

    const precipitationProbability =
        daily.precipitation_probability_max?.[0] ?? 0;

    const precipitation =
        daily.precipitation_sum?.[0] ?? 0;


    // Rain probability
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


    // Rainfall amount
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


    return Math.min(score, 25);
}


// =========================================
// WIND RISK
// Maximum: 15 points
// =========================================

function calculateWindRisk(daily) {

    const gust =
        daily.wind_gusts_10m_max?.[0] ?? 0;

    const wind =
        daily.wind_speed_10m_max?.[0] ?? 0;


    let score = 0;


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


    // Sustained wind
    if (wind >= 30) {
        score += 3;
    }
    else if (wind >= 20) {
        score += 2;
    }


    return Math.min(score, 15);
}


// =========================================
// VISIBILITY RISK
// Maximum: 15 points
// =========================================

function calculateVisibilityRisk(hourly) {

    const visibilityValues =
        hourly.visibility || [];


    if (visibilityValues.length === 0) {
        return 0;
    }


    // Next 24 hours
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


    return Math.min(score, 15);
}


// =========================================
// SNOW RISK
// Maximum: 15 points
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


    // Heavy hourly snowfall
    if (maxHourlySnow >= 5) {
        score += 3;
    }


    return Math.min(score, 15);
}


// =========================================
// TEMPERATURE RISK
// Maximum: 10 points
// =========================================

function calculateTemperatureRisk(daily) {

    const minTemperature =
        daily.temperature_2m_min?.[0] ?? 0;

    const maxTemperature =
        daily.temperature_2m_max?.[0] ?? 0;


    let score = 0;


    // Extreme cold
    if (minTemperature <= -10) {
        score += 6;
    }
    else if (minTemperature <= -5) {
        score += 5;
    }
    else if (minTemperature <= 0) {
        score += 3;
    }


    // Extreme heat
    if (maxTemperature >= 45) {
        score += 6;
    }
    else if (maxTemperature >= 40) {
        score += 5;
    }
    else if (maxTemperature >= 35) {
        score += 3;
    }


    return Math.min(score, 10);
}


// =========================================
// ALTITUDE RISK
// Maximum: 20 points
// =========================================

function calculateAltitudeRisk(elevation) {

    elevation =
        Number(elevation) || 0;


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
// MAIN SATARK RISK CALCULATOR
// =========================================

function calculateSatarkRisk(
    weatherData,
    elevation,
    disasterAlerts = []
) {

    const current =
        weatherData.current || {};

    const hourly =
        weatherData.hourly || {};

    const daily =
        weatherData.daily || {};


    // -----------------------------------------
    // Existing weather risks
    // -----------------------------------------

    const rainRisk =
        calculateRainRisk(
            daily,
            hourly
        );


    const windRisk =
        calculateWindRisk(
            daily
        );


    const visibilityRisk =
        calculateVisibilityRisk(
            hourly
        );


    const snowRisk =
        calculateSnowRisk(
            daily,
            hourly
        );


    const temperatureRisk =
        calculateTemperatureRisk(
            daily
        );


    const altitudeRisk =
        calculateAltitudeRisk(
            elevation
        );


    // -----------------------------------------
    // New disaster risk
    // -----------------------------------------

    const disasterRisk =
        calculateDisasterAlertRisk(
            disasterAlerts
        );


    // -----------------------------------------
    // New landslide indicator
    // -----------------------------------------

    const landslideRisk =
        calculateLandslideIndicator(
            daily,
            hourly,
            elevation,
            current
        );


    // -----------------------------------------
    // RAW SCORE
    //
    // Existing weather system = 100
    // Disaster alerts = 30
    // Landslide indicator = 20
    //
    // We use the first 20 points of the
    // landslide indicator in the overall score.
    // -----------------------------------------

    const rawScore =

        rainRisk +

        windRisk +

        visibilityRisk +

        snowRisk +

        temperatureRisk +

        altitudeRisk +

        disasterRisk.score +

        Math.min(
            landslideRisk.score,
            20
        );


    const maximumRawScore =
        150;


    // Convert to 0-100
    const totalScore =
        Math.round(
            (rawScore / maximumRawScore) * 100
        );


    const finalScore =
        Math.min(
            totalScore,
            100
        );


    // -----------------------------------------
    // Overall risk level
    // -----------------------------------------

    let overallLevel;


    if (finalScore >= 75) {

        overallLevel = "EXTREME";

    }

    else if (finalScore >= 55) {

        overallLevel = "HIGH";

    }

    else if (finalScore >= 30) {

        overallLevel = "MODERATE";

    }

    else {

        overallLevel = "LOW";

    }


    return {

        score: finalScore,

        level: overallLevel,


        // =====================================
        // WEATHER RISK FACTORS
        // =====================================

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

            },


            disaster_alerts: {

                score:
                    disasterRisk.score,

                max_score: 30,

                level:
                    disasterRisk.level,

                alert_count:
                    disasterRisk.alert_count

            },


            landslide_trigger: {

                score:
                    Math.min(
                        landslideRisk.score,
                        20
                    ),

                max_score: 20,

                level:
                    landslideRisk.level

            }

        },


        // =====================================
        // OFFICIAL ALERTS
        // =====================================

        official_alerts:
            disasterRisk.alerts,


        // =====================================
        // LANDSLIDE INDICATOR
        // =====================================

        landslide:
            landslideRisk,


        // =====================================
        // RAW WEATHER INDICATORS
        // =====================================

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





// =========================================
// NDMA SACHET DISASTER ALERT ENGINE
// =========================================

// Fetch active disaster alerts from NDMA SACHET
async function fetchSachetAlerts(latitude, longitude) {

    try {

        const url =
            "https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails";

        const response = await fetch(url);

        if (!response.ok) {

            throw new Error(
                `SACHET API failed: ${response.status}`
            );

        }

        const data = await response.json();

        if (!Array.isArray(data)) {

            return [];
        }


        // -----------------------------------------
        // Calculate distance between two coordinates
        // -----------------------------------------

        function distanceKm(lat1, lon1, lat2, lon2) {

            const R = 6371;

            const dLat =
                (lat2 - lat1) * Math.PI / 180;

            const dLon =
                (lon2 - lon1) * Math.PI / 180;

            const a =
                Math.sin(dLat / 2) *
                Math.sin(dLat / 2) +

                Math.cos(lat1 * Math.PI / 180) *
                Math.cos(lat2 * Math.PI / 180) *

                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);

            const c =
                2 * Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(1 - a)
                );

            return R * c;
        }


        // -----------------------------------------
        // Keep alerts geographically relevant
        // -----------------------------------------

        const relevantAlerts = [];


        for (const alert of data) {

            if (!alert.centroid) {
                continue;
            }


            const parts =
                String(alert.centroid).split(",");


            if (parts.length !== 2) {
                continue;
            }


            // SACHET centroid format:
            // longitude,latitude

            const alertLongitude =
                Number(parts[0]);

            const alertLatitude =
                Number(parts[1]);


            if (
                Number.isNaN(alertLatitude) ||
                Number.isNaN(alertLongitude)
            ) {
                continue;
            }


            const distance =
                distanceKm(
                    latitude,
                    longitude,
                    alertLatitude,
                    alertLongitude
                );


            // -----------------------------------------
            // Determine approximate alert radius
            //
            // area_covered is in square kilometres.
            // We approximate the area as a circle.
            // -----------------------------------------

            let alertRadiusKm = 50;

            if (alert.area_covered) {

                const area =
                    Number(alert.area_covered);

                if (!Number.isNaN(area) && area > 0) {

                    alertRadiusKm =
                        Math.sqrt(area / Math.PI);
                }
            }


            // Minimum safety radius
            alertRadiusKm =
                Math.max(alertRadiusKm, 25);


            // Maximum radius to prevent
            // extremely large regions from
            // affecting everything
            alertRadiusKm =
                Math.min(alertRadiusKm, 150);


            if (distance <= alertRadiusKm) {

                relevantAlerts.push({

                    identifier:
                        alert.identifier ?? null,

                    disaster_type:
                        alert.disaster_type ?? null,

                    severity:
                        alert.severity ?? null,

                    severity_level:
                        alert.severity_level ?? null,

                    severity_color:
                        alert.severity_color ?? null,

                    warning_message:
                        alert.warning_message ?? null,

                    area_description:
                        alert.area_description ?? null,

                    alert_source:
                        alert.alert_source ?? null,

                    effective_start_time:
                        alert.effective_start_time ?? null,

                    effective_end_time:
                        alert.effective_end_time ?? null,

                    distance_km:
                        Number(distance.toFixed(2)),

                    alert_radius_km:
                        Number(alertRadiusKm.toFixed(2))

                });

            }

        }


        return relevantAlerts;

    }

    catch (error) {

        console.error(
            "SACHET alert error:",
            error.message
        );

        // Do NOT break SATARK if
        // the government alert service
        // is temporarily unavailable.

        return [];

    }

}






// =========================================
// OFFICIAL DISASTER ALERT RISK
// Maximum raw score: 30
// =========================================

function calculateDisasterAlertRisk(alerts) {

    if (!alerts || alerts.length === 0) {

        return {

            score: 0,

            level: "NONE",

            alert_count: 0,

            alerts: []

        };

    }


    let score = 0;


    for (const alert of alerts) {

        const type =
            String(
                alert.disaster_type || ""
            ).toLowerCase();


        const severity =
            String(
                alert.severity || ""
            ).toUpperCase();


        const color =
            String(
                alert.severity_color || ""
            ).toLowerCase();


        // -----------------------------------------
        // Severity
        // -----------------------------------------

        if (
            severity === "WARNING" ||
            color === "red"
        ) {

            score += 15;

        }

        else if (
            severity === "ALERT" ||
            color === "orange"
        ) {

            score += 10;

        }

        else if (
            severity === "WATCH" ||
            color === "yellow"
        ) {

            score += 5;

        }

        else {

            score += 2;

        }


        // -----------------------------------------
        // Hazard-specific importance
        // -----------------------------------------

        if (
            type.includes("landslide") ||
            type.includes("avalanche") ||
            type.includes("flood") ||
            type.includes("flash flood") ||
            type.includes("cyclone") ||
            type.includes("tsunami")
        ) {

            score += 5;

        }

        else if (
            type.includes("thunderstorm") ||
            type.includes("lightning") ||
            type.includes("heavy rain") ||
            type.includes("heat wave") ||
            type.includes("cold wave")
        ) {

            score += 3;

        }

    }


    // Maximum contribution = 30

    score =
        Math.min(score, 30);


    let level = "LOW";


    if (score >= 25) {

        level = "EXTREME";

    }

    else if (score >= 15) {

        level = "HIGH";

    }

    else if (score >= 5) {

        level = "MODERATE";

    }


    return {

        score,

        level,

        alert_count: alerts.length,

        alerts

    };

}



// =========================================
// SATARK LANDSLIDE WEATHER INDICATOR
//
// This is NOT a GSI forecast.
// It is a weather + terrain trigger.
// =========================================

// =========================================
// SATARK LANDSLIDE WEATHER INDICATOR
//
// This is NOT a GSI forecast.
// It is a weather + terrain trigger.
// =========================================

function calculateLandslideIndicator(
    daily,
    hourly,
    elevation,
    current
) {

    let score = 0;


    const precipitationProbability =
        daily.precipitation_probability_max?.[0] ?? 0;


    const precipitation =
        daily.precipitation_sum?.[0] ?? 0;


    // =========================================
    // FIND CURRENT HOUR IN FORECAST
    // =========================================

    const hourlyTimes =
        hourly.time || [];

    const hourlyPrecipitation =
        hourly.precipitation || [];


    let currentIndex = 0;


    if (hourlyTimes.length > 0) {

        const now =
            new Date(
                current?.time ||
                new Date().toISOString()
            );


        const differences =
            hourlyTimes.map((time, index) => {

                const forecastTime =
                    new Date(time);

                return {
                    index,
                    difference:
                        Math.abs(
                            forecastTime.getTime() -
                            now.getTime()
                        )
                };

            });


        differences.sort(
            (a, b) =>
                a.difference -
                b.difference
        );


        currentIndex =
            differences[0]?.index ?? 0;

    }


    // =========================================
    // NEXT 24 HOURS
    // =========================================

    const next24Hours =
        hourlyPrecipitation.slice(
            currentIndex,
            currentIndex + 24
        );


    const next24Rain =
        next24Hours.reduce(
            (sum, value) =>
                sum + (Number(value) || 0),
            0
        );


    // =========================================
    // ELEVATION / TERRAIN EXPOSURE
    // =========================================

    if (elevation >= 2500) {

        score += 10;

    }

    else if (elevation >= 1500) {

        score += 6;

    }

    else if (elevation >= 1000) {

        score += 3;

    }


    // =========================================
    // FORECAST RAINFALL
    // =========================================

    if (next24Rain >= 50) {

        score += 30;

    }

    else if (next24Rain >= 30) {

        score += 24;

    }

    else if (next24Rain >= 20) {

        score += 18;

    }

    else if (next24Rain >= 10) {

        score += 10;

    }

    else if (next24Rain >= 5) {

        score += 5;

    }


    // =========================================
    // RAIN PROBABILITY
    // =========================================

    if (precipitationProbability >= 90) {

        score += 10;

    }

    else if (precipitationProbability >= 70) {

        score += 7;

    }

    else if (precipitationProbability >= 50) {

        score += 4;

    }


    // =========================================
    // TODAY'S PRECIPITATION
    // =========================================

    if (precipitation >= 20) {

        score += 15;

    }

    else if (precipitation >= 10) {

        score += 10;

    }

    else if (precipitation >= 5) {

        score += 5;

    }


    // =========================================
    // LIMIT
    // =========================================

    score =
        Math.min(score, 50);


    // =========================================
    // LEVEL
    // =========================================

    let level = "LOW";


    if (score >= 40) {

        level = "VERY HIGH";

    }

    else if (score >= 30) {

        level = "HIGH";

    }

    else if (score >= 15) {

        level = "MODERATE";

    }


    return {

        score,

        max_score: 50,

        level,

        is_official_gsi_forecast: false,

        note:
            "Weather and terrain based landslide trigger indicator. Not an official GSI landslide forecast.",

        indicators: {

            elevation_m:
                elevation,

            today_precipitation_mm:
                precipitation,

            precipitation_probability_percent:
                precipitationProbability,

            next_24h_precipitation_mm:
                Number(
                    next24Rain.toFixed(2)
                ),

            forecast_start_time:
                hourlyTimes[currentIndex] ?? null

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
        // STEP 4: FETCH OFFICIAL DISASTER ALERTS
        // =========================================
        const disasterAlerts =
            await fetchSachetAlerts(
                latitude,
                longitude
            );
       // =========================================
        // STEP 5: CALCULATE SATARK RISK
        // =========================================
        const risk =
            calculateSatarkRisk(
                weatherData,
                place.elevation,
                disasterAlerts
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