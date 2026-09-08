const express = require("express");
const cors = require("cors");
const { generateRiskExplanation } = require("./geminiService");


// =========================================
// RELIABLE EXTERNAL API FETCH
// =========================================

async function fetchWithRetry(
    url,
    options = {},
    retries = 3
) {
    let lastError;

    for (
        let attempt = 1;
        attempt <= retries;
        attempt++
    ) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(15000)
            });

            return response;
        } catch (error) {
            lastError = error;

            console.log(
                `⚠️ API request failed ` +
                `(attempt ${attempt}/${retries}): ` +
                `${error.message}`
            );

            if (attempt < retries) {
                const delay = attempt * 2000;

                await new Promise(resolve =>
                    setTimeout(resolve, delay)
                );
            }
        }
    }

    throw lastError;
}


const app = express();

app.use(cors());
app.use(express.json());

const port = 3000;


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
        reason,
        value = null,
        unit = ""
    ) {
        if (score > 0) {
            const importance =
                (score / maxScore) * 100;

            let severity = "NORMAL";

            if (importance >= 80) {
                severity = "CRITICAL";
            } else if (importance >= 60) {
                severity = "HIGH";
            } else if (importance >= 35) {
                severity = "ELEVATED";
            }

            riskFactors.push({
                id: name
                    .toLowerCase()
                    .replace(/\s+/g, "_"),

                factor: name,

                label: name.toUpperCase(),

                value: value,

                unit: unit,

                score: score,

                max_score: maxScore,

                importance:
                    Math.round(importance),

                severity: severity,

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
            `Destination is located at ${rawIndicators.elevation_m} m elevation.`,
            rawIndicators.elevation_m,
            "m"
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
            "Forecast rainfall and precipitation probability are contributing to the risk.",
            rawIndicators.today_precipitation_mm,
            "mm"
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
            "Forecast wind speeds or gusts are contributing to travel risk.",
            rawIndicators.current_wind_kmh,
            "km/h"
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
            "Multiple forecast hours show significantly reduced visibility.",
            rawIndicators.current_visibility_m != null
                ? Number(
                    (rawIndicators.current_visibility_m / 1000)
                        .toFixed(1)
                )
                : null,
            "km"
        );
    } else if (factors.visibility.score >= 5) {
        mainConcerns.push(
            "Reduced visibility is possible during the forecast period"
        );

        addRiskFactor(
            "Visibility",
            factors.visibility.score,
            15,
            "Multiple forecast hours show significantly reduced visibility.",
            rawIndicators.current_visibility_m != null
                ? Number(
                    (rawIndicators.current_visibility_m / 1000)
                        .toFixed(1)
                )
                : null,
            "km"
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
            "Forecast snowfall may affect routes and travel conditions.",
            rawIndicators.today_snowfall_cm,
            "cm"
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
            "Forecast temperatures are contributing to the calculated risk.",
            rawIndicators.current_temperature_c,
            "°C"
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
            alertReason,
            disasterAlerts.length,
            "active"
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
            "Weather and terrain conditions are contributing to the landslide trigger indicator.",
            landslideRisk.score,
            "/50"
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
    } else {
        const topFactors =
            riskFactors
                .slice(0, 3)
                .map(factor => factor.factor);

        if (topFactors.length === 1) {
            severityReason =
                `The current ${overallLevel.toLowerCase()} risk is primarily driven by ${topFactors[0].toLowerCase()}.`;
        } else if (topFactors.length === 2) {
            severityReason =
                `The current ${overallLevel.toLowerCase()} risk is mainly driven by ${topFactors[0].toLowerCase()} and ${topFactors[1].toLowerCase()}.`;
        } else {
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
    } else if (finalScore >= 55) {
        recommendations.push(
            "Exercise strong caution while travelling"
        );

        recommendations.push(
            "Check official alerts immediately before departure"
        );
    } else if (finalScore >= 30) {
        recommendations.push(
            "Travel with caution and monitor conditions regularly"
        );

        recommendations.push(
            "Check official alerts before starting the journey"
        );
    } else {
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

        key_factors:
            riskFactors.slice(0, 4),

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
    } else if (precipitationProbability >= 70) {
        score += 12;
    } else if (precipitationProbability >= 50) {
        score += 9;
    } else if (precipitationProbability >= 30) {
        score += 5;
    } else if (precipitationProbability >= 10) {
        score += 2;
    }


    // Rainfall amount
    if (precipitation >= 20) {
        score += 10;
    } else if (precipitation >= 10) {
        score += 8;
    } else if (precipitation >= 5) {
        score += 5;
    } else if (precipitation >= 2) {
        score += 3;
    } else if (precipitation > 0) {
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
    } else if (gust >= 50) {
        score = 12;
    } else if (gust >= 40) {
        score = 9;
    } else if (gust >= 30) {
        score = 6;
    } else if (gust >= 20) {
        score = 3;
    }


    // Sustained wind
    if (wind >= 30) {
        score += 3;
    } else if (wind >= 20) {
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


    // FIND CURRENT HOUR

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


    // CURRENT VISIBILITY

    const currentVisibility =
        Number(current?.visibility);


    // NEXT 24 HOURS

    const next24Hours =
        visibilityValues.slice(
            currentIndex,
            currentIndex + 24
        );

    if (next24Hours.length === 0) {
        return 0;
    }


    // CURRENT VISIBILITY SCORE

    let currentScore = 0;

    if (!Number.isNaN(currentVisibility)) {
        if (currentVisibility < 500) {
            currentScore = 15;
        } else if (currentVisibility < 1000) {
            currentScore = 12;
        } else if (currentVisibility < 2000) {
            currentScore = 9;
        } else if (currentVisibility < 5000) {
            currentScore = 5;
        } else if (currentVisibility < 10000) {
            currentScore = 2;
        }
    }


    // FUTURE VISIBILITY

    const poorVisibilityHours =
        next24Hours.filter(
            value => Number(value) < 1000
        ).length;

    const veryPoorVisibilityHours =
        next24Hours.filter(
            value => Number(value) < 500
        ).length;

    let forecastScore = 0;


    if (veryPoorVisibilityHours >= 8) {
        forecastScore = 10;
    } else if (veryPoorVisibilityHours >= 5) {
        forecastScore = 8;
    } else if (veryPoorVisibilityHours >= 3) {
        forecastScore = 6;
    } else if (veryPoorVisibilityHours >= 1) {
        forecastScore = 4;
    } else if (poorVisibilityHours >= 8) {
        forecastScore = 8;
    } else if (poorVisibilityHours >= 5) {
        forecastScore = 6;
    } else if (poorVisibilityHours >= 3) {
        forecastScore = 4;
    } else if (poorVisibilityHours >= 1) {
        forecastScore = 2;
    }


    // FINAL VISIBILITY SCORE

    const score =
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
    } else if (snowfall >= 10) {
        score += 9;
    } else if (snowfall >= 5) {
        score += 6;
    } else if (snowfall > 0) {
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
    } else if (minTemperature <= -5) {
        score += 5;
    } else if (minTemperature <= 0) {
        score += 3;
    }


    // Extreme heat

    if (maxTemperature >= 45) {
        score += 6;
    } else if (maxTemperature >= 40) {
        score += 5;
    } else if (maxTemperature >= 35) {
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


    // FIND CURRENT HOUR

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


    // NEXT 24 HOURS

    const forecastTimes =
        times.slice(
            currentIndex,
            currentIndex + 24
        );


    // ALTITUDE

    const altitudeRisk =
        calculateAltitudeRisk(elevation);


    // CALCULATE EACH HOUR

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


        // RAIN

        let rainRisk = 0;

        if (precipitationProbability >= 90) {
            rainRisk += 15;
        } else if (precipitationProbability >= 70) {
            rainRisk += 12;
        } else if (precipitationProbability >= 50) {
            rainRisk += 9;
        } else if (precipitationProbability >= 30) {
            rainRisk += 5;
        } else if (precipitationProbability >= 10) {
            rainRisk += 2;
        }

        if (precipitation >= 20) {
            rainRisk += 10;
        } else if (precipitation >= 10) {
            rainRisk += 8;
        } else if (precipitation >= 5) {
            rainRisk += 5;
        } else if (precipitation >= 2) {
            rainRisk += 3;
        } else if (precipitation > 0) {
            rainRisk += 1;
        }

        rainRisk =
            Math.min(rainRisk, 25);


        // WIND

        let windRisk = 0;

        if (gust >= 60) {
            windRisk = 15;
        } else if (gust >= 50) {
            windRisk = 12;
        } else if (gust >= 40) {
            windRisk = 9;
        } else if (gust >= 30) {
            windRisk = 6;
        } else if (gust >= 20) {
            windRisk = 3;
        }

        if (wind >= 30) {
            windRisk += 3;
        } else if (wind >= 20) {
            windRisk += 2;
        }

        windRisk =
            Math.min(windRisk, 15);


        // VISIBILITY

        let visibilityRisk = 0;

        if (!Number.isNaN(visibility)) {
            if (visibility < 500) {
                visibilityRisk = 15;
            } else if (visibility < 1000) {
                visibilityRisk = 12;
            } else if (visibility < 2000) {
                visibilityRisk = 9;
            } else if (visibility < 5000) {
                visibilityRisk = 5;
            } else if (visibility < 10000) {
                visibilityRisk = 2;
            }
        }


        // SNOW

        let snowRisk = 0;

        if (snowfall >= 20) {
            snowRisk = 12;
        } else if (snowfall >= 10) {
            snowRisk = 9;
        } else if (snowfall >= 5) {
            snowRisk = 6;
        } else if (snowfall > 0) {
            snowRisk = 3;
        }

        snowRisk =
            Math.min(snowRisk, 15);


        // TEMPERATURE

        let temperatureRisk = 0;

        if (!Number.isNaN(temperature)) {
            if (temperature <= -10) {
                temperatureRisk += 6;
            } else if (temperature <= -5) {
                temperatureRisk += 5;
            } else if (temperature <= 0) {
                temperatureRisk += 3;
            }

            if (temperature >= 45) {
                temperatureRisk += 6;
            } else if (temperature >= 40) {
                temperatureRisk += 5;
            } else if (temperature >= 35) {
                temperatureRisk += 3;
            }
        }

        temperatureRisk =
            Math.min(temperatureRisk, 10);


        // TOTAL

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
        } else if (score >= 55) {
            level = "HIGH";
        } else if (score >= 30) {
            level = "MODERATE";
        } else {
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


    // WEATHER RISKS

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


    // DISASTER RISK

    const disasterRisk =
        calculateDisasterAlertRisk(
            disasterAlerts
        );


    // LANDSLIDE

    const landslideRisk =
        calculateLandslideIndicator(
            daily,
            hourly,
            elevation,
            current
        );


    // =========================================
    // RAW SCORE
    //
    // Weather = 100
    // Disaster alerts = 30
    // Landslide = 20
    // Total = 150
    // =========================================

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

    const maximumRawScore = 150;

    const totalScore =
        Math.round(
            (rawScore / maximumRawScore) * 100
        );

    const finalScore =
        Math.min(
            totalScore,
            100
        );


    // =========================================
    // OVERALL RISK LEVEL
    // =========================================

    let overallLevel;

    if (finalScore >= 75) {
        overallLevel = "EXTREME";
    } else if (finalScore >= 55) {
        overallLevel = "HIGH";
    } else if (finalScore >= 30) {
        overallLevel = "MODERATE";
    } else {
        overallLevel = "LOW";
    }


    // =========================================
    // DETERMINISTIC RISK SUMMARY
    // =========================================

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
                elevation_m: elevation,

                today_precipitation_mm:
                    daily.precipitation_sum?.[0] ?? 0,

                today_snowfall_cm:
                    daily.snowfall_sum?.[0] ?? 0,

                current_temperature_c:
                    current.temperature_2m ?? null,

                current_wind_kmh:
                    current.wind_speed_10m ?? null,

                current_visibility_m:
                    current.visibility ?? null
            }
        );


    // =========================================
    // HOURLY FORECAST
    // =========================================

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
                elevation,

            today_precipitation_mm:
                daily.precipitation_sum?.[0] ?? 0,

            today_snowfall_cm:
                daily.snowfall_sum?.[0] ?? 0,

            precipitation_probability_percent:
                daily.precipitation_probability_max?.[0] ?? 0
        }
    };
}


