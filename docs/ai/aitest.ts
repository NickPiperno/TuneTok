import dotenv from "dotenv";
dotenv.config();

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Manually pass LangSmith settings
process.env.LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT || "TuneTok";

// Tracing will now automatically send data to LangSmith
const llm = new ChatOpenAI();

async function testAI() {
    try {
        const chat = new ChatOpenAI({
            temperature: 0.7,
            modelName: "gpt-3.5-turbo",
            openAIApiKey: process.env.OPENAI_API_KEY,
        });

        const response = await chat.invoke([
            new SystemMessage(
                "You are a helpful assistant that provides concise responses."
            ),
            new HumanMessage("What is the capital of France?"),
        ]);

        console.log("AI Response:", response.content);
    } catch (error) {
        console.error("Error in AI test:", error);
    }
}

// Export the test function
export { testAI };

// Run the test if this file is executed directly
if (require.main === module) {
    testAI().catch(console.error);
}
