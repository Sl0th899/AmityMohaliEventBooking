import os
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, current_user, login_user, logout_user
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, Booking, User, Club
from auth import roles_required, can_club_book

app = Flask(__name__)

# --- Database Config for Render vs Local ---
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///local.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-123')

# --- Init Extensions ---
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
login_manager = LoginManager(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/availability', methods=['GET'])
def get_availability():
    """Returns status of all locations for a specific date and slot."""
    try:
        target_date = datetime.strptime(request.args.get('date'), '%Y-%m-%d').date()
        target_slot = int(request.args.get('slot_id'))
        
        bookings = Booking.query.filter_by(date=target_date, slot_id=target_slot).all()
        
        # Transform into a map: { 'loc_auditorium': { details } }
        results = {}
        for b in bookings:
            results[b.location_id] = {
                "status": "booked",
                "club": b.club.name,
                "event": b.event_name,
                "summary": b.summary
            }
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/book', methods=['POST'])
@roles_required('club_admin', 'super_admin')
def create_booking():
    data = request.json
    try:
        b_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        
        # Rule of 2 Check
        if current_user.role == 'club_admin':
            if not can_club_book(current_user.club_id, b_date):
                return jsonify({"error": "Daily limit reached (2 slots max)"}), 400

        # Create Booking
        new_booking = Booking(
            event_name=data['event_name'],
            summary=data.get('summary', ''),
            location_id=data['location_id'],
            slot_id=data['slot_id'],
            date=b_date,
            club_id=current_user.club_id
        )
        db.session.add(new_booking)
        db.session.commit()

        # Real-time Broadcast to all connected clients
        socketio.emit('map_update', {
            'location_id': data['location_id'],
            'slot_id': data['slot_id'],
            'date': data['date'],
            'status': 'booked',
            'club_name': current_user.club.name,
            'event_name': data['event_name']
        })

        return jsonify({"message": "Booking successful"}), 201

    except Exception as e:
        db.session.rollback()
        # This catches the UniqueConstraint violation (Double Booking)
        return jsonify({"error": "Slot already taken"}), 409

# --- Setup Route (Run this once after deploying) ---
@app.route('/setup')
def setup():
    db.create_all()
    if not Club.query.first():
        # Create Dummy Data
        acm = Club(name="ACM Amity")
        db.session.add(acm)
        db.session.commit()
        
        # Create Admin User (Password: admin123)
        admin = User(username="admin", password=generate_password_hash("admin123"), role="club_admin", club_id=acm.id)
        db.session.add(admin)
        db.session.commit()
        return "Database Initialized with Admin User!"
    return "Database already exists."

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user and check_password_hash(user.password, data['password']):
        login_user(user)
        return jsonify({"message": "Logged in", "role": user.role, "club": user.club.name if user.club else "Admin"})
    return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    socketio.run(app)