// =========================================
// NDMA SACHET DISASTER ALERT ENGINE
// =========================================

async function fetchSachetAlerts(
    latitude,
    longitude
) {
    try {
        const url =
            "https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails";

        const response =
            await fetchWithRetry(url);

        if (!response.ok) {
            throw new Error(
                `SACHET API failed: ${response.status}`
            );
        }

        const data =
            await response.json();

        if (!Array.isArray(data)) {
            return [];
        }


        // =========================================
        // DISTANCE CALCULATOR
        // =========================================

        function distanceKm(
            lat1,
            lon1,
            lat2,
            lon2
        ) {
            const R = 6371;

            const dLat =
                (lat2 - lat1) *
                Math.PI / 180;

            const dLon =
                (lon2 - lon1) *
                Math.PI / 180;

            const a =
                Math.sin(dLat / 2) *
                Math.sin(dLat / 2) +

                Math.cos(lat1 * Math.PI / 180) *
                Math.cos(lat2 * Math.PI / 180) *

                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);

            const c =
                2 *
                Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(1 - a)
                );

            return R * c;
        }


        // =========================================
        // RELEVANT ALERTS
        // =========================================

        const relevantAlerts = [];


        for (const alert of data) {
            if (!alert.centroid) {
                continue;
            }

            const parts =
                String(
                    alert.centroid
                ).split(",");

            if (parts.length !== 2) {
                continue;
            }


            // SACHET centroid:
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


            // =========================================
            // APPROXIMATE ALERT RADIUS
            // =========================================

            let alertRadiusKm = 50;

            if (alert.area_covered) {
                const area =
                    Number(
                        alert.area_covered
                    );

                if (
                    !Number.isNaN(area) &&
                    area > 0
                ) {
                    alertRadiusKm =
                        Math.sqrt(
                            area / Math.PI
                        );
                }
            }


            alertRadiusKm =
                Math.max(
                    alertRadiusKm,
                    25
                );

            alertRadiusKm =
                Math.min(
                    alertRadiusKm,
                    150
                );


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
                        Number(
                            distance.toFixed(2)
                        ),

                    alert_radius_km:
                        Number(
                            alertRadiusKm.toFixed(2)
                        )
                });
            }
        }


        return relevantAlerts;

    } catch (error) {
        console.error(
            "SACHET alert error:",
            error.message
        );

        // SACHET failure should not
        // break SATARK.

        return [];
    }
}


