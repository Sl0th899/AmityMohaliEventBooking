document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURATION
    // =========================================================================
    // TODO: REPLACE THESE WITH YOUR EXACT GITHUB DETAILS
    const REPO_OWNER = 'your-github-username'; 
    const REPO_NAME = 'amity-booking-system';
    
    // We fetch from "raw" to get the latest commit without waiting for Vercel to rebuild.
    const BASE_DATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/bookings.json`;

    // =========================================================================
    // 2. DOM ELEMENTS
    // =========================================================================
    const dateInput = document.getElementById('booking-date');
    const slotInput = document.getElementById('booking-slot');
    const tooltip = document.getElementById('tooltip');
    const loadingIndicator = document.getElementById('loading-indicator');
    const zones = document.querySelectorAll('.zone'); // The SVG paths

    // =========================================================================
    // 3. STATE MANAGEMENT
    // =========================================================================
    let allBookings = [];

    // =========================================================================
    // 4. INITIALIZATION
    // =========================================================================
    const init = async () => {
        setupDatePicker();
        setupEventListeners();
        
        // Initial Fetch
        await fetchBookings();
        renderMap();
        
        // Auto-refresh data every 60 seconds (Real-time feel without overloading)
        setInterval(fetchBookings, 60000);
    };

    const setupDatePicker = () => {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.min = today;
    };

    const setupEventListeners = () => {
        // Refresh map when controls change
        dateInput.addEventListener('change', renderMap);
        slotInput.addEventListener('change', renderMap);

        // Map Interactions
        zones.forEach(zone => {
            zone.addEventListener('mouseenter', (e) => showTooltip(e, zone));
            zone.addEventListener('mousemove', (e) => moveTooltip(e));
            zone.addEventListener('mouseleave', hideTooltip);
            zone.addEventListener('click', () => handleZoneClick(zone));
        });
    };

    // =========================================================================
    // 5. DATA FETCHING (Production Optimized)
    // =========================================================================
    const fetchBookings = async () => {
        showLoading(true);
        try {
            // CACHE BUSTING:
            // Append a timestamp to force a fresh fetch from GitHub's Edge Cache.
            const cacheBuster = new Date().getTime();
            const url = `${BASE_DATA_URL}?t=${cacheBuster}`;

            const response = await fetch(url);
            
            if (!response.ok) {
                // If 404, it likely means bookings.json doesn't exist yet (fresh repo).
                // Treat this as "0 bookings" rather than an error.
                if (response.status === 404) {
                    console.warn("bookings.json not found (fresh install). Defaulting to empty.");
                    allBookings = [];
                    return;
                }
                throw new Error(`GitHub API Error: ${response.status}`);
            }

            const data = await response.json();
            
            // Validate that we actually got an array
            if (Array.isArray(data)) {
                allBookings = data;
            } else {
                console.error("Data format error: Expected array, got", data);
                allBookings = [];
            }

        } catch (error) {
            console.warn('Fetching bookings failed:', error);
            // We do NOT clear allBookings here to persist the old state 
            // if a background refresh fails (better UX).
        } finally {
            showLoading(false);
            renderMap(); 
        }
    };

    // =========================================================================
    // 6. RENDERING LOGIC
    // =========================================================================
    const renderMap = () => {
        const selectedDate = dateInput.value;
        const selectedSlot = slotInput.value;

        // 1. Reset all zones to "Available" state
        zones.forEach(zone => {
            zone.classList.remove('booked');
            zone.classList.add('available');
            
            // Clean up data attributes
            delete zone.dataset.event;
            delete zone.dataset.club;
            
            // Reset visual styles
            zone.style.fill = ""; 
            zone.style.cursor = "pointer";
        });

        // 2. Filter bookings for current Date & Slot
        const activeBookings = allBookings.filter(b => 
            b.date === selectedDate && 
            b.slot === selectedSlot
        );

        // 3. Apply "Booked" state
        activeBookings.forEach(booking => {
            const element = document.getElementById(booking.location_id);
            if (element) {
                element.classList.remove('available');
                element.classList.add('booked');
                
                // Store raw data in dataset (We sanitize during DISPLAY, not storage)
                element.dataset.event = booking.event || "Event";
                element.dataset.club = booking.club || "Club";
            }
        });
    };

    // =========================================================================
    // 7. INTERACTION HANDLERS
    // =========================================================================
    const showTooltip = (e, zone) => {
        if (!zone.classList.contains('booked')) return;

        const eventName = zone.dataset.event;
        const clubName = zone.dataset.club;

        if (!eventName) return;

        // SECURITY CRITICAL: 
        // We use .textContent instead of .innerHTML to prevent XSS.
        // Even if a hacker names their event "<script>alert(1)</script>", 
        // it will render as harmless text.
        tooltip.textContent = `${eventName} (${clubName})`;
        
        tooltip.classList.remove('hidden');
    };

    const moveTooltip = (e) => {
        // Position tooltip 15px to the bottom-right of cursor
        // Ensure it doesn't go off-screen (basic check)
        const x = e.pageX + 15;
        const y = e.pageY + 15;
        
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    };

    const hideTooltip = () => {
        tooltip.classList.add('hidden');
    };

    const handleZoneClick = (zone) => {
        if (zone.classList.contains('booked')) {
            alert('This slot is already reserved.');
        } else {
            // Friendly message guiding user to the Google Form
            alert(`✅ Location available!\n\nPlease use the Google Form below to book: ${zone.id}`);
        }
    };

    // =========================================================================
    // 8. UTILITIES
    // =========================================================================
    const showLoading = (isLoading) => {
        if (!loadingIndicator) return;
        
        if (isLoading) {
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
        }
    };

    // Start the App
    init();
});