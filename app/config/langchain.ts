import { ChatOpenAI } from "@langchain/openai";
import 'react-native-polyfill-globals/auto';
import 'react-native-url-polyfill/auto';

// Initialize the OpenAI model
export const openAIModel = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: "gpt-3.5-turbo",
});


// You can add more LangChain configurations here as needed 