// =========================================
// OFFICIAL DISASTER ALERT RISK
// Maximum raw score: 30
// =========================================

function calculateDisasterAlertRisk(
    alerts
) {
    if (
        !alerts ||
        alerts.length === 0
    ) {
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


        // =========================================
        // SEVERITY
        // =========================================

        if (
            severity === "WARNING" ||
            color === "red"
        ) {
            score += 15;

        } else if (
            severity === "ALERT" ||
            color === "orange"
        ) {
            score += 10;

        } else if (
            severity === "WATCH" ||
            color === "yellow"
        ) {
            score += 5;

        } else {
            score += 2;
        }


        // =========================================
        // HAZARD IMPORTANCE
        // =========================================

        if (
            type.includes("landslide") ||
            type.includes("avalanche") ||
            type.includes("flood") ||
            type.includes("flash flood") ||
            type.includes("cyclone") ||
            type.includes("tsunami")
        ) {
            score += 5;

        } else if (
            type.includes("thunderstorm") ||
            type.includes("lightning") ||
            type.includes("heavy rain") ||
            type.includes("heat wave") ||
            type.includes("cold wave")
        ) {
            score += 3;
        }
    }


    score =
        Math.min(
            score,
            30
        );


    let level = "LOW";

    if (score >= 25) {
        level = "EXTREME";
    } else if (score >= 15) {
        level = "HIGH";
    } else if (score >= 5) {
        level = "MODERATE";
    }


    return {
        score,

        level,

        alert_count:
            alerts.length,

        alerts
    };
}


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
    // FIND CURRENT HOUR
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
            hourlyTimes.map(
                (time, index) => {
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
                }
            );

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
                sum +
                (Number(value) || 0),
            0
        );


    // =========================================
    // ELEVATION
    // =========================================

    if (elevation >= 2500) {
        score += 10;
    } else if (elevation >= 1500) {
        score += 6;
    } else if (elevation >= 1000) {
        score += 3;
    }


    // =========================================
    // FORECAST RAINFALL
    // =========================================

    if (next24Rain >= 50) {
        score += 30;
    } else if (next24Rain >= 30) {
        score += 24;
    } else if (next24Rain >= 20) {
        score += 18;
    } else if (next24Rain >= 10) {
        score += 10;
    } else if (next24Rain >= 5) {
        score += 5;
    }


    // =========================================
    // RAIN PROBABILITY
    // =========================================

    if (precipitationProbability >= 90) {
        score += 10;
    } else if (precipitationProbability >= 70) {
        score += 7;
    } else if (precipitationProbability >= 50) {
        score += 4;
    }


    // =========================================
    // TODAY'S PRECIPITATION
    // =========================================

    if (precipitation >= 20) {
        score += 15;
    } else if (precipitation >= 10) {
        score += 10;
    } else if (precipitation >= 5) {
        score += 5;
    }


    // =========================================
    // LIMIT
    // =========================================

    score =
        Math.min(
            score,
            50
        );


    // =========================================
    // LEVEL
    // =========================================

    let level = "LOW";

    if (score >= 40) {
        level = "VERY HIGH";
    } else if (score >= 30) {
        level = "HIGH";
    } else if (score >= 15) {
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
                hourlyTimes[currentIndex] ??
                null
        }
    };
}


