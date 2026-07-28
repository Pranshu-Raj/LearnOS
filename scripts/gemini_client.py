import os
from google import genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def generate_curriculum(goal: str) -> str:
    """
    Sends a learning goal to Gemini and requests a structured curriculum.
    This uses the new google-genai SDK.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise ValueError("GEMINI_API_KEY not found or invalid in .env file.")
    
    # Initialize the new SDK client
    client = genai.Client(api_key=api_key)
    
    prompt = f"""
    You are an expert learning planner. 
    The user wants to achieve the following learning goal: "{goal}"
    
    Please provide a high-level breakdown of the topics required to achieve this goal.
    Respond in a structured JSON format containing a list of topics.
    """
    
    try:
        print("Waiting for response from Gemini API...")
        # Using gemini-3.5-flash for the latest model capabilities
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        print(f"Error communicating with Gemini API: {e}")
        return None

if __name__ == "__main__":
    print("--- Vault Coach: Gemini API Connection Test ---")
    test_goal = "Learn the basics of Python in 7 days"
    print(f"Sending Test Goal: {test_goal}\n")
    
    result = generate_curriculum(test_goal)
    if result:
        print("--- API Response Received Successfully ---")
        print(result)
