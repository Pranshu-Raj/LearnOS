import os
from google import genai
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

class Topic(BaseModel):
    topic: str = Field(description="The title of the topic")
    slug: str = Field(description="A file-safe slug for the topic (e.g. gradient-descent)")
    estimated_minutes: int = Field(description="Estimated time to learn this topic in minutes")
    feynman_prompt: str = Field(description="A specific prompt to test the user's understanding using the Feynman technique")

class Curriculum(BaseModel):
    goal: str = Field(description="The overarching learning goal")
    topics: list[Topic] = Field(description="The list of sequenced topics to achieve the goal")

def generate_curriculum(goal: str, deadline: str, hours_per_day: float) -> Curriculum:
    """
    Calls the Gemini API and strictly enforces the JSON schema defined by the Curriculum model.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise ValueError("GEMINI_API_KEY not found or invalid in .env file.")
        
    client = genai.Client(api_key=api_key)
    
    prompt = f"""
    You are an expert learning planner.
    The user wants to achieve this goal: "{goal}"
    Deadline: {deadline}
    Time available: {hours_per_day} hours per day.
    
    Break this down into a sequenced curriculum of topics. 
    For each topic, provide a realistic estimated time in minutes.
    Also provide a specific Feynman technique prompt (e.g., 'Explain X simply to a 5-year-old, where did you get stuck?').
    """
    
    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=Curriculum,
        ),
    )
    
    # Parse the strict JSON response into our Pydantic model
    return Curriculum.model_validate_json(response.text)
