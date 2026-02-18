document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    // TODO: REPLACE THESE WITH YOUR EXACT GITHUB DETAILS
    const REPO_OWNER = 'your-github-username'; 
    const REPO_NAME = 'amity-booking-system';
    
    // We fetch from "raw" to get the latest commit without waiting for Vercel to rebuild.
    const BASE_DATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/bookings.json`;

    // =========================================================================
    // DOM ELEMENTS
    // =========================================================================
    const dateInput = document.getElementById('booking-date');
    const slotInput = document.getElementById('booking-slot');
    const tooltip = document.getElementById('tooltip');
    const loadingIndicator = document.getElementById('loading-indicator');
    const zones = document.querySelectorAll('.zone'); // The SVG paths

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================
    let allBookings = [];

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    const init = async () => {
        setupDatePicker();
        setupEventListeners();
        
        // Initial Fetch
        await fetchBookings();
        renderMap();
        
        // Auto-refresh data every 60 seconds (optional, for real-time feel)
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
    // DATA FETCHING (Production Optimized)
    // =========================================================================
    const fetchBookings = async () => {
        showLoading(true);
        try {
            // CACHE BUSTING:
            // We append a timestamp to the URL to prevent the browser or GitHub's CDN 
            // from serving stale data. This ensures we see bookings made 10 seconds ago.
            const cacheBuster = new Date().getTime();
            const url = `${BASE_DATA_URL}?t=${cacheBuster}`;

            const response = await fetch(url);
            
            if (!response.ok) {
                // If 404, it might mean bookings.json doesn't exist yet (fresh repo)
                if(response.status === 404) {
                    allBookings = [];
                    return;
                }
                throw new Error(`GitHub API Error: ${response.status}`);
            }

            allBookings = await response.json();
            
            // Validate that we actually got an array
            if (!Array.isArray(allBookings)) {
                console.error("Data format error: Expected array", allBookings);
                allBookings = [];
            }

        } catch (error) {
            console.warn('Fetching bookings failed (using empty state):', error);
            // Don't alert the user on every background fetch failure, just log it.
        } finally {
            showLoading(false);
            renderMap(); // Re-render immediately after fetch
        }
    };

    // =========================================================================
    // RENDERING LOGIC
    // =========================================================================
    const renderMap = () => {
        const selectedDate = dateInput.value;
        const selectedSlot = slotInput.value;

        // 1. Reset all zones to "Available" state
        zones.forEach(zone => {
            zone.classList.remove('booked');
            zone.classList.add('available');
            delete zone.dataset.bookingInfo; // Clean up data
            zone.style.fill = ""; // Reset inline styles if any
        });

        // 2. Find bookings that match current Date & Slot
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
                
                // Store sanitized info for tooltip
                // (We sanitize again here just to be safe)
                const safeEvent = escapeHtml(booking.event || "Event");
                const safeClub = escapeHtml(booking.club || "Club");
                
                element.dataset.bookingInfo = JSON.stringify({
                    event: safeEvent,
                    club: safeClub
                });
            }
        });
    };

    // =========================================================================
    // INTERACTION HANDLERS
    // =========================================================================
    const showTooltip = (e, zone) => {
        if (!zone.classList.contains('booked')) return;
        if (!zone.dataset.bookingInfo) return;

        const info = JSON.parse(zone.dataset.bookingInfo);
        
        // Update Tooltip Content
        tooltip.innerHTML = `
            <div style="font-weight:bold; color:#f1c40f; margin-bottom:4px;">${info.event}</div>
            <div style="font-size:0.85em;">Org: ${info.club}</div>
        `;
        
        tooltip.classList.remove('hidden');
    };

    const moveTooltip = (e) => {
        // Position tooltip 15px to the bottom-right of cursor
        tooltip.style.left = `${e.pageX + 15}px`;
        tooltip.style.top = `${e.pageY + 15}px`;
    };

    const hideTooltip = () => {
        tooltip.classList.add('hidden');
    };

    const handleZoneClick = (zone) => {
        if (zone.classList.contains('booked')) {
            alert('This slot is already booked.');
        } else {
            const name = zone.querySelector('title')?.textContent || "this location";
            alert(`✅ ${zone.id} is available!\n\nPlease fill out the Google Form below to book it.`);
            // Optional: Scroll to the embedded Google Form if you have one
        }
    };

    // =========================================================================
    // UTILITIES
    // =========================================================================
    const showLoading = (isLoading) => {
        if (loadingIndicator) {
            if (isLoading) loadingIndicator.classList.remove('hidden');
            else loadingIndicator.classList.add('hidden');
        }
    };

    // Basic XSS protection for rendering strings
    const escapeHtml = (unsafe) => {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    };

    // Start App
    init();
});