// =========================================
// HEALTH
// =========================================

app.get(
    "/api/health",
    (req, res) => {
        res.json({
            Status: "OK",
            service: "Satark Backend"
        });
    }
);


// =========================================
// LOCATION
// =========================================

app.get(
    "/api/location",
    async (req, res) => {
        try {
            const { name } =
                req.query;

            if (!name) {
                return res.status(400).json({
                    error:
                        "Missing 'name' query parameter"
                });
            }


            const url =
                `https://geocoding-api.open-meteo.com/v1/search` +
                `?name=${encodeURIComponent(name)}` +
                `&count=1` +
                `&language=en` +
                `&format=json`;

            const response =
                await fetchWithRetry(url);

            if (!response.ok) {
                throw new Error(
                    `Error fetching location data: ${response.statusText}`
                );
            }


            const data =
                await response.json();

            if (
                !data.results ||
                data.results.length === 0
            ) {
                return res.status(404).json({
                    error:
                        "Location not found"
                });
            }


            const location =
                data.results[0];


            res.json({
                name:
                    location.name,

                country:
                    location.country,

                latitude:
                    location.latitude,

                longitude:
                    location.longitude,

                elevation:
                    location.elevation,

                timezone:
                    location.timezone
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error:
                    "Failed to fetch location data"
            });
        }
    }
);


