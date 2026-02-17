import os
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_login import LoginManager, login_user, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from models import db, Booking, User, Club
from auth import roles_required, can_club_book

app = Flask(__name__, template_folder="../templates", static_folder="../static")

# --- Database Config ---
database_url = os.environ.get("DATABASE_URL")
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret")

db.init_app(app)

login_manager = LoginManager(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ---------- ROUTES ----------

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/setup")
def setup():
    db.create_all()
    if not Club.query.first():
        club = Club(name="ACM Amity")
        db.session.add(club)
        db.session.commit()

        admin = User(
            username="admin",
            password=generate_password_hash("admin123"),
            role="club_admin",
            club_id=club.id
        )
        db.session.add(admin)
        db.session.commit()
        return "Database initialized!"
    return "Already initialized."

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    user = User.query.filter_by(username=data["username"]).first()
    if user and check_password_hash(user.password, data["password"]):
        login_user(user)
        return jsonify({"message": "Logged in", "role": user.role})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/api/availability")
def availability():
    try:
        date = datetime.strptime(request.args.get("date"), "%Y-%m-%d").date()
        slot = int(request.args.get("slot_id"))

        bookings = Booking.query.filter_by(date=date, slot_id=slot).all()

        result = {}
        for b in bookings:
            result[b.location_id] = {
                "club": b.club.name,
                "event": b.event_name,
                "summary": b.summary
            }

        return jsonify(result)
    except:
        return jsonify({"error": "Invalid request"}), 400

@app.route("/api/book", methods=["POST"])
@roles_required("club_admin", "super_admin")
def book():
    data = request.json
    date = datetime.strptime(data["date"], "%Y-%m-%d").date()

    if current_user.role == "club_admin":
        if not can_club_book(current_user.club_id, date):
            return jsonify({"error": "2 slot daily limit reached"}), 400

    try:
        booking = Booking(
            event_name=data["event_name"],
            summary=data.get("summary", ""),
            location_id=data["location_id"],
            slot_id=data["slot_id"],
            date=date,
            club_id=current_user.club_id
        )
        db.session.add(booking)
        db.session.commit()
        return jsonify({"message": "Booked successfully"}), 201
    except:
        db.session.rollback()
        return jsonify({"error": "Slot already taken"}), 409

# Required for Vercel
app = app
