const app = {
    state: {
        locations: [],
        events: [],
        currentDate: new Date(), 
        selectedLocation: null
    },

    async init() {
        this.cacheDOM();
        this.bindEvents();
        this.initializeMapCoordinates();
        await this.fetchLiveBookings();
        this.renderAll();

        setInterval(async () => {
            await this.fetchLiveBookings();
            this.renderAll();
        }, 30000);
    },

    // Note: Added the exact image filenames you requested
    initializeMapCoordinates() {
        this.state.locations = [
            { id: "loc_wind_tunnel", name: "Wind Tunnel", x: 35, y: 12, img: "windtunnel.png" },
            { id: "loc_mdp_room", name: "MDP Room", x: 83, y: 12, img: "mdproom.png" },
            { id: "loc_pre_function", name: "Pre-Function Area", x: 44, y: 25, img: "pre-function.png" },
            { id: "loc_auditorium", name: "Auditorium", x: 55, y: 25, img: "auditorium.png" },
            { id: "loc_atrium", name: "Atrium", x: 65, y: 50, img: "atrium.png" },
            { id: "loc_seminar_hall", name: "Seminar Hall 2", x: 70, y: 80, img: "seminar.png" }
        ];
    },

    cacheDOM() {
        this.dom = {
            navItems: document.querySelectorAll('.nav-item'),
            views: document.querySelectorAll('.view'),
            dateDisplay: document.getElementById('current-date-display'),
            markersContainer: document.getElementById('markers-container'),
            panel: document.getElementById('event-panel'),
            panelTitle: document.getElementById('panel-title'),
            panelStatus: document.getElementById('panel-status'),
            panelContent: document.getElementById('panel-content'),
            calMonthDisplay: document.getElementById('month-display'),
            calGrid: document.getElementById('calendar-grid'),
            calPreview: document.getElementById('calendar-events-preview')
        };
    },

    bindEvents() {
        // --- NEW: GPU Accelerated Scroll Listener ---
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                document.body.classList.add('scrolled');
            } else {
                document.body.classList.remove('scrolled');
            }
        });

        // SPA Routing
        this.dom.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const targetView = e.currentTarget.dataset.target;
                this.switchView(targetView);
                
                this.dom.navItems.forEach(n => n.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Force scroll state if navigating via tabs
                if (!document.body.classList.contains('scrolled')) {
                    window.scrollTo({ top: 100, behavior: 'smooth' });
                }
            });
        });

        document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
    },

    async fetchLiveBookings() {
        try {
            const REPO_OWNER = 'Sl0th899'; 
            const REPO_NAME = 'AmityMohaliEventBooking'; 
            const DATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/bookings.json`;
            
            const cacheBust = new Date().getTime();
            const response = await fetch(`${DATA_URL}?t=${cacheBust}`);
            if (response.ok) this.state.events = await response.json();
        } catch (error) {
            console.error("Failed to load live data.", error);
        }
    },

    renderAll() {
        this.updateDateDisplay();
        this.renderMapMarkers();
        this.renderCalendar();
    },

    switchView(viewId) {
        this.dom.views.forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        this.closePanel();
    },

    // --- NEW IMAGE POPUP MARKERS ---
    renderMapMarkers() {
        if (!this.dom.markersContainer) return;
        this.dom.markersContainer.innerHTML = '';
        const dateStr = this.formatDateStr(this.state.currentDate);

        this.state.locations.forEach(loc => {
            const locationEvents = this.state.events.filter(e => e.location_id === loc.id && e.date === dateStr && e.status === "CONFIRMED");
            const isBooked = locationEvents.length > 0;

            const marker = document.createElement('div');
            marker.className = `marker ${isBooked ? 'booked' : 'available'}`;
            marker.style.left = `${loc.x}%`;
            marker.style.top = `${loc.y}%`;
            
            // Build the image popup card
            const popup = document.createElement('div');
            popup.className = 'popup-card';
            
            // Fallback text if the image isn't found
            popup.innerHTML = `
                <img src="${loc.img}" alt="${loc.name}" onerror="this.style.display='none'">
                <div class="popup-text">
                    ${loc.name} <br>
                    <span class="${isBooked ? 'text-red' : 'text-green'}">${isBooked ? 'Booked' : 'Available'}</span>
                </div>
            `;
            
            marker.appendChild(popup);
            marker.addEventListener('click', () => this.openLocationPanel(loc, locationEvents));

            this.dom.markersContainer.appendChild(marker);
        });
    },

    openLocationPanel(location, events) {
        this.state.selectedLocation = location;
        this.dom.panelTitle.textContent = location.name;
        
        if (events.length > 0) {
            this.dom.panelStatus.textContent = 'Booked';
            this.dom.panelStatus.className = 'status-badge booked';
            
            this.dom.panelContent.innerHTML = events.map(e => `
                <div class="event-card">
                    <h4>${this.sanitizeHTML(e.event)}</h4>
                    <p><strong>Time Slot:</strong> ${this.sanitizeHTML(e.slot)}</p>
                    <p><strong>Organizer:</strong> ${this.sanitizeHTML(e.club)}</p>
                </div>
            `).join('');
        } else {
            this.dom.panelStatus.textContent = 'Available';
            this.dom.panelStatus.className = 'status-badge available';
            this.dom.panelContent.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No events scheduled here for this date.</p>`;
        }

        this.dom.panel.classList.add('open');
    },

    closePanel() {
        if (this.dom.panel) this.dom.panel.classList.remove('open');
    },

    renderCalendar() {
        if (!this.dom.calGrid) return;

        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        this.dom.calMonthDisplay.textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        this.dom.calGrid.innerHTML = '';

        for (let i = 0; i < firstDay; i++) this.dom.calGrid.appendChild(document.createElement('div'));

        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.textContent = i;

            const cellDateStr = this.formatDateStr(new Date(year, month, i));
            
            if (i === this.state.currentDate.getDate()) dayDiv.classList.add('active');
            if (this.state.events.some(e => e.date === cellDateStr && e.status === "CONFIRMED")) dayDiv.classList.add('has-event');

            dayDiv.addEventListener('click', () => {
                this.state.currentDate = new Date(year, month, i);
                this.renderAll();
            });

            this.dom.calGrid.appendChild(dayDiv);
        }
        this.renderCalendarPreview();
    },

    changeMonth(delta) {
        this.state.currentDate = new Date(this.state.currentDate.getFullYear(), this.state.currentDate.getMonth() + delta, 1);
        this.renderAll();
    },

    renderCalendarPreview() {
        if (!this.dom.calPreview) return;
        const dateStr = this.formatDateStr(this.state.currentDate);
        const dayEvents = this.state.events.filter(e => e.date === dateStr && e.status === "CONFIRMED");

        if (dayEvents.length === 0) {
            this.dom.calPreview.innerHTML = `<p style="text-align:center; color: var(--text-muted); font-size: 0.9rem;">No events scheduled for this date.</p>`;
            return;
        }

        this.dom.calPreview.innerHTML = `
            <h4 style="color: var(--yale-blue); margin-bottom: 15px; font-weight: 600;">Events on ${this.state.currentDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</h4>
            ${dayEvents.map(e => {
                const loc = this.state.locations.find(l => l.id === e.location_id);
                return `<div class="event-card"><h4>${this.sanitizeHTML(e.event)}</h4><p><strong>Location:</strong> ${loc ? loc.name : 'Unknown'}</p><p><strong>Time:</strong> ${this.sanitizeHTML(e.slot)}</p></div>`
            }).join('')}
        `;
    },

    updateDateDisplay() {
        if (this.dom.dateDisplay) this.dom.dateDisplay.textContent = this.state.currentDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    },

    formatDateStr(dateObj) {
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    },

    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
};

app.init();