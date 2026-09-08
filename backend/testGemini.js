require("dotenv").config();

const {
    generateRiskExplanation
} = require("./geminiService");


async function testGemini() {

    const testData = {

        location: {
            name: "Kedarnath",
            elevation_m: 3430
        },

        risk: {

            score: 34,

            level: "MODERATE",

            risk_summary: {

                severity_reason:
                    "The current moderate risk is mainly driven by altitude, visibility, and official alerts.",

                top_risk_factors: [

                    {
                        factor: "Altitude",
                        score: 14,
                        max_score: 20,
                        reason:
                            "Destination is located at 3430 m elevation."
                    },

                    {
                        factor: "Visibility",
                        score: 10,
                        max_score: 15,
                        reason:
                            "Multiple forecast hours show significantly reduced visibility."
                    },

                    {
                        factor: "Official alerts",
                        score: 8,
                        max_score: 30,
                        reason:
                            "Active official alert: Thunderstorm with Lightning."
                    }

                ],

                main_concerns: [
                    "High-altitude destination at 3430 m",
                    "Visibility may fall below safe travel levels during some forecast hours",
                    "Official disaster alert currently active"
                ],

                positive_conditions: [
                    "Wind conditions are relatively calm",
                    "No significant snowfall risk detected",
                    "No significant temperature-related risk detected",
                    "Landslide trigger indicator is currently low"
                ],

                recommendations: [
                    "Travel with caution and monitor conditions regularly",
                    "Check official alerts before starting the journey",
                    "Allow additional time to adjust to the high-altitude environment",
                    "Prefer travel during periods of better visibility"
                ]
            },

            official_alerts: [
                {
                    disaster_type:
                        "Thunderstorm with Lightning",

                    severity: "WATCH",

                    alert_source:
                        "Uttarakhand SDMA"
                }
            ]

        }

    };


    try {

        const result =
            await generateRiskExplanation(testData);

        console.log(
            JSON.stringify(result, null, 2)
        );

    }
    catch (error) {

        console.error(
            "Gemini test failed:"
        );

        console.error(error);

    }

}


testGemini();