// =========================================
// WEATHER
// =========================================

app.get(
    "/api/weather",
    async (req, res) => {
        try {
            const {
                latitude,
                longitude
            } = req.query;


            if (
                !latitude ||
                !longitude
            ) {
                return res.status(400).json({
                    error:
                        "Missing 'latitude' or 'longitude' query parameters"
                });
            }


            const url =
                `https://api.open-meteo.com/v1/forecast` +
                `?latitude=${latitude}` +
                `&longitude=${longitude}` +
                `&current=` +
                `temperature_2m,` +
                `relative_humidity_2m,` +
                `apparent_temperature,` +
                `precipitation,` +
                `rain,` +
                `wind_speed_10m,` +
                `wind_gusts_10m,` +
                `visibility,` +
                `surface_pressure` +
                `&timezone=auto`;


            const response =
                await fetchWithRetry(url);


            if (!response.ok) {
                const errorBody =
                    await response.text();

                console.error(
                    "❌ Open-Meteo Weather API failed:",
                    response.status,
                    response.statusText
                );

                console.error(
                    "❌ Open-Meteo response:",
                    errorBody
                );

                throw new Error(
                    `Weather API failed with status ${response.status}`
                );
            }


            const data =
                await response.json();

            res.json(data);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error:
                    "Failed to fetch weather data"
            });
        }
    }
);


// =========================================
// MAIN SATARK ANALYSIS
// =========================================

