const express = require('express');
const cors = require('cors');
const {generateRiskExplanation} = require("./geminiService");

const app = express();
app.use(cors());
app.use(express.json());

const port=3000;





// =========================================
// DETERMINISTIC RISK SUMMARY
// =========================================

function generateRiskSummary(
    finalScore,
    overallLevel,
    factors,
    disasterAlerts,
    landslideRisk,
    rawIndicators
) {

    const mainConcerns = [];
    const positiveConditions = [];
    const recommendations = [];
    const riskFactors = [];


    // =========================================
    // HELPER: ADD RISK FACTOR
    // =========================================

    function addRiskFactor(
        name,
        score,
        maxScore,
        reason
    ) {

        if (score > 0) {

            riskFactors.push({

                factor: name,

                score: score,

                max_score: maxScore,

                reason: reason

            });

        }

    }


    // =========================================
    // ALTITUDE
    // =========================================

    if (factors.altitude.score >= 10) {

        mainConcerns.push(
            `High-altitude destination at ${rawIndicators.elevation_m} m`
        );

        addRiskFactor(
            "Altitude",
            factors.altitude.score,
            20,
            `Destination is located at ${rawIndicators.elevation_m} m elevation.`
        );

    }


    // =========================================
    // RAIN
    // =========================================

    if (factors.rain.score >= 8) {

        mainConcerns.push(
            "Rainfall conditions may reduce travel safety"
        );

        addRiskFactor(
            "Rainfall",
            factors.rain.score,
            25,
            "Forecast rainfall and precipitation probability are contributing to the risk."
        );

    }


    // =========================================
    // WIND
    // =========================================

    if (factors.wind.score >= 6) {

        mainConcerns.push(
            "Elevated wind conditions are possible"
        );

        addRiskFactor(
            "Wind",
            factors.wind.score,
            15,
            "Forecast wind speeds or gusts are contributing to travel risk."
        );

    }


    // =========================================
    // VISIBILITY
    // =========================================

    if (factors.visibility.score >= 9) {

        mainConcerns.push(
            "Visibility may fall below safe travel levels during some forecast hours"
        );

        addRiskFactor(
            "Visibility",
            factors.visibility.score,
            15,
            "Multiple forecast hours show significantly reduced visibility."
        );

    }
    else if (factors.visibility.score >= 5) {

        mainConcerns.push(
            "Reduced visibility is possible during the forecast period"
        );

        addRiskFactor(
            "Visibility",
            factors.visibility.score,
            15,
            "Some forecast periods may have reduced visibility."
        );

    }


    // =========================================
    // SNOW
    // =========================================

    if (factors.snow.score >= 6) {

        mainConcerns.push(
            "Snowfall may affect travel conditions"
        );

        addRiskFactor(
            "Snowfall",
            factors.snow.score,
            15,
            "Forecast snowfall may affect routes and travel conditions."
        );

    }


    // =========================================
    // TEMPERATURE
    // =========================================

    if (factors.temperature.score >= 3) {

        mainConcerns.push(
            "Temperature conditions may affect traveller safety"
        );

        addRiskFactor(
            "Temperature",
            factors.temperature.score,
            10,
            "Forecast temperatures are contributing to the calculated risk."
        );

    }


    // =========================================
    // OFFICIAL DISASTER ALERTS
    // =========================================

    if (factors.disaster_alerts.score > 0) {

        let alertReason =
            "An active official disaster alert is contributing to the risk.";

        if (disasterAlerts.length > 0) {

            const alertTypes =
                disasterAlerts
                    .map(alert => alert.disaster_type)
                    .filter(Boolean);

            if (alertTypes.length > 0) {

                alertReason =
                    `Active official alert: ${alertTypes.join(", ")}.`;

            }

        }

        mainConcerns.push(
            `Official disaster alert${disasterAlerts.length > 1 ? "s" : ""} currently active`
        );

        addRiskFactor(
            "Official alerts",
            factors.disaster_alerts.score,
            30,
            alertReason
        );

    }


    // =========================================
    // LANDSLIDE
    // =========================================

    if (landslideRisk.score >= 15) {

        mainConcerns.push(
            "Elevated landslide-trigger conditions detected"
        );

        addRiskFactor(
            "Landslide trigger",
            Math.min(landslideRisk.score, 20),
            20,
            "Weather and terrain conditions are contributing to the landslide trigger indicator."
        );

    }


    // =========================================
    // POSITIVE CONDITIONS
    // =========================================

    if (factors.rain.score <= 5) {

        positiveConditions.push(
            "Rainfall risk is currently limited"
        );

    }

    if (factors.wind.score <= 3) {

        positiveConditions.push(
            "Wind conditions are relatively calm"
        );

    }

    if (factors.visibility.score <= 2) {

        positiveConditions.push(
            "Visibility conditions are currently good"
        );

    }

    if (factors.snow.score === 0) {

        positiveConditions.push(
            "No significant snowfall risk detected"
        );

    }

    if (factors.temperature.score === 0) {

        positiveConditions.push(
            "No significant temperature-related risk detected"
        );

    }

    if (factors.disaster_alerts.score === 0) {

        positiveConditions.push(
            "No active official disaster alerts detected"
        );

    }

    if (landslideRisk.score < 15) {

        positiveConditions.push(
            "Landslide trigger indicator is currently low"
        );

    }


    // =========================================
    // SORT RISK FACTORS
    // =========================================

    riskFactors.sort(
        (a, b) => {

            const percentageA =
                a.score / a.max_score;

            const percentageB =
                b.score / b.max_score;

            return percentageB - percentageA;

        }
    );


    // =========================================
    // SEVERITY REASON
    // =========================================

    let severityReason;

    if (riskFactors.length === 0) {

        severityReason =
            "No significant risk factors are currently contributing to the calculated risk.";

    }
    else {

        const topFactors =
            riskFactors
                .slice(0, 3)
                .map(factor => factor.factor);

        if (topFactors.length === 1) {

            severityReason =
                `The current ${overallLevel.toLowerCase()} risk is primarily driven by ${topFactors[0].toLowerCase()}.`;

        }
        else if (topFactors.length === 2) {

            severityReason =
                `The current ${overallLevel.toLowerCase()} risk is mainly driven by ${topFactors[0].toLowerCase()} and ${topFactors[1].toLowerCase()}.`;

        }
        else {

            severityReason =
                `The current ${overallLevel.toLowerCase()} risk is mainly driven by ${topFactors[0].toLowerCase()}, ${topFactors[1].toLowerCase()}, and ${topFactors[2].toLowerCase()}.`;

        }

    }


    // =========================================
    // RECOMMENDATIONS
    // =========================================

    if (finalScore >= 75) {

        recommendations.push(
            "Avoid non-essential travel until conditions improve"
        );

        recommendations.push(
            "Monitor official disaster alerts before travelling"
        );

    }
    else if (finalScore >= 55) {

        recommendations.push(
            "Exercise strong caution while travelling"
        );

        recommendations.push(
            "Check official alerts immediately before departure"
        );

    }
    else if (finalScore >= 30) {

        recommendations.push(
            "Travel with caution and monitor conditions regularly"
        );

        recommendations.push(
            "Check official alerts before starting the journey"
        );

    }
    else {

        recommendations.push(
            "Current conditions appear relatively favorable for travel"
        );

    }


    // =========================================
    // SPECIFIC RECOMMENDATIONS
    // =========================================

    if (factors.altitude.score >= 10) {

        recommendations.push(
            "Allow additional time to adjust to the high-altitude environment"
        );

    }

    if (factors.visibility.score >= 5) {

        recommendations.push(
            "Prefer travel during periods of better visibility"
        );

    }

    if (factors.rain.score >= 8) {

        recommendations.push(
            "Avoid exposed routes during periods of heavy rainfall"
        );

    }

    if (factors.wind.score >= 6) {

        recommendations.push(
            "Avoid exposed areas if strong winds or gusts develop"
        );

    }

    if (factors.snow.score >= 6) {

        recommendations.push(
            "Check road and route conditions before travelling through snowy areas"
        );

    }

    if (factors.disaster_alerts.score > 0) {

        recommendations.push(
            "Continue monitoring official disaster alerts for changes in severity"
        );

    }

    if (landslideRisk.score >= 15) {

        recommendations.push(
            "Avoid unstable slopes and areas exposed to landslides"
        );

    }


    // =========================================
    // REMOVE DUPLICATES
    // =========================================

    const uniqueConcerns =
        [...new Set(mainConcerns)];

    const uniquePositives =
        [...new Set(positiveConditions)];

    const uniqueRecommendations =
        [...new Set(recommendations)];


    // =========================================
    // FINAL RESULT
    // =========================================

    return {

        severity_reason:
            severityReason,

        top_risk_factors:
            riskFactors.slice(0, 3),

        main_concerns:
            uniqueConcerns.slice(0, 5),

        positive_conditions:
            uniquePositives.slice(0, 5),

        recommendations:
            uniqueRecommendations.slice(0, 6)

    };

}





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
function calculateVisibilityRisk(hourly, current) {

    const visibilityValues =
        hourly.visibility || [];

    if (visibilityValues.length === 0) {
        return 0;
    }

    const hourlyTimes =
        hourly.time || [];

    // -----------------------------------------
    // FIND CURRENT HOUR
    // -----------------------------------------

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

    // -----------------------------------------
    // CURRENT VISIBILITY
    // -----------------------------------------

    const currentVisibility =
        Number(current?.visibility);

    // -----------------------------------------
    // NEXT 24 HOURS
    // -----------------------------------------

    const next24Hours =
        visibilityValues.slice(
            currentIndex,
            currentIndex + 24
        );

    if (next24Hours.length === 0) {
        return 0;
    }

    // -----------------------------------------
    // CURRENT VISIBILITY SCORE
    // -----------------------------------------

    let currentScore = 0;

    if (!Number.isNaN(currentVisibility)) {

        if (currentVisibility < 500) {
            currentScore = 15;
        }
        else if (currentVisibility < 1000) {
            currentScore = 12;
        }
        else if (currentVisibility < 2000) {
            currentScore = 9;
        }
        else if (currentVisibility < 5000) {
            currentScore = 5;
        }
        else if (currentVisibility < 10000) {
            currentScore = 2;
        }

    }

    // -----------------------------------------
    // FUTURE VISIBILITY
    // -----------------------------------------

    const poorVisibilityHours =
        next24Hours.filter(
            value => Number(value) < 1000
        ).length;

    const veryPoorVisibilityHours =
        next24Hours.filter(
            value => Number(value) < 500
        ).length;

    let forecastScore = 0;

    /*
     * A short future visibility problem
     * should not immediately create maximum risk.
     */

    if (veryPoorVisibilityHours >= 8) {
        forecastScore = 10;
    }
    else if (veryPoorVisibilityHours >= 5) {
        forecastScore = 8;
    }
    else if (veryPoorVisibilityHours >= 3) {
        forecastScore = 6;
    }
    else if (veryPoorVisibilityHours >= 1) {
        forecastScore = 4;
    }
    else if (poorVisibilityHours >= 8) {
        forecastScore = 8;
    }
    else if (poorVisibilityHours >= 5) {
        forecastScore = 6;
    }
    else if (poorVisibilityHours >= 3) {
        forecastScore = 4;
    }
    else if (poorVisibilityHours >= 1) {
        forecastScore = 2;
    }

    // -----------------------------------------
    // FINAL VISIBILITY SCORE
    // -----------------------------------------

    /*
     * Current conditions have more importance.
     * Future conditions add a warning component.
     */

    let score =
        Math.max(
            currentScore,
            forecastScore
        );

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
// 24-HOUR ENVIRONMENTAL RISK FORECAST
// Maximum: 100 points
//
// Uses actual hourly forecast data.
// Does NOT invent future official alerts.
// Does NOT treat the current landslide indicator
// as an hourly forecast.
//
// Components:
// Rain: 25
// Wind: 15
// Visibility: 15
// Snow: 15
// Temperature: 10
// Altitude: 20
// =========================================

function calculateHourlyEnvironmentalRiskForecast(
    weatherData,
    elevation
) {

    const hourly =
        weatherData.hourly || {};

    const current =
        weatherData.current || {};

    const times =
        hourly.time || [];

    if (times.length === 0) {
        return [];
    }

    // -----------------------------------------
    // FIND CURRENT HOUR
    // -----------------------------------------

    let currentIndex = 0;

    if (current.time) {

        const now =
            new Date(current.time);

        let smallestDifference =
            Infinity;

        times.forEach((time, index) => {

            const forecastTime =
                new Date(time);

            const difference =
                Math.abs(
                    forecastTime.getTime() -
                    now.getTime()
                );

            if (difference < smallestDifference) {

                smallestDifference =
                    difference;

                currentIndex =
                    index;
            }

        });
    }

    // -----------------------------------------
    // TAKE NEXT 24 HOURS
    // -----------------------------------------

    const forecastTimes =
        times.slice(
            currentIndex,
            currentIndex + 24
        );

    // -----------------------------------------
    // ALTITUDE IS CONSTANT
    // -----------------------------------------

    const altitudeRisk =
        calculateAltitudeRisk(elevation);

    // -----------------------------------------
    // CALCULATE EACH HOUR
    // -----------------------------------------

    return forecastTimes.map((time, offset) => {

        const index =
            currentIndex + offset;

        const temperature =
            Number(
                hourly.temperature_2m?.[index]
            );

        const precipitation =
            Number(
                hourly.precipitation?.[index]
            );

        const precipitationProbability =
            Number(
                hourly.precipitation_probability?.[index]
            );

        const wind =
            Number(
                hourly.wind_speed_10m?.[index]
            );

        const gust =
            Number(
                hourly.wind_gusts_10m?.[index]
            );

        const visibility =
            Number(
                hourly.visibility?.[index]
            );

        const snowfall =
            Number(
                hourly.snowfall?.[index]
            );

        // -----------------------------------------
        // RAIN
        // Maximum: 25
        // -----------------------------------------

        let rainRisk = 0;

        if (precipitationProbability >= 90) {
            rainRisk += 15;
        }
        else if (precipitationProbability >= 70) {
            rainRisk += 12;
        }
        else if (precipitationProbability >= 50) {
            rainRisk += 9;
        }
        else if (precipitationProbability >= 30) {
            rainRisk += 5;
        }
        else if (precipitationProbability >= 10) {
            rainRisk += 2;
        }

        if (precipitation >= 20) {
            rainRisk += 10;
        }
        else if (precipitation >= 10) {
            rainRisk += 8;
        }
        else if (precipitation >= 5) {
            rainRisk += 5;
        }
        else if (precipitation >= 2) {
            rainRisk += 3;
        }
        else if (precipitation > 0) {
            rainRisk += 1;
        }

        rainRisk =
            Math.min(rainRisk, 25);

        // -----------------------------------------
        // WIND
        // Maximum: 15
        // -----------------------------------------

        let windRisk = 0;

        if (gust >= 60) {
            windRisk = 15;
        }
        else if (gust >= 50) {
            windRisk = 12;
        }
        else if (gust >= 40) {
            windRisk = 9;
        }
        else if (gust >= 30) {
            windRisk = 6;
        }
        else if (gust >= 20) {
            windRisk = 3;
        }

        if (wind >= 30) {
            windRisk += 3;
        }
        else if (wind >= 20) {
            windRisk += 2;
        }

        windRisk =
            Math.min(windRisk, 15);

        // -----------------------------------------
        // VISIBILITY
        // Maximum: 15
        // -----------------------------------------

        let visibilityRisk = 0;

        if (!Number.isNaN(visibility)) {

            if (visibility < 500) {
                visibilityRisk = 15;
            }
            else if (visibility < 1000) {
                visibilityRisk = 12;
            }
            else if (visibility < 2000) {
                visibilityRisk = 9;
            }
            else if (visibility < 5000) {
                visibilityRisk = 5;
            }
            else if (visibility < 10000) {
                visibilityRisk = 2;
            }
        }

        // -----------------------------------------
        // SNOW
        // Maximum: 15
        // -----------------------------------------

        let snowRisk = 0;

        if (snowfall >= 20) {
            snowRisk = 12;
        }
        else if (snowfall >= 10) {
            snowRisk = 9;
        }
        else if (snowfall >= 5) {
            snowRisk = 6;
        }
        else if (snowfall > 0) {
            snowRisk = 3;
        }

        snowRisk =
            Math.min(snowRisk, 15);

        // -----------------------------------------
        // TEMPERATURE
        // Maximum: 10
        // -----------------------------------------

        let temperatureRisk = 0;

        if (!Number.isNaN(temperature)) {

            if (temperature <= -10) {
                temperatureRisk += 6;
            }
            else if (temperature <= -5) {
                temperatureRisk += 5;
            }
            else if (temperature <= 0) {
                temperatureRisk += 3;
            }

            if (temperature >= 45) {
                temperatureRisk += 6;
            }
            else if (temperature >= 40) {
                temperatureRisk += 5;
            }
            else if (temperature >= 35) {
                temperatureRisk += 3;
            }
        }

        temperatureRisk =
            Math.min(temperatureRisk, 10);

        // -----------------------------------------
        // TOTAL
        // -----------------------------------------

        const rawScore =
            rainRisk +
            windRisk +
            visibilityRisk +
            snowRisk +
            temperatureRisk +
            altitudeRisk;

        const score =
            Math.min(
                Math.round(rawScore),
                100
            );

        let level;

        if (score >= 75) {
            level = "EXTREME";
        }
        else if (score >= 55) {
            level = "HIGH";
        }
        else if (score >= 30) {
            level = "MODERATE";
        }
        else {
            level = "LOW";
        }

        return {
            time,
            score,
            level
        };
    });
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
        hourly,
        current
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
    // -----------------------------------------
// DETERMINISTIC RISK SUMMARY
// -----------------------------------------

const riskSummary =
    generateRiskSummary(
        finalScore,
        overallLevel,
        {
            rain: {
                score: rainRisk
            },

            wind: {
                score: windRisk
            },

            visibility: {
                score: visibilityRisk
            },

            snow: {
                score: snowRisk
            },

            temperature: {
                score: temperatureRisk
            },

            altitude: {
                score: altitudeRisk
            },

            disaster_alerts: {
                score: disasterRisk.score
            }
        },

        disasterAlerts,

        landslideRisk,

        {
            elevation_m: elevation
        }
    );
    const riskForecast =
    calculateHourlyEnvironmentalRiskForecast(
        weatherData,
        elevation
    );
    return {
        score: finalScore,
        level: overallLevel,
        risk_summary: riskSummary,
        risk_forecast: riskForecast,

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
        const aiAnalysis =
    await generateRiskExplanation({
        location: {
            name: place.name,
            country: place.country,
            latitude: latitude,
            longitude: longitude,
            elevation_m: place.elevation,
            timezone: place.timezone
        },
        weather: weatherData,
        risk: risk
    });
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
            current_units: weatherData.current_units,

            hourly: weatherData.hourly,
            hourly_units: weatherData.hourly_units,

            daily: weatherData.daily,
            daily_units: weatherData.daily_units

        },

        risk: risk,

        ai_analysis: aiAnalysis

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