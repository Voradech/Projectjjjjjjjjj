import os
import json
import random # เพิ่มสำหรับจำลองผลลัพธ์
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from datetime import datetime, timedelta

# 🚩 Note: ในระบบจริง ต้องมี try/except สำหรับ import พวก ML library
# import pickle
# import tensorflow as tf 

# -------------------------------------------------------------------
# GLOBAL IN-MEMORY STORAGE AND MODELS
# -------------------------------------------------------------------
users_db = {} 
next_user_id = 1 
news_db = {}
next_news_id = 1
prediction_models = {} # Dictionary สำหรับเก็บ Model ที่โหลดเข้ามา

# -------------------------------------------------------------------
# 1. CONFIGURATION
# -------------------------------------------------------------------
app = Flask(__name__)
CORS(app) 
bcrypt = Bcrypt(app) 

# -------------------------------------------------------------------
# 2. HELPER FUNCTIONS & INITIALIZERS
# -------------------------------------------------------------------

def load_prediction_models():
    """โหลด Model ทั้ง 3 ตัวเข้าสู่ Memory (Eager Loading)"""
    global prediction_models
    print("--- 🧠 Loading AI Models Eagerly ---")
    
    # --- Logic การโหลด Model จริงๆ จะอยู่ที่นี่ ---
    
    try:
        # 🚩 ในการใช้งานจริง ควรใช้: prediction_models['rf'] = pickle.load(open('path/rf_model.pkl', 'rb'))
        prediction_models['rf'] = "RandomForest_Model_Ready" 
        prediction_models['gb'] = "GradientBoosting_Model_Ready"
        prediction_models['lstm'] = "LSTM_Model_Ready" 
        print(f"✅ Loaded {len(prediction_models)} models successfully.")
    except Exception as e:
        print(f"⚠️ ERROR: Failed to load models. Check file paths. {e}")
        
    print("---------------------------------------")

def create_initial_data():
    """สร้างข้อมูลเริ่มต้น (Admin, News) ใน Memory"""
    global next_user_id, next_news_id, users_db, news_db
    
    # 1. สร้าง Admin Account
    if not any(user['username'] == 'admin' for user in users_db.values()):
        admin_password_hash = bcrypt.generate_password_hash('password').decode('utf-8')
        admin_user = {
            'id': next_user_id,
            'username': 'admin',
            'email': 'admin@predict.finance',
            'role': 'admin',
            'password': admin_password_hash
        }
        users_db[admin_user['id']] = admin_user
        next_user_id += 1
        print("Default admin account created: Username=admin, Role=admin")

    # 2. สร้างข่าวสารเริ่มต้น
    if not news_db:
        news_item1 = {
            'id': next_news_id,
            'title': 'BTC Analysis Report: Bullish Trend Expected',
            'content': 'Market data suggests a strong upward movement in the next 7 days.',
            'date': (datetime.utcnow() - timedelta(days=1)).isoformat().split('T')[0],
            'status': 'Published'
        }
        news_db[news_item1['id']] = news_item1
        next_news_id += 1
        
        news_item2 = {
            'id': next_news_id,
            'title': 'Testing New LSTM Model',
            'content': 'The new LSTM model shows promising accuracy but is still in testing phase.',
            'date': datetime.utcnow().isoformat().split('T')[0],
            'status': 'Draft'
        }
        news_db[news_item2['id']] = news_item2
        next_news_id += 1

def find_user(username=None, email=None):
    """ค้นหาผู้ใช้จาก memory"""
    for user in users_db.values():
        if username and user['username'] == username:
            return user
        if email and user.get('email') == email:
            return user
    return None

# -------------------------------------------------------------------
# 3. NEWS API ENDPOINTS
# -------------------------------------------------------------------

# Endpoint นี้ยังไม่ได้ปรับให้มีการตรวจสอบสิทธิ์ (Admin/User) ซึ่งควรทำในขั้นตอนต่อไป
@app.route('/api/news', methods=['GET', 'POST'])
def handle_news():
    global news_db, next_news_id
    
    if request.method == 'POST':
        data = request.get_json()
        if not data or 'title' not in data or 'content' not in data:
             return jsonify({'message': 'Missing required fields (title, content)'}), 400

        new_id = next_news_id
        new_news = {
            'id': new_id,
            'title': data['title'],
            'content': data['content'],
            'date': datetime.utcnow().isoformat().split('T')[0],
            'status': data.get('status', 'Draft')
        }
        news_db[new_id] = new_news
        next_news_id += 1
        return jsonify(new_news), 201

    # GET
    news_list = list(news_db.values())
    return jsonify(news_list)

# ... (handle_single_news - สามารถปรับปรุงต่อได้ตามหลักการจัดการ Error)


# -------------------------------------------------------------------
# 4. AUTHENTICATION & USER MANAGEMENT ENDPOINTS
# -------------------------------------------------------------------

