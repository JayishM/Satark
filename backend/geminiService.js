require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


/*
=========================================================
 SATARK — GEMINI RISK EXPLANATION SERVICE
=========================================================

 IMPORTANT ARCHITECTURE:

 SATARK calculates the actual destination risk.

 Gemini DOES NOT:
 - calculate the risk score
 - modify the risk score
 - invent hazards
 - invent alerts
 - diagnose medical conditions

 Gemini ONLY:
 - explains the existing SATARK assessment
 - personalizes the explanation for the selected age group
 - provides general medical travel precautions
 - suggests safer travel timing from supplied forecast data
=========================================================
*/


async function generateRiskExplanation(
    satarkData,
    travellerProfile = {}
) {

    /*
    -----------------------------------------------------
    NORMALIZE TRAVELLER PROFILE
    -----------------------------------------------------
    */

    const ageGroup =
        travellerProfile.ageGroup || null;

    const medicalConditions =
        Array.isArray(travellerProfile.medicalConditions)
            ? travellerProfile.medicalConditions
            : [];


    /*
    -----------------------------------------------------
    GEMINI PROMPT
    -----------------------------------------------------
    */

    const prompt = `
You are SATARK, an AI-powered travel safety intelligence system.

Your job is to explain the existing SATARK safety assessment
and personalize the explanation for the selected traveller profile.

You MUST use ONLY the information provided in:

1. SATARK DATA
2. TRAVELLER PROFILE

=========================================================
CRITICAL RULES
=========================================================

1. DO NOT calculate a new overall risk score.

2. DO NOT change the SATARK risk score.

3. DO NOT change the SATARK risk level.

4. DO NOT invent weather conditions.

5. DO NOT invent hazards.

6. DO NOT invent official alerts.

7. DO NOT invent statistics.

8. DO NOT invent medical facts that are not necessary to
   explain the supplied destination conditions.

9. Official alerts have higher confidence than
   SATARK's model-generated interpretation.

10. Clearly distinguish between official alerts and
    SATARK calculated indicators.

11. If information is unavailable, explicitly say
    that the information is unavailable.

12. Give practical and concise travel safety advice.

13. NEVER diagnose a medical condition.

14. NEVER prescribe medication or treatment.

15. NEVER invent hospitals, doctors, medicines,
    treatments or emergency services.

16. NEVER claim that a person is medically safe or
    medically unsafe.

17. Medical recommendations must be general precautions
    based ONLY on the supplied destination conditions
    and the medical conditions provided by the traveller.

18. Do not assume a medical condition that is not listed.

19. If no medical conditions are supplied, state that
    no condition-specific recommendation can be provided.

20. Do not automatically classify an age group as unsafe.

21. An age-group recommendation must be based on the
    actual hazards, weather, alerts and environmental
    conditions contained in SATARK DATA.

22. If the supplied data does not indicate an
    age-specific concern, say so instead of inventing one.

23. If no age group is supplied, do not guess the
    traveller's age group.

=========================================================
AGE GROUP INTERPRETATION
=========================================================

The traveller profile may contain one of these age groups:

- child
- young_adult
- adult
- senior

Use the supplied age group when generating the
age-specific recommendation.

IMPORTANT:

The age group itself does NOT determine the destination
risk score.

The destination risk score remains the SATARK score.

You are only explaining whether the CURRENT DESTINATION
CONDITIONS may create additional considerations for
that age group.

For example:

If the destination has supplied extreme heat information
and the traveller group is "senior", you may explain that
the current heat conditions could create additional
challenges for senior travellers.

If there is no relevant supplied condition, do not invent
an age-related concern.

=========================================================
MEDICAL CONDITIONS
=========================================================

The traveller may provide conditions such as:

- Asthma
- Diabetes
- Heart condition
- Respiratory condition
- Mobility limitations

Only discuss conditions actually supplied.

For example:

If "Asthma" is supplied and SATARK DATA contains
poor air-quality information, you may explain that
the supplied air-quality conditions may be relevant
to travellers with respiratory conditions.

Do NOT diagnose.

Do NOT prescribe.

Do NOT invent symptoms.

Do NOT invent medication.

Do NOT state that the traveller should stop or change
medical treatment.

When appropriate, recommend consulting a qualified
healthcare professional for individualized advice.

=========================================================
TRAVEL TIMING
=========================================================

The "when_to_travel" recommendation must be based ONLY
on the supplied forecast.

Do not invent better weather periods.

If the forecast does not provide enough information
to identify a safer period, say that the information
is unavailable.

=========================================================
TRAVELLER PROFILE
=========================================================

${JSON.stringify(
    {
        ageGroup,
        medicalConditions
    },
    null,
    2
)}

=========================================================
SATARK DATA
=========================================================

${JSON.stringify(
    satarkData,
    null,
    2
)}

=========================================================
OUTPUT
=========================================================

Return a concise, traveller-friendly personalized
safety assessment.

The age recommendation should answer:

"Given the CURRENT SATARK conditions, what should
someone in this age group know before travelling,
and why?"

The medical recommendation should answer:

"Given the CURRENT SATARK conditions and the listed
medical condition, what general precaution should
the traveller consider?"

Do NOT modify the SATARK risk score or risk level.
`;


    /*
    =====================================================
    GEMINI REQUEST WITH RETRY
    =====================================================
    */

    let response;

    const maxRetries = 3;

    for (
        let attempt = 1;
        attempt <= maxRetries;
        attempt++
    ) {

        try {

            response = await ai.models.generateContent({

                model: "gemini-3.5-flash-lite",

                contents: prompt,

                config: {

                    responseMimeType: "application/json",

                    responseSchema: {

                        type: "object",

                        properties: {

                            /*
                            ---------------------------------
                            OVERALL EXPLANATION
                            ---------------------------------
                            */

                            decision: {
                                type: "string",
                                description:
                                    "A concise travel recommendation based strictly on the existing SATARK risk level. Do not calculate or modify the risk score."
                            },

                            headline: {
                                type: "string",
                                description:
                                    "A short traveller-friendly headline describing the current SATARK assessment."
                            },

                            explanation: {
                                type: "string",
                                description:
                                    "Clear explanation of why the destination currently has its SATARK risk level."
                            },


                            /*
                            ---------------------------------
                            KEY RISKS
                            ---------------------------------
                            */

                            key_risks: {
                                type: "array",

                                items: {
                                    type: "string"
                                },

                                description:
                                    "The most important destination risks present in the supplied SATARK data."
                            },


                            /*
                            ---------------------------------
                            GENERAL ACTIONS
                            ---------------------------------
                            */

                            what_to_do: {
                                type: "array",

                                items: {
                                    type: "string"
                                },

                                description:
                                    "Practical travel precautions based only on the supplied SATARK conditions."
                            },


                            /*
                            ---------------------------------
                            AGE GROUP RECOMMENDATION
                            ---------------------------------
                            */

                            age_recommendation: {
                                type: "object",

                                properties: {

                                    status: {
                                        type: "string",

                                        description:
                                            "Age-group-specific recommendation such as Generally suitable, Extra caution, or Not recommended. It must be based only on supplied SATARK conditions."
                                    },

                                    reason: {
                                        type: "string",

                                        description:
                                            "Specific explanation of why the supplied destination conditions may affect the selected age group."
                                    }

                                },

                                required: [
                                    "status",
                                    "reason"
                                ]
                            },


                            /*
                            ---------------------------------
                            MEDICAL RECOMMENDATION
                            ---------------------------------
                            */

                            medical_recommendation: {
                                type: "object",

                                properties: {

                                    status: {
                                        type: "string",

                                        description:
                                            "General medical travel consideration such as No specific concern, Extra caution, or Consult a healthcare professional. Never diagnose or claim medical safety."
                                    },

                                    reason: {
                                        type: "string",

                                        description:
                                            "General destination-specific precaution relevant to the supplied medical conditions. Do not diagnose or prescribe treatment."
                                    }

                                },

                                required: [
                                    "status",
                                    "reason"
                                ]
                            },


                            /*
                            ---------------------------------
                            TRAVEL TIMING
                            ---------------------------------
                            */

                            when_to_travel: {
                                type: "string",

                                description:
                                    "Guidance about potentially safer travel timing based strictly on the supplied forecast. Do not invent timing."
                            },


                            /*
                            ---------------------------------
                            EMERGENCY ADVICE
                            ---------------------------------
                            */

                            emergency_advice: {
                                type: "string",

                                description:
                                    "Emergency-oriented advice based only on supplied official alerts and hazards."
                            }

                        },

                        required: [

                            "decision",

                            "headline",

                            "explanation",

                            "key_risks",

                            "what_to_do",

                            "age_recommendation",

                            "medical_recommendation",

                            "when_to_travel",

                            "emergency_advice"

                        ]

                    }

                }

            });


            /*
            -------------------------------------------------
            REQUEST SUCCEEDED
            -------------------------------------------------
            */

            break;


        } catch (error) {

            /*
            -------------------------------------------------
            RETRY TEMPORARY GEMINI ERRORS
            -------------------------------------------------
            */

            const status = error?.status;

            const retryable =
                status === 429 ||
                status === 500 ||
                status === 502 ||
                status === 503 ||
                status === 504;


            if (
                retryable &&
                attempt < maxRetries
            ) {

                const delay = attempt * 3000;

                console.warn(
                    `Gemini temporarily unavailable (${status}). ` +
                    `Retrying in ${delay / 1000}s...`
                );

                await new Promise(
                    resolve =>
                        setTimeout(resolve, delay)
                );

            } else {

                console.error(
                    "Gemini API error:",
                    error
                );

                throw error;
            }
        }
    }


    /*
    =====================================================
    VALIDATE RESPONSE
    =====================================================
    */

    if (!response) {
        throw new Error(
            "Gemini did not return a response"
        );
    }


    if (!response.text) {
        throw new Error(
            "Gemini returned an empty response"
        );
    }


    /*
    =====================================================
    PARSE GEMINI JSON
    =====================================================
    */

    let result;

    try {

        result = JSON.parse(response.text);

    } catch (parseError) {

        console.error(
            "Failed to parse Gemini JSON:",
            response.text
        );

        throw new Error(
            "Gemini returned invalid JSON"
        );
    }


    /*
    =====================================================
    SAFETY FALLBACKS
    =====================================================

    These make sure the frontend doesn't crash if Gemini
    returns an incomplete object.
    =====================================================
    */

    result.key_risks =
        Array.isArray(result.key_risks)
            ? result.key_risks
            : [];

    result.what_to_do =
        Array.isArray(result.what_to_do)
            ? result.what_to_do
            : [];


    result.age_recommendation =
        result.age_recommendation || {
            status: "Unavailable",
            reason:
                "Age-specific guidance is unavailable from the supplied data."
        };


    result.medical_recommendation =
        result.medical_recommendation || {
            status:
                medicalConditions.length > 0
                    ? "Unavailable"
                    : "No specific condition",
            reason:
                medicalConditions.length > 0
                    ? "Condition-specific guidance is unavailable from the supplied data."
                    : "No medical conditions were provided."
        };


    result.when_to_travel =
        result.when_to_travel ||
        "Travel timing guidance is unavailable from the supplied forecast.";


    result.emergency_advice =
        result.emergency_advice ||
        "Follow official local alerts and instructions if an emergency develops.";


    /*
    =====================================================
    RETURN RESULT
    =====================================================
    */

    return result;
}


module.exports = {
    generateRiskExplanation
};