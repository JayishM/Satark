const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port=3000;

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
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,wind_speed_10m,wind_gusts_10m,visibility,surface_pressure` +
            `&timezone=auto`;
        const weatherResponse = await fetch(weatherURL);
        if (!weatherResponse.ok) {
            throw new Error("Weather API failed");
        }
        const weatherData = await weatherResponse.json();
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
                current: weatherData.current,
                units: weatherData.current_units
            }
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