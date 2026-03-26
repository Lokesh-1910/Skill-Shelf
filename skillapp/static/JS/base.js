// =============================================
//  Inactivity Auto Logout (No Stay Option)
//  15 minutes inactivity → warning → auto logout
// =============================================

let inactivityTimer;
let warningTimer;

const INACTIVITY_TIME = 1 * 60 * 1000;    // Change to 15 * 60 * 1000 when done testing
const WARNING_TIME    = 30 * 1000;        // 30 seconds warning

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);

    inactivityTimer = setTimeout(() => {
        showInactivityWarning();
    }, INACTIVITY_TIME);
}

function showInactivityWarning() {
    const modal = document.getElementById('inactivityWarning');
    if (!modal) return;

    let timeLeft = 30;
    const countdownEl = document.getElementById('countdown');
    
    modal.style.display = 'flex';

    warningTimer = setInterval(() => {
        timeLeft--;
        if (countdownEl) countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(warningTimer);
            window.location.href = '/logout/';
        }
    }, 1000);
}

// Reset timer on any user activity
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, { passive: true });
});

// Start timer when page loads
document.addEventListener('DOMContentLoaded', () => {
    resetInactivityTimer();
});