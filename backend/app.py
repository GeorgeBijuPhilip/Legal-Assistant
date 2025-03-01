from flask import Flask, request, jsonify
from flask_cors import CORS
import groq
from flask import request, jsonify
import base64

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Replace "your_groq_api_key" with your actual Groq API key
client = groq.Client(api_key="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")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message")

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    # Call the Groq API
    try:
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "user", "content": user_message}]
        )
        bot_message = response.choices[0].message.content
        return jsonify({"response": bot_message})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5000)



@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "File is required"}), 400

    # Convert the file to a base64 string
    file_data = file.read()
    file_base64 = base64.b64encode(file_data).decode("utf-8")

    return jsonify({"file": file_base64, "filename": file.filename})