from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user') # 'user', 'club_admin', 'super_admin'
    club_id = db.Column(db.Integer, db.ForeignKey('club.id'), nullable=True)

class Club(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    bookings = db.relationship('Booking', backref='club', lazy=True)

class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_name = db.Column(db.String(100), nullable=False)
    summary = db.Column(db.Text, nullable=True)
    location_id = db.Column(db.String(50), nullable=False) # e.g., 'loc_auditorium'
    slot_id = db.Column(db.Integer, nullable=False)       # 1-5
    date = db.Column(db.Date, nullable=False)
    club_id = db.Column(db.Integer, db.ForeignKey('club.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # CRITICAL: Database-level prevention of double booking
    __table_args__ = (
        UniqueConstraint('location_id', 'slot_id', 'date', name='_location_slot_date_uc'),
    )