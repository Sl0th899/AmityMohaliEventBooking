async function loadAvailability() {
    const date = document.getElementById("date").value;
    const slot = document.getElementById("slot").value;

    const res = await fetch(`/api/availability?date=${date}&slot_id=${slot}`);
    const data = await res.json();

    console.log(data);
}

async function book(location) {
    const date = document.getElementById("date").value;
    const slot = document.getElementById("slot").value;

    const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            location_id: location,
            slot_id: parseInt(slot),
            date: date,
            event_name: "Test Event"
        })
    });

    const data = await res.json();
    alert(data.message || data.error);
}
