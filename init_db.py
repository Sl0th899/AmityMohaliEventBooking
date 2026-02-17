from app import app
from models import db, User, Club

with app.app_context():
    db.create_all()
    
    # Create a test club
    if not Club.query.filter_by(name="ACM Amity").first():
        new_club = Club(name="ACM Amity")
        db.session.add(new_club)
        db.session.commit()
        
        # Create a Club Admin
        admin = User(username="acm_admin", password="hashed_password_here", 
                     role="club_admin", club_id=new_club.id)
        db.session.add(admin)
        db.session.commit()
        
    print("Database initialized with test data!")