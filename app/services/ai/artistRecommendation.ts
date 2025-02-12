import { GENRES, MOODS } from '../../constants/musicPreferences';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export interface ArtistRecommendation {
    name: string;
    genre: string;
    mood: string;
    confidence: number;
    reasoning: string;
}

export const getArtistRecommendations = async (
    preferredGenres: string[],
    preferredMoods: string[],
    limit: number = 5
): Promise<ArtistRecommendation[]> => {
    try {
        console.log('Debug - Artist Recommendations Input:', {
            receivedGenres: preferredGenres,
            receivedMoods: preferredMoods,
            validGenresList: GENRES.map(g => g.toLowerCase()),
            validMoodsList: MOODS.map(m => m.toLowerCase())
        });

        // Validate inputs against known genres and moods
        const validGenres = preferredGenres.filter(genre => {
            const isValid = GENRES.map(g => g.toLowerCase()).includes(genre.toLowerCase());
            if (!isValid) {
                console.log(`Invalid genre found: ${genre}`);
            }
            return isValid;
        });
        
        const validMoods = preferredMoods.filter(mood => {
            const isValid = MOODS.map(m => m.toLowerCase()).includes(mood.toLowerCase());
            if (!isValid) {
                console.log(`Invalid mood found: ${mood}`);
            }
            return isValid;
        });

        console.log('Debug - Validation Results:', {
            validGenresCount: validGenres.length,
            validMoodsCount: validMoods.length,
            validGenres,
            validMoods
        });

        if (validGenres.length === 0 || validMoods.length === 0) {
            throw new Error('No valid genres or moods provided');
        }

        // Create the messages array
        const messages = [
            {
                role: "system",
                content: `You are an expert music curator who understands various genres and moods. 
Your task is to recommend artists based on the user's preferred genres and moods.
Provide recommendations in a structured format that includes the artist name, primary genre, typical mood, 
and a brief reasoning for the recommendation. Focus on both popular and emerging artists.

Valid genres: ${GENRES.join(', ')}
Valid moods: ${MOODS.join(', ')}

IMPORTANT: Your response must be a valid JSON array. Do not include any additional text before or after the JSON.`
            },
            {
                role: "user",
                content: `Based on the following preferences:
Genres: ${validGenres.join(', ')}
Moods: ${validMoods.join(', ')}

Please recommend ${limit} artists. For each artist, provide:
1. Artist name
2. Primary genre (MUST be one of their preferred genres)
3. Typical mood (MUST be one of their preferred moods)
4. Confidence score (0-1)
5. Brief reasoning for recommendation

Your response MUST be a valid JSON array of objects with these fields: name, genre, mood, confidence, reasoning
Do not include any additional text or explanation outside the JSON array.`
            }
        ];

        console.log('Making OpenAI request with messages:', JSON.stringify(messages, null, 2));

        // Make the API request
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages,
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Raw OpenAI response:', JSON.stringify(data, null, 2));

        const content = data.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No content in OpenAI response');
        }

        console.log('Content to parse:', content);

        let recommendations: ArtistRecommendation[];
        try {
            // First try to parse the content directly
            const parsed = JSON.parse(content);
            
            // Handle both array and object formats
            recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations || [];

            if (!Array.isArray(recommendations)) {
                throw new Error('Response is not in the expected format');
            }
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Failed to parse content:', content);
            throw new Error('Failed to parse AI response as JSON');
        }

        // Validate and clean the recommendations
        const validatedRecommendations = recommendations
            .filter(rec => {
                const isValid = rec.name && 
                    validGenres.includes(rec.genre.toLowerCase()) && 
                    validMoods.includes(rec.mood.toLowerCase()) &&
                    typeof rec.confidence === 'number' &&
                    rec.confidence >= 0 &&
                    rec.confidence <= 1;
                
                if (!isValid) {
                    console.log('Invalid recommendation:', rec);
                }
                return isValid;
            })
            .slice(0, limit);

        if (validatedRecommendations.length === 0) {
            throw new Error('No valid recommendations received from AI');
        }

        console.log('Final validated recommendations:', validatedRecommendations);
        return validatedRecommendations;
    } catch (error) {
        console.error('Error getting artist recommendations:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to get artist recommendations: ${error.message}`);
        }
        throw new Error('Failed to get artist recommendations');
    }
}; 