@app.route('/api/register', methods=['POST'])
def register():
    """สมัครสมาชิก"""
    global next_user_id
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email', None)

    if not username or not password:
        return jsonify({'message': 'Missing username or password'}), 400

    if find_user(username=username):
        return jsonify({'message': 'Username already exists'}), 409
    if email and find_user(email=email):
        return jsonify({'message': 'Email already exists'}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    new_user = {
        'id': next_user_id,
        'username': username,
        'password': hashed_password,
        'email': email,
        'role': 'user'
    }

    users_db[new_user['id']] = new_user
    next_user_id += 1
    
    return jsonify({'message': 'Registration successful'}), 201


@app.route('/api/login', methods=['POST'])
def login():
    """ล็อกอิน"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = find_user(username=username)

    if user and bcrypt.check_password_hash(user['password'], password):
        return jsonify({
            'message': 'Login successful',
            'username': user['username'],
            'user_id': user['id'],
            'role': user['role'] 
        }), 200
    else:
        return jsonify({'message': 'Invalid username or password'}), 401


@app.route('/api/users', methods=['GET'])
def get_all_users():
    """ดึงข้อมูลผู้ใช้ทั้งหมด (สำหรับ Admin)"""
    user_list = []
    for user in users_db.values():
        user_data = user.copy()
        user_data.pop('password', None)
        user_list.append(user_data)
        
    return jsonify(user_list)


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """ลบผู้ใช้ด้วย ID (สำหรับ Admin)"""
    global users_db
    
    user = users_db.get(user_id)
    
    if not user:
        return jsonify({'message': f'User with ID {user_id} not found'}), 404

    # ป้องกันการลบ Admin account ตัวเอง (ถ้า user_id คือ 1)
    if user_id == 1 and user['username'] == 'admin':
         return jsonify({'message': 'Cannot delete the primary admin account'}), 403

    del users_db[user_id]
    return jsonify({'message': f'User {user["username"]} (ID: {user_id}) deleted successfully'}), 200

# -------------------------------------------------------------------
# 5. PREDICTION API ENDPOINT (ปรับปรุงการจำลองผลลัพธ์)
# -------------------------------------------------------------------

@app.route('/api/predict', methods=['POST'])
def predict():
    """Endpoint สำหรับรับ Input และคืนผลลัพธ์การทำนาย"""
    if not prediction_models:
        # 503 Service Unavailable เมื่อ Model โหลดไม่สำเร็จ
        return jsonify({'error': 'Prediction service is temporarily unavailable.'}), 503

    data = request.get_json()
    input_features = data.get('features') # เช่น [btc_price_7d_ago, rsi_val, macd_val]

    if not input_features or not isinstance(input_features, list) or len(input_features) < 3:
        return jsonify({
            'error': 'Invalid input. Expecting a list of features (e.g., [price, rsi, macd]).'
        }), 400

    results = {}
    total_prediction = 0
    model_count = 0
    
    # Base Price สำหรับการจำลองผลลัพธ์ (ดึงจาก Input ล่าสุด)
    try:
        base_price = input_features[0] # สมมติว่า Feature ตัวแรกคือราคา BTC ปัจจุบัน
        if not isinstance(base_price, (int, float)) or base_price <= 0:
             raise ValueError("Base price is invalid.")
    except Exception:
        return jsonify({'error': 'Invalid base price feature.'}), 400

    # วนลูปเรียกใช้งาน Model แต่ละตัว
    for name, model_instance in prediction_models.items():
        try:
            # 🚩 โค้ดจริงจะอยู่ที่นี่: prediction = model_instance.predict([input_features])[0] 
            
            # การจำลองผลลัพธ์ (เพิ่มความ random เล็กน้อย)
            factor = 1.0 + random.uniform(-0.02, 0.03) # แกว่งตัว +/- 2% ถึง 3%
            
            if name == 'rf':
                prediction = base_price * factor
            elif name == 'gb':
                prediction = base_price * (factor - 0.005)
            elif name == 'lstm':
                prediction = base_price * (factor + 0.01)
            else:
                prediction = base_price * factor
            
            results[name] = round(prediction, 2)
            total_prediction += prediction
            model_count += 1
            
        except Exception as e:
            # ถ้า Model ใดมีปัญหา จะบันทึก error ไว้ แต่ยังคงประมวลผล Model อื่น
            results[name] = f'Prediction Error: {e}'

    # คำนวณผลลัพธ์รวม (Average)
    final_prediction = total_prediction / model_count if model_count > 0 else base_price
    
    return jsonify({
        'status': 'success',
        'input_data': input_features,
        'individual_predictions': results,
        'final_prediction': round(final_prediction, 2),
        'message': f'Prediction completed using {model_count} models.'
    }), 200


# -------------------------------------------------------------------
# 6. SERVER RUNNER
# -------------------------------------------------------------------

if __name__ == '__main__':
    # 1. โหลด Model เข้า Memory ก่อนรัน Server
    load_prediction_models() 
    
    # 2. สร้างข้อมูลเริ่มต้นใน Memory
    create_initial_data() 
    
    print(f"\n--- API Status ---\n")
    print(f"Users in Memory: {len(users_db)}")
    print(f"News in Memory: {len(news_db)}")
    print(f"Prediction Models Loaded: {', '.join(prediction_models.keys()) if prediction_models else 'None'}")
    print(f"\nFlask API running on http://127.0.0.1:5000 (In-Memory Mode)")
    
    app.run(debug=True, port=5000)