app.get(
    "/api/analyze",
    async (req, res) => {
        try {
            const {
                location,
                ageGroup,
                medicalConditions
            } = req.query;


            if (!location) {
                return res.status(400).json({
                    error:
                        "Location is required"
                });
            }


            // =========================================
            // STEP 1: GEOCODE
            // =========================================

            const geoURL =
                `https://geocoding-api.open-meteo.com/v1/search` +
                `?name=${encodeURIComponent(location)}` +
                `&count=1` +
                `&language=en` +
                `&format=json`;


            const geoResponse =
                await fetchWithRetry(
                    geoURL
                );


            if (!geoResponse.ok) {
                throw new Error(
                    "Geocoding API failed"
                );
            }


            const geoData =
                await geoResponse.json();


            if (
                !geoData.results ||
                geoData.results.length === 0
            ) {
                return res.status(404).json({
                    error:
                        "Location not found"
                });
            }


            const place =
                geoData.results[0];


            const latitude =
                place.latitude;

            const longitude =
                place.longitude;


            // =========================================
            // STEP 2: WEATHER URL
            // =========================================

            const weatherURL =
                `https://api.open-meteo.com/v1/forecast` +
                `?latitude=${latitude}` +
                `&longitude=${longitude}` +

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


            // =========================================
            // STEP 3: FETCH WEATHER
            // =========================================

            // IMPORTANT:
            // This declaration appears ONLY ONCE.
            const weatherResponse =
                await fetchWithRetry(
                    weatherURL
                );


            if (!weatherResponse.ok) {
                const errorBody =
                    await weatherResponse.text();

                console.error(
                    "❌ Open-Meteo Weather API failed:",
                    weatherResponse.status,
                    weatherResponse.statusText
                );

                console.error(
                    "❌ Open-Meteo response:",
                    errorBody
                );

                throw new Error(
                    `Weather API failed with status ${weatherResponse.status}`
                );
            }


            const weatherData =
                await weatherResponse.json();


            // =========================================
            // STEP 4: OFFICIAL DISASTER ALERTS
            // =========================================

            const disasterAlerts =
                await fetchSachetAlerts(
                    latitude,
                    longitude
                );


            // =========================================
            // STEP 5: SATARK RISK
            // =========================================

            const risk =
                calculateSatarkRisk(
                    weatherData,
                    place.elevation,
                    disasterAlerts
                );


            // =========================================
            // STEP 6: TRAVELLER PROFILE
            // =========================================

            const travellerProfile = {
                ageGroup:
                    ageGroup || null,

                medicalConditions:
                    medicalConditions
                        ? medicalConditions
                            .split(",")
                            .map(
                                condition =>
                                    condition.trim()
                            )
                            .filter(Boolean)
                        : []
            };


            // =========================================
            // STEP 7: GEMINI PERSONALIZED ANALYSIS
            // =========================================

            const aiAnalysis =
                await generateRiskExplanation(
                    {
                        location: {
                            name:
                                place.name,

                            country:
                                place.country,

                            latitude,

                            longitude,

                            elevation_m:
                                place.elevation,

                            timezone:
                                place.timezone
                        },

                        weather:
                            weatherData,

                        risk:
                            risk
                    },

                    travellerProfile
                );


            // =========================================
            // FINAL RESPONSE
            // =========================================

            res.json({
                location: {
                    name:
                        place.name,

                    country:
                        place.country,

                    latitude,

                    longitude,

                    elevation:
                        place.elevation,

                    timezone:
                        place.timezone
                },


                weather: {
                    current:
                        weatherData.current,

                    current_units:
                        weatherData.current_units,

                    hourly:
                        weatherData.hourly,

                    hourly_units:
                        weatherData.hourly_units,

                    daily:
                        weatherData.daily,

                    daily_units:
                        weatherData.daily_units
                },


                risk:
                    risk,

                ai_analysis:
                    aiAnalysis
            });

        } catch (error) {
            console.error(
                "SATARK analysis error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to analyze location",

                message:
                    error.message
            });
        }
    }
);


// ============================================================
// 20-YEAR HISTORICAL WEATHER RISK
// ============================================================

