from functools import wraps
from flask import jsonify
from flask_login import current_user
from models import Booking

def roles_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not current_user.is_authenticated or current_user.role not in roles:
                return jsonify({"error": "Unauthorized"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def can_club_book(club_id, booking_date):
    count = Booking.query.filter_by(club_id=club_id, date=booking_date).count()
    return count < 2
