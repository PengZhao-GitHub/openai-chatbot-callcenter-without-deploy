import { Configuration, OpenAIApi } from 'openai'
import { process } from './env'


const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
})


const openai = new OpenAIApi(configuration)

const chatbotConversation = document.getElementById('chatbot-conversation')
const clearButton = document.getElementById('clear-btn')

const conversationArr = [
    {
        role: 'system',
        //content: 'You are a highly knowledgeable assistant that is always happy to help. and you are humor and like to reply with jokes'       
        content: 'you are the call center staff member of the insurance company - AIG Sonpo. You are able to provide customers the information about their insurance policies, assist customers in navigating the claims process and provide guidance on how to file a claim, offer prompt and efficient insurance quotes to customers based on their specific needs, and connect customers with appropriate insurance agents for more personalized assistance, or direct them to the customer portal for self-service option. please give clear, short and concise responses. When customer asks for a quote, do not say no, but ask what insurance the cusotmer wants, and then ask for needed informaiton of the insurance, and then get the quote from PAS, and then provide the quote to customer. '
    }
]

clearButton.addEventListener('click', e => {
    e.preventDefault()
    conversationArr.splice(1)
    chatbotConversation.innerHTML = '<div class="speech speech-ai">How can I help you?</div>'

})

document.addEventListener('submit', async (e) => {
    e.preventDefault()

    // 1. Get the user input
    const userInput = document.getElementById('user-input')

    // 2. Add the user input to the conversation
    conversationArr.push({
        role: 'user',
        content: userInput.value
    })

    // 3. Show the user input to the conversation
    const newSpeechBubble = document.createElement('div')
    newSpeechBubble.classList.add('speech', 'speech-human')
    chatbotConversation.appendChild(newSpeechBubble)
    newSpeechBubble.textContent = userInput.value
    userInput.value = ''
    chatbotConversation.scrollTop = chatbotConversation.scrollHeight

    console.log(conversationArr)


    // 4. Get AI response
    const message = await fetchReply(conversationArr)

    // 5. Add the AI response to the conversation
    conversationArr.push(message);

    // 6. Render the AI response on the UI
    renderTypewriterText(message.content);


})


async function fetchReply(conversationArr) {

    // Invoke the OpenAI API for generating AI responses
    const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo-0613',
        messages: conversationArr,
        functions: [
            {
                name: "get_policy_information",
                description: "get auto quotation",
                parameters: {
                    type: "object",
                    properties: {
                        policy_number: {
                            type: "string",
                            description: "policy number"
                        },
                        policyholder: {
                            type: "object",
                            properties: {
                                name: {
                                    type: "string",
                                    description: "policyholder's name"
                                },
                                dob: {
                                    type: "string",
                                    description: "date of birth"
                                },
                                gender: {
                                    type: "string",
                                    description: "gender"
                                },
                                phone_number: {
                                    type: "string",
                                    description: "phone number"
                                }
                            },
                            required: ["name", "dob", "gender", "phone_number"]
                        }
                    },
                    required: ["policyholder"]
                }
            },

            {
                name: "file_FNOL",
                description: "Filing a First Notice of Loss (FNOL), report accident, make claims",
                parameters: {
                    type: "object",
                    properties: {
                        policyholder: {
                            type: "object",
                            properties: {
                                name: {
                                    type: "string",
                                    description: "policyholder's name"
                                },
                                policy_number: {
                                    type: "string",
                                    description: "policy number"
                                },
                                emal: {
                                    type: "string",
                                    description: "email address"
                                },
                                phone_number: {
                                    type: "string",
                                    description: "phone number"
                                }
                            },
                            required: ["name", "policy_number", "phone_number"]
                        },
                        loss: {
                            type: "object",
                            properties: {
                                date_time_of_loss: {
                                    type: "string",
                                    description: "Specific date and time when the incident or loss occurred."
                                },
                                description_of_loss: {
                                    type: "string",
                                    description: "Detailed account of what happened, including the cause, circumstances, and extent of the damage or loss."
                                },
                                location_of_loss: {
                                    type: "string",
                                    description: "Address or specific location where the incident occurred"
                                }
                            },
                            required: ["date_time_of_loss", "description_of_loss", "location_of_loss"]
                        }
                    },
                    required: ["policyholder", "loss"]
                }
            }
        ],
        function_call: "auto",
        presence_penalty: 0,
        frequency_penalty: 0.3,
        temperature: 0
    });

    const message = response.data.choices[0].message;

    // Step 2, check if the model wants to call a function
    if (message.function_call) {
        const function_name = message.function_call.name;
        console.log(`1. AI has decided to call the API ${function_name}`)

        // Get the JSON object created by the AI model
        const parameters = JSON.parse(message.function_call.arguments)
        console.log(`2. AI has created the parameters as ${JSON.stringify(parameters)}`)

        // Call the API
        let function_response = ""
        switch (function_name) {
            case "get_policy_information":
                function_response = get_policy_information(parameters)
                break
            case "file_FNOL":
                function_response = file_FNOL(parameters)
                break

        }

        console.log(`3. Call the API and get the result as " ${function_response} "`)


        // Step 4, send model the info on the function call and function response

        conversationArr.push({
            role: "function",
            name: function_name,
            content: function_response
        })

        console.log(conversationArr)
        const second_response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo-0613",
            messages: conversationArr,
            temperature: 0
        });

        return second_response.data.choices[0].message;
    }


    return response.data.choices[0].message


}

