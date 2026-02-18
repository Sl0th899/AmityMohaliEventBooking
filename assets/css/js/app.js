document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const REPO_OWNER = 'your-github-username'; // REPLACE THIS
    const REPO_NAME = 'amity-booking-system';  // REPLACE THIS
    const DATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/bookings.json`;
    
    // DOM Elements
    const dateInput = document.getElementById('booking-date');
    const slotInput = document.getElementById('booking-slot');
    const tooltip = document.getElementById('tooltip');
    const loadingIndicator = document.getElementById('loading-indicator');
    const zones = document.querySelectorAll('.zone');

    // State
    let allBookings = [];

    // Initialize
    const init = async () => {
        setupDatePicker();
        setupEventListeners();
        await fetchBookings();
        renderMap();
    };

    // Set default date to today
    const setupDatePicker = () => {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.min = today;
    };

    // Event Listeners
    const setupEventListeners = () => {
        dateInput.addEventListener('change', renderMap);
        slotInput.addEventListener('change', renderMap);

        // Map Interactions
        zones.forEach(zone => {
            zone.addEventListener('mouseenter', (e) => showTooltip(e, zone));
            zone.addEventListener('mousemove', (e) => moveTooltip(e));
            zone.addEventListener('mouseleave', hideTooltip);
            zone.addEventListener('click', (e) => handleZoneClick(zone));
        });
    };

    // Fetch Data with cache busting
    const fetchBookings = async () => {
        loadingIndicator.classList.remove('hidden');
        try {
            // Add timestamp to bypass caching
            const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
            if (!response.ok) throw new Error('Network response was not ok');
            allBookings = await response.json();
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
            alert('Unable to load booking data. Please try again later.');
            allBookings = [];
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    };

    // Render Map Logic
    const renderMap = () => {
        const selectedDate = dateInput.value;
        const selectedSlot = slotInput.value;

        // Reset all zones to available
        zones.forEach(zone => {
            zone.classList.remove('booked');
            zone.classList.add('available');
            zone.dataset.bookingInfo = ""; // Clear data
        });

        // Filter bookings for current selection
        const activeBookings = allBookings.filter(b => 
            b.date === selectedDate && 
            b.slot === selectedSlot
        );

        // Update UI for booked zones
        activeBookings.forEach(booking => {
            const element = document.getElementById(booking.location_id);
            if (element) {
                element.classList.remove('available');
                element.classList.add('booked');
                
                // Store info for tooltip
                const info = JSON.stringify({
                    event: booking.event,
                    club: booking.club
                });
                element.dataset.bookingInfo = info;
            }
        });
    };

    // Tooltip Logic
    const showTooltip = (e, zone) => {
        if (!zone.classList.contains('booked')) return;

        const infoRaw = zone.dataset.bookingInfo;
        if (!infoRaw) return;

        const info = JSON.parse(infoRaw);
        tooltip.innerHTML = `<strong>${info.event}</strong>By: ${info.club}`;
        tooltip.classList.remove('hidden');
    };

    const moveTooltip = (e) => {
        // Offset tooltip slightly from cursor
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
            alert('This slot is already booked.');
        } else {
            // Visual feedback only - actual booking happens via Google Form (out of scope for frontend logic per prompt constraints)
            // Ideally, this would open the Google Form in a modal pre-filled
            const id = zone.id;
            alert(`Location ${id} is available! Use the Google Form to book it.`);
        }
    };

    init();
});