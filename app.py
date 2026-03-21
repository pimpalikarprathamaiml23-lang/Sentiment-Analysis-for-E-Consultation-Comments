import streamlit as st
import pandas as pd
import plotly.express as px
from textblob import TextBlob

# --- PAGE CONFIG ---
st.set_page_config(page_title="E-Consultation Sentiment Dashboard", layout="wide")

# --- CUSTOM CSS ---
st.markdown("""
    <style>
    .main { background-color: #f5f7f9; }
    .stButton>button { width: 100%; border-radius: 5px; height: 3em; background-color: #007bff; color: white; }
    </style>
    """, unsafe_allow_html=True)

# --- SIDEBAR NAVIGATION ---
st.sidebar.title("🔍 Navigation")
page = st.sidebar.radio("Go to:", ["Live Analysis", "Trends Dashboard", "About Project"])

# --- FUNCTION: ANALYZE SENTIMENT ---
def get_sentiment(text):
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    if polarity > 0:
        return "Positive", "🟢", polarity
    elif polarity < 0:
        return "Negative", "🔴", polarity
    else:
        return "Neutral", "🟡", polarity

# --- PAGE 1: LIVE ANALYSIS ---
if page == "Live Analysis":
    st.title("📱 E-Consultation Comment Analyzer")
    st.write("Enter patient feedback below to analyze the emotional tone.")
    
    user_input = st.text_area("Patient Comment:", placeholder="e.g., The doctor was very helpful and the wait time was short.")
    
    if st.button("Analyze Sentiment"):
        if user_input:
            label, icon, score = get_sentiment(user_input)
            st.subheader(f"Result: {icon} {label}")
            st.progress((score + 1) / 2) # Normalizing -1 to 1 into 0 to 1
            st.write(f"Confidence Score: {abs(score):.2f}")
        else:
            st.warning("Please enter some text first!")

# --- PAGE 2: TRENDS DASHBOARD ---
elif page == "Trends Dashboard":
    st.title("📊 Consultation Trend Analysis")
    
    # Mock Data for your PBL (Replace this with your CSV data later)
    data = {
        'Category': ['Cardiology', 'General', 'Pediatrics', 'Dental', 'Skin'],
        'Positive': [45, 80, 30, 20, 55],
        'Negative': [10, 15, 5, 12, 8]
    }
    df = pd.DataFrame(data)

    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Sentiment by Department")
        fig = px.bar(df, x='Category', y=['Positive', 'Negative'], barmode='group',
                     color_discrete_map={'Positive': 'green', 'Negative': 'red'})
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("Overall Feedback Split")
        fig2 = px.pie(df, values='Positive', names='Category', hole=0.4)
        st.plotly_chart(fig2, use_container_width=True)

# --- PAGE 3: ABOUT ---
else:
    st.title("ℹ️ About SentiGov")
    st.info("This project is a Sentiment Analysis tool designed for E-Consultation platforms to monitor patient satisfaction and identify service gaps.")