function get_policy_information(parameters) {
    console.log("Inside of the get_policy_information API", parameters)

    const requiredProperties = ['name', 'dob', 'gender', 'phone_number'];
    const missingProperties = [];

    for (const property of requiredProperties) {
        if (!parameters.policyholder[property] || parameters.policyholder[property] === "") {
            missingProperties.push(property);
        }
    }

    if (missingProperties.length === 0) {
        return "Your policy information is confirmed by our PAS system, and here is the detail: You have a property policy with JPY500,000 for fire.";
    } else {
        const errorMessage = `Personal information is not complete. The following properties are required: ${missingProperties.join(", ")}.`;
        return errorMessage;
    }
}

function file_FNOL(parameters) {
    console.log("Inside of the file_FNOL API", parameters)

    const requiredPolicyholderProperties = ['name', 'policy_number', 'phone_number'];
    const requiredLossProperties = ['date_time_of_loss', 'description_of_loss', 'location_of_loss'];
    const missingProperties = [];

    for (const property of requiredPolicyholderProperties) {
        if (!parameters.policyholder[property] || parameters.policyholder[property] === "") {
            missingProperties.push(property);
        }
    }

    for (const property of requiredLossProperties) {
        if (!parameters.loss[property] || parameters.loss[property] === "") {
            missingProperties.push(property);
        }
    }

    const policyholderFakeProperties = getFakeProperties(parameters.policyholder, conversationArr);
    const lossFakeProperties = getFakeProperties(parameters.loss, conversationArr);
    const fakeProperties = policyholderFakeProperties.concat(lossFakeProperties);

    console.log("fake properties:", fakeProperties)


    if (missingProperties.length === 0 && fakeProperties.length === 0) {
        return "we have confirmed you policy information and filled your claims. And your claims number is #777888999 ";
    } else {
        const errorMessage = `The following properties are required: ${missingProperties.join(", ")}, ${fakeProperties.join(", ")}.`;
        return errorMessage;
    }

}

async function get_quote() {
    const quote = "JPY 123456"
    return quote;

}


async function getCutsomerInfo(conversation) {
    // Call the OpenAI API to generate the summary
    const response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `Extract insurance product, trasacton type and cusotmer information from the ${conversation}. And then create a JSON object to show the information capatured. The format of the JSON object likes 
        {
            "insuranceProduct": "auto", 
            "transactionType": "quote",
            "customerInformation": {
                "name": "", 
                "age" : "" 
            }

        },`,
        max_tokens: 100,
        temperature: 0.5,
        n: 1,
        stop: null,
        temperature: 0.5,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
    })

    //console.log(response)

    // Extract the summary from the API response
    const summary = response.data.choices[0].text.trim();

    const parameters = JSON.parse(summary)
    console.log(parameters)

}

function renderTypewriterText(text) {
    const newSpeechBubble = document.createElement('div')
    newSpeechBubble.classList.add('speech', 'speech-ai', 'blinking-cursor')
    chatbotConversation.appendChild(newSpeechBubble)
    let i = 0
    const interval = setInterval(() => {
        newSpeechBubble.textContent += text.slice(i - 1, i)
        if (text.length === i) {
            clearInterval(interval)
            newSpeechBubble.classList.remove('blinking-cursor')
        }
        i++
        chatbotConversation.scrollTop = chatbotConversation.scrollHeight
    }, 50)
}


// Helper function
// ********************************************************************
function getFakeProperties(jsonObj, conversationArr) {
    const missingProperties = [];
    const userMessages = conversationArr.filter((message) => message.role === 'user');

    // Iterate over each property in the JSON object
    for (const [key, value] of Object.entries(jsonObj)) {
        console.log('Key:', key, 'Value:', value)
        // Check if the value exists in the conversation array
        const existsInConversation = userMessages.some((message) => {
            console.log('---> content:', message.content, " value", value)
            if (message.content && message.content.includes(value)) {
                return true;
            }
            return false;
        });

        // If the value is not found, add the property name to the missingProperties array
        if (!existsInConversation) {
            missingProperties.push(key);
        }
    }

    return missingProperties;
}