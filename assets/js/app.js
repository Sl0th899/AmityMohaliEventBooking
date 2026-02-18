/**
 * AMITY UNIVERSITY MOHALI - EVENT BOOKING SYSTEM
 * Frontend Logic: assets/js/app.js
 * * Functions:
 * - Real-time data fetching from GitHub Raw
 * - Dynamic SVG map manipulation
 * - Automatic background synchronization (30s polling)
 * - XSS-safe tooltip rendering
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. CONFIGURATION
    // Ensure these match your GitHub repository exactly
    const REPO_OWNER = 'Sl0th899'; 
    const REPO_NAME = 'AmityMohaliEventBooking'; 
    const DATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/bookings.json`;

    // 2. DOM ELEMENTS
    const dateInput = document.getElementById('booking-date');
    const slotInput = document.getElementById('booking-slot');
    const tooltip = document.getElementById('tooltip');
    const loadingIndicator = document.getElementById('loading-indicator');
    const zones = document.querySelectorAll('.zone');

    // 3. STATE MANAGEMENT
    let allBookings = [];

    // 4. INITIALIZATION
    const init = async () => {
        setupDatePicker();
        setupEventListeners();
        
        // Initial data fetch
        await fetchBookings();
        renderMap();

        // AUTO-SYNC: Polls GitHub for changes every 30 seconds
        setInterval(async () => {
            console.log("Auto-sync: Checking for new bookings...");
            await fetchBookings();
            renderMap();
        }, 30000); 
    };

    // Set default date to today
    const setupDatePicker = () => {
        const today = new Date().toISOString().split('T')[0];
        if (dateInput) {
            dateInput.value = today;
            dateInput.min = today;
        }
    };

    // Global listeners for UI changes
    const setupEventListeners = () => {
        if (dateInput) dateInput.addEventListener('change', renderMap);
        if (slotInput) slotInput.addEventListener('change', renderMap);

        // Map Zone Interactions
        zones.forEach(zone => {
            zone.addEventListener('mouseenter', (e) => showTooltip(e, zone));
            zone.addEventListener('mousemove', moveTooltip);
            zone.addEventListener('mouseleave', hideTooltip);
            zone.addEventListener('click', () => handleZoneClick(zone));
        });
    };

    // 5. DATA LAYER
    const fetchBookings = async () => {
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        
        try {
            // CACHE BUSTING: Appending a timestamp forces the browser and GitHub CDN 
            // to bypass the cache and fetch the latest committed JSON file.
            const cacheBust = new Date().getTime();
            const response = await fetch(`${DATA_URL}?t=${cacheBust}`);
            
            if (!response.ok) throw new Error('Network response failed');
            
            allBookings = await response.json();
        } catch (error) {
            console.warn('Sync failed. Map might show stale data:', error);
        } finally {
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
        }
    };

    // 6. MAP RENDERING LOGIC
    const renderMap = () => {
        const selectedDate = dateInput.value; // Format: YYYY-MM-DD
        const selectedSlot = slotInput.value;

        // Reset all zones to Green (Available)
        zones.forEach(zone => {
            zone.classList.remove('booked');
            zone.classList.add('available');
            // Remove previous data
            delete zone.dataset.event;
            delete zone.dataset.club;
        });

        // Filter the JSON for matches
        const activeBookings = allBookings.filter(b => 
            b.date === selectedDate && 
            b.slot === selectedSlot
        );

        // Apply Red (Booked) states
        activeBookings.forEach(booking => {
            const element = document.getElementById(booking.location_id);
            if (element) {
                element.classList.remove('available');
                element.classList.add('booked');
                
                // Store info in the element for the tooltip
                element.dataset.event = booking.event;
                element.dataset.club = booking.club;
            }
        });
    };

    // 7. UI FEEDBACK (Tooltips & Interaction)
    const showTooltip = (e, zone) => {
        if (!zone.classList.contains('booked')) return;

        const eventName = zone.dataset.event || "Private Event";
        const clubName = zone.dataset.club || "Campus Organization";

        // SECURITY: Using .textContent instead of .innerHTML to block XSS attacks
        tooltip.textContent = `${eventName} | Organized by: ${clubName}`;
        tooltip.classList.remove('hidden');
    };

    const moveTooltip = (e) => {
        const offset = 15;
        tooltip.style.left = `${e.pageX + offset}px`;
        tooltip.style.top = `${e.pageY + offset}px`;
    };

    const hideTooltip = () => {
        tooltip.classList.add('hidden');
    };

    const handleZoneClick = (zone) => {
        if (zone.classList.contains('booked')) {
            alert('This facility is already reserved for the selected time.');
        } else {
            // Logic to redirect to the Google Form
            // Replace with your actual Google Form URL
            const formUrl = "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform";
            window.open(formUrl, '_blank');
        }
    };

    // Run the system
    init();
});