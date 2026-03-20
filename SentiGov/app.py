"""
SIH E-Consultation Sentiment Analysis Backend
Flask + TensorFlow

Setup:
  pip install flask flask-cors tensorflow numpy scikit-learn

Run:
  python app.py

Access from mobile via ngrok:
  ngrok http 5000
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import re
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allow requests from any origin (needed for mobile access)

# ============================================================
# TensorFlow Model (loads lazily on first request)
# ============================================================
model = None
tokenizer_word_index = None

def get_model():
    """Load or build the TensorFlow sentiment model."""
    global model, tokenizer_word_index
    if model is not None:
        return model

    import tensorflow as tf
    from tensorflow.keras.preprocessing.text import Tokenizer
    from tensorflow.keras.preprocessing.sequence import pad_sequences
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Embedding, LSTM, Dense, Dropout, Bidirectional, GlobalMaxPooling1D

    print("Building TensorFlow model...")

    # ---- Training Data (e-consultation style) ----
    texts = [
        # Positive
        "The new health policy is excellent and very helpful for rural citizens",
        "Great initiative by the government to improve public services",
        "The e-consultation portal is very user friendly and efficient",
        "I appreciate the quick response from the officials",
        "This scheme has benefited thousands of farmers in our district",
        "The infrastructure development is commendable and well planned",
        "Excellent work on digitizing government services for citizens",
        "The water supply improvement project is very beneficial",
        "I love how the government is addressing public grievances",
        "Very positive impact on education in rural areas",
        "The new scheme is outstanding and helps the poor",
        "Amazing effort to make services accessible to everyone",
        "The policy is well designed and helps the marginalized",
        "Great support from the administration during the crisis",
        "Highly satisfied with the implementation of this project",
        "The digital initiative is revolutionary and inclusive",

        # Negative
        "This is a complete waste of public money and resources",
        "The roads are in terrible condition even after the project",
        "Government officials are corrupt and not helping citizens",
        "Very poor implementation and no accountability at all",
        "The scheme is a total failure and has not helped anyone",
        "Disgusting behavior from local authorities towards citizens",
        "The hospital has deteriorated and lacks basic medicines",
        "No action taken despite multiple complaints and petitions",
        "This is utter corruption and the funds are being misused",
        "The policy is completely useless and harmful to farmers",
        "Pathetic service quality and officials are very rude",
        "Nobody is answerable for this disaster and failure",
        "The project is delayed by years with no explanation",
        "Citizens are suffering due to government negligence",
        "Extremely disappointed with the administration's response",
        "The water crisis is worsening due to poor management",

        # Neutral
        "The government has announced a new consultation period",
        "Officials will review the proposals submitted by citizens",
        "The project timeline has been extended to next quarter",
        "A meeting was held to discuss the implementation plan",
        "The committee will evaluate all feedback received",
        "Citizens can submit their comments until the deadline",
        "The policy document is available for public viewing",
        "The review process is currently underway as scheduled",
        "A report will be published after the consultation ends",
        "The scheme applies to citizens above 18 years of age",
        "The portal will be updated with new features soon",
        "Officials are collecting data from all districts",
        "The budget allocation will be decided in next meeting",
        "Public hearing is scheduled for the coming month",
        "The forms can be submitted online or at offices",
        "Additional guidelines will be issued by the department",
    ]

    labels = (
        [0] * 16 +  # Positive
        [1] * 16 +  # Negative
        [2] * 16    # Neutral
    )

    # ---- Tokenizer ----
    tokenizer = Tokenizer(num_words=5000, oov_token="<OOV>")
    tokenizer.fit_on_texts(texts)
    tokenizer_word_index = tokenizer

    MAX_LEN = 30
    sequences = tokenizer.texts_to_sequences(texts)
    padded = pad_sequences(sequences, maxlen=MAX_LEN, padding='post', truncating='post')
    y = tf.keras.utils.to_categorical(labels, num_classes=3)

    # ---- Model Architecture ----
    model = Sequential([
        Embedding(input_dim=5000, output_dim=64, input_length=MAX_LEN),
        Bidirectional(LSTM(64, return_sequences=True)),
        GlobalMaxPooling1D(),
        Dropout(0.3),
        Dense(64, activation='relu'),
        Dropout(0.3),
        Dense(3, activation='softmax')
    ])

    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    # Train quickly on our small dataset
    model.fit(padded, y, epochs=30, batch_size=8, verbose=0)
    print("✅ Model trained and ready!")
    return model


def predict_sentiment(text):
    """Run inference on input text."""
    from tensorflow.keras.preprocessing.sequence import pad_sequences

    global tokenizer_word_index
    m = get_model()
    tok = tokenizer_word_index

    MAX_LEN = 30
    seq = tok.texts_to_sequences([text])
    padded = pad_sequences(seq, maxlen=MAX_LEN, padding='post', truncating='post')

    probs = m.predict(padded, verbose=0)[0]  # [pos, neg, neu]
    idx = int(np.argmax(probs))
    labels = ['POSITIVE', 'NEGATIVE', 'NEUTRAL']

    return {
        'sentiment': labels[idx],
        'confidence': {
            'positive': float(round(probs[0], 4)),
            'negative': float(round(probs[1], 4)),
            'neutral':  float(round(probs[2], 4)),
        },
        'keywords': extract_keywords(text)
    }


def extract_keywords(text):
    """Simple keyword extraction."""
    stopwords = {
        'the','is','a','an','and','or','for','to','of','in','this','that',
        'it','was','are','i','we','be','with','on','at','by','has','have',
        'been','not','no','very','will','from','they','their','there','our'
    }
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    seen = set()
    keywords = []
    for w in words:
        if w not in stopwords and w not in seen:
            keywords.append(w)
            seen.add(w)
        if len(keywords) >= 6:
            break
    return keywords


# ============================================================
# ROUTES
# ============================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'SentiGov API is running'})


@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing "text" field'}), 400

    text = data['text'].strip()
    if not text:
        return jsonify({'error': 'Text cannot be empty'}), 400
    if len(text) > 2000:
        return jsonify({'error': 'Text too long (max 2000 chars)'}), 400

    result = predict_sentiment(text)
    result['timestamp'] = datetime.now().isoformat()
    result['text'] = text[:200]  # echo back truncated
    return jsonify(result)


@app.route('/analyze-bulk', methods=['POST'])
def analyze_bulk():
    data = request.get_json()
    if not data or 'comments' not in data:
        return jsonify({'error': 'Missing "comments" array'}), 400

    comments = data['comments'][:100]  # limit to 100
    results = []
    summary = {'POSITIVE': 0, 'NEGATIVE': 0, 'NEUTRAL': 0}

    for comment in comments:
        r = predict_sentiment(str(comment))
        results.append(r)
        summary[r['sentiment']] += 1

    return jsonify({
        'results': results,
        'summary': summary,
        'total': len(results)
    })


# ============================================================
# RUN
# ============================================================
if __name__ == '__main__':
    print("=" * 50)
    print("  SIH E-Consultation Sentiment Analyzer")
    print("  Backend: Flask + TensorFlow")
    print("=" * 50)
    print("\n📱 To access from mobile:")
    print("   1. Run: ngrok http 5000")
    print("   2. Copy the https://xxxx.ngrok.io URL")
    print("   3. Set API_BASE in index.html to that URL")
    print("   4. Open the URL on your phone!\n")
    app.run(host='0.0.0.0', port=5000, debug=True)

