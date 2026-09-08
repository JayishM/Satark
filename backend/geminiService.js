require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


async function generateRiskExplanation(satarkData) {

    const prompt = `
You are SATARK, an AI-powered travel safety intelligence system.

Your job is to explain the safety assessment using ONLY the data provided below.

IMPORTANT RULES:

1. DO NOT calculate a new risk score.
2. DO NOT change the provided risk score or risk level.
3. DO NOT invent weather conditions, alerts, hazards, or statistics.
4. Treat official alerts as higher-confidence information than model-generated interpretation.
5. If information is unavailable, do not guess.
6. Give practical and concise travel safety advice.
7. Clearly distinguish between official alerts and SATARK's calculated indicators.

SATARK DATA:

${JSON.stringify(satarkData, null, 2)}

Return a concise safety assessment for the traveller.
`;


    // =========================================
    // GEMINI REQUEST WITH RETRY
    // =========================================

    let response;

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

        try {

            response = await ai.models.generateContent({

                model: "gemini-3.5-flash-lite",

                contents: prompt,

                config: {

                    responseMimeType: "application/json",

                    responseSchema: {

                        type: "object",

                        properties: {

                            decision: {
                                type: "string",
                                description:
                                    "Overall travel recommendation based strictly on the provided SATARK risk level."
                            },

                            headline: {
                                type: "string",
                                description:
                                    "Short traveller-friendly safety headline."
                            },

                            explanation: {
                                type: "string",
                                description:
                                    "Clear explanation of why the destination has its current risk level."
                            },

                            key_risks: {
                                type: "array",
                                items: {
                                    type: "string"
                                },
                                description:
                                    "Most important risks the traveller should know about."
                            },

                            what_to_do: {
                                type: "array",
                                items: {
                                    type: "string"
                                },
                                description:
                                    "Practical actions the traveller should take."
                            },

                            when_to_travel: {
                                type: "string",
                                description:
                                    "Guidance about safer travel timing based only on the supplied forecast."
                            },

                            emergency_advice: {
                                type: "string",
                                description:
                                    "Emergency-oriented advice based only on the supplied alerts and hazards."
                            }

                        },

                        required: [
                            "decision",
                            "headline",
                            "explanation",
                            "key_risks",
                            "what_to_do",
                            "when_to_travel",
                            "emergency_advice"
                        ]

                    }

                }

            });


            // Request succeeded
            break;

        }
        catch (error) {

            // Retry only temporary Gemini availability errors
            if (
                error.status === 503 &&
                attempt < maxRetries
            ) {

                const delay =
                    attempt * 3000;

                console.log(
                    `Gemini temporarily unavailable. Retrying in ${delay / 1000}s...`
                );

                await new Promise(
                    resolve =>
                        setTimeout(resolve, delay)
                );

            }
            else {

                // Don't hide other errors
                throw error;

            }

        }

    }


    // =========================================
    // PARSE GEMINI JSON
    // =========================================

    return JSON.parse(response.text);

}


module.exports = {
    generateRiskExplanation
};