app.get(
    "/api/history-risk",
    async (req, res) => {
        try {
            const locationName =
                req.query.location;


            if (!locationName) {
                return res.status(400).json({
                    error:
                        "Location is required"
                });
            }


            console.log(
                `📊 Calculating 20-year historical hazard index for ${locationName}`
            );


            // =========================================
            // 1. GEOCODE LOCATION
            // =========================================

            const geocodeUrl =
                `https://geocoding-api.open-meteo.com/v1/search` +
                `?name=${encodeURIComponent(locationName)}` +
                `&count=1` +
                `&language=en` +
                `&format=json`;


            const geocodeResponse =
                await fetchWithRetry(
                    geocodeUrl
                );


            if (!geocodeResponse.ok) {
                throw new Error(
                    `Geocoding failed with status ${geocodeResponse.status}`
                );
            }


            const geocodeData =
                await geocodeResponse.json();


            if (
                !geocodeData.results ||
                geocodeData.results.length === 0
            ) {
                return res.status(404).json({
                    error:
                        `Location "${locationName}" not found`
                });
            }


            const place =
                geocodeData.results[0];


            const latitude =
                place.latitude;

            const longitude =
                place.longitude;

            const elevation =
                place.elevation || 0;


            // =========================================
            // 2. LAST 20 COMPLETE YEARS
            // =========================================

            const currentYear =
                new Date().getFullYear();

            const endYear =
                currentYear - 1;

            const startYear =
                endYear - 19;


            const startDate =
                `${startYear}-01-01`;

            const endDate =
                `${endYear}-12-31`;


            // =========================================
            // 3. HISTORICAL WEATHER
            // =========================================

            const historyUrl =
                `https://archive-api.open-meteo.com/v1/archive` +
                `?latitude=${latitude}` +
                `&longitude=${longitude}` +
                `&start_date=${startDate}` +
                `&end_date=${endDate}` +
                `&daily=` +
                [
                    "precipitation_sum",
                    "snowfall_sum",
                    "temperature_2m_mean",
                    "temperature_2m_min",
                    "temperature_2m_max",
                    "wind_speed_10m_max",
                    "wind_gusts_10m_max"
                ].join(",") +
                `&timezone=auto`;


            const historyResponse =
                await fetchWithRetry(
                    historyUrl
                );


            if (!historyResponse.ok) {
                throw new Error(
                    `Historical weather API failed with status ${historyResponse.status}`
                );
            }


            const historyData =
                await historyResponse.json();


            if (!historyData.daily) {
                throw new Error(
                    "Historical weather data unavailable"
                );
            }


            const daily =
                historyData.daily;


            // =========================================
            // 4. DAILY HISTORICAL RISK
            // =========================================

            function calculateHistoricalDailyRisk({
                precipitation,
                snowfall,
                temperature,
                wind,
                gust
            }) {
                let score = 0;


                // PRECIPITATION

                if (precipitation >= 100) {
                    score += 25;
                } else if (precipitation >= 75) {
                    score += 22;
                } else if (precipitation >= 50) {
                    score += 18;
                } else if (precipitation >= 30) {
                    score += 14;
                } else if (precipitation >= 20) {
                    score += 10;
                } else if (precipitation >= 10) {
                    score += 6;
                } else if (precipitation >= 5) {
                    score += 3;
                }


                // WIND

                if (wind >= 80) {
                    score += 15;
                } else if (wind >= 60) {
                    score += 12;
                } else if (wind >= 45) {
                    score += 9;
                } else if (wind >= 30) {
                    score += 6;
                } else if (wind >= 20) {
                    score += 3;
                }


                // WIND GUSTS

                if (gust >= 100) {
                    score += 10;
                } else if (gust >= 80) {
                    score += 8;
                } else if (gust >= 60) {
                    score += 6;
                } else if (gust >= 45) {
                    score += 4;
                } else if (gust >= 30) {
                    score += 2;
                }


                // SNOW

                if (snowfall >= 30) {
                    score += 15;
                } else if (snowfall >= 20) {
                    score += 12;
                } else if (snowfall >= 10) {
                    score += 9;
                } else if (snowfall >= 5) {
                    score += 6;
                } else if (snowfall > 0) {
                    score += 3;
                }


                // TEMPERATURE EXTREMES

                if (
                    temperature >= 45 ||
                    temperature <= -15
                ) {
                    score += 10;
                } else if (
                    temperature >= 40 ||
                    temperature <= -10
                ) {
                    score += 8;
                } else if (
                    temperature >= 35 ||
                    temperature <= -5
                ) {
                    score += 5;
                } else if (
                    temperature >= 32 ||
                    temperature <= 0
                ) {
                    score += 2;
                }


                // Maximum raw score = 75

                return Math.min(
                    100,
                    Math.round(
                        (score / 75) * 100
                    )
                );
            }


            // =========================================
            // 5. BUILD DAILY RECORDS
            // =========================================

            const dailyRecords = [];


            for (
                let i = 0;
                i < daily.time.length;
                i++
            ) {
                const precipitation =
                    daily.precipitation_sum?.[i] ?? 0;

                const snowfall =
                    daily.snowfall_sum?.[i] ?? 0;

                const temperature =
                    daily.temperature_2m_mean?.[i] ?? 20;

                const wind =
                    daily.wind_speed_10m_max?.[i] ?? 0;

                const gust =
                    daily.wind_gusts_10m_max?.[i] ??
                    wind;


                const risk =
                    calculateHistoricalDailyRisk({
                        precipitation,
                        snowfall,
                        temperature,
                        wind,
                        gust
                    });


                dailyRecords.push({
                    date:
                        daily.time[i],

                    year:
                        Number(
                            daily.time[i].slice(0, 4)
                        ),

                    precipitation,

                    snowfall,

                    temperature,

                    wind,

                    gust,

                    risk
                });
            }


            // =========================================
            // 6. GROUP BY YEAR
            // =========================================

            const yearly = [];


            for (
                let year = startYear;
                year <= endYear;
                year++
            ) {
                const records =
                    dailyRecords.filter(
                        item =>
                            item.year === year
                    );


                if (records.length === 0) {
                    continue;
                }


                // BASIC STATISTICS

                const averageRisk =
                    records.reduce(
                        (sum, item) =>
                            sum + item.risk,
                        0
                    ) / records.length;


                const peakRisk =
                    Math.max(
                        ...records.map(
                            item => item.risk
                        )
                    );


                const severeDays =
                    records.filter(
                        item =>
                            item.risk >= 60
                    ).length;


                const highRiskDays =
                    records.filter(
                        item =>
                            item.risk >= 40
                    ).length;


                const totalPrecipitation =
                    records.reduce(
                        (sum, item) =>
                            sum + item.precipitation,
                        0
                    );


                const totalSnowfall =
                    records.reduce(
                        (sum, item) =>
                            sum + item.snowfall,
                        0
                    );


                // HISTORICAL HAZARD INDEX

                const averageComponent =
                    averageRisk * 0.30;


                const peakComponent =
                    peakRisk * 0.30;


                const severeDayComponent =
                    Math.min(
                        severeDays / 5,
                        1
                    ) * 20;


                const highRiskComponent =
                    Math.min(
                        highRiskDays / 20,
                        1
                    ) * 10;


                const historicalRisk =
                    Math.round(
                        averageComponent +
                        peakComponent +
                        severeDayComponent +
                        highRiskComponent
                    );


                yearly.push({
                    year,

                    risk:
                        Math.min(
                            historicalRisk,
                            100
                        ),

                    averageRisk:
                        Math.round(
                            averageRisk
                        ),

                    peakRisk,

                    severeDays,

                    highRiskDays,

                    precipitation:
                        Math.round(
                            totalPrecipitation * 10
                        ) / 10,

                    snowfall:
                        Math.round(
                            totalSnowfall * 10
                        ) / 10
                });
            }


            // =========================================
            // 7. HIGHEST-RISK YEAR
            // =========================================

            const highestRiskYear =
                yearly.length > 0
                    ? yearly.reduce(
                        (highest, current) =>
                            current.risk >
                            highest.risk
                                ? current
                                : highest,
                        yearly[0]
                    )
                    : null;


            // =========================================
            // 8. 20-YEAR AVERAGE
            // =========================================

            const historicalAverage =
                yearly.length > 0
                    ? Math.round(
                        yearly.reduce(
                            (sum, item) =>
                                sum + item.risk,
                            0
                        ) / yearly.length
                    )
                    : 0;


            // =========================================
            // 9. HISTORICAL LEVEL
            // =========================================

            function getHistoricalLevel(score) {
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
            // 10. RESPONSE
            // =========================================

            return res.json({
                location: {
                    name:
                        place.name,

                    region:
                        place.admin1 ||
                        place.country,

                    country:
                        place.country,

                    latitude,

                    longitude,

                    elevation
                },


                period: {
                    start:
                        startYear,

                    end:
                        endYear,

                    years:
                        yearly.length
                },


                summary: {
                    averageRisk:
                        historicalAverage,

                    level:
                        getHistoricalLevel(
                            historicalAverage
                        ),

                    highestRiskYear:
                        highestRiskYear?.year ??
                        null,

                    highestRiskScore:
                        highestRiskYear?.risk ??
                        null
                },


                yearly
            });

        } catch (error) {
            console.error(
                "❌ Historical risk error:",
                error
            );

            return res.status(500).json({
                error:
                    "Unable to calculate historical risk",

                message:
                    error.message
            });
        }
    }
);


// =========================================
// START SERVER
// =========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 SATARK backend running on port ${PORT}`);
});