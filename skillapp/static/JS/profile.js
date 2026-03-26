// ============================================================
//  profile.js  —  SkillShelf
//  Profile completion is calculated from REAL database values
//  injected by Django into the HTML (data-* attributes).
//  No localStorage is used for user data.
// ============================================================


// ===== TAB SWITCHING =====
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    event.currentTarget.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
}


// ===== PROFILE COMPLETION =====
const PROFILE_FIELDS = [
    { id: 'fullName',    label: 'Full Name'    },
    { id: 'email',       label: 'Email'        },
    { id: 'phone',       label: 'Phone'        },
    { id: 'gender',      label: 'Gender'       },
    { id: 'dob',         label: 'Date of Birth'},
    { id: 'nationality', label: 'Nationality'  },
    { id: 'address',     label: 'Address'      },
    { id: 'bio',         label: 'Bio'          },
];

function calculateCompletion() {
    let filled = 0;

    PROFILE_FIELDS.forEach(function(f) {
        const el = document.getElementById(f.id);
        if (!el) return;
        const val = el.value ? el.value.trim() : '';
        if (el.tagName === 'SELECT') {
            if (val !== '') filled++;
        } else {
            if (val !== '') filled++;
        }
    });

    const totalFields = PROFILE_FIELDS.length + 1;
    const hasPhoto    = document.getElementById('profileAvatarImg') !== null;
    if (hasPhoto) filled++;

    return Math.round((filled / totalFields) * 100);
}

function updateCompletionBar() {
    const percent    = calculateCompletion();
    const percentEl  = document.getElementById('completionPercent');
    const progressEl = document.getElementById('progressFill');

    if (!percentEl || !progressEl) return;

    percentEl.textContent  = percent + '%';
    progressEl.style.width = percent + '%';

    if (percent < 30) {
        progressEl.style.background = '#ef4444';
    } else if (percent < 60) {
        progressEl.style.background = '#f59e0b';
    } else if (percent < 100) {
        progressEl.style.background = '#3b82f6';
    } else {
        progressEl.style.background = 'linear-gradient(90deg, #2563eb, #10b981)';
    }
}

function attachLiveCompletion() {
    PROFILE_FIELDS.forEach(function(f) {
        const el = document.getElementById(f.id);
        if (el) {
            el.addEventListener('input',  updateCompletionBar);
            el.addEventListener('change', updateCompletionBar);
        }
    });
}


// ===== PROFILE PHOTO PREVIEW =====
function previewPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be smaller than 5 MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        let img = document.getElementById('profileAvatarImg');
        if (!img) {
            img = document.createElement('img');
            img.id        = 'profileAvatarImg';
            img.className = 'profile-avatar';
            img.alt       = 'Profile Photo';
            const old = document.getElementById('profileAvatar');
            if (old) old.replaceWith(img);
        }
        img.src = e.target.result;
        showToast('Photo selected — click Save Changes to upload', 'info');
        updateCompletionBar();
    };
    reader.readAsDataURL(file);
}


// ===== PASSWORD STRENGTH =====
function checkPasswordStrength(value) {
    const fill = document.getElementById('strengthFill');
    const text = document.getElementById('strengthText');

    const hasLength = value.length >= 8;
    const hasUpper  = /[A-Z]/.test(value);
    const hasLower  = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);

    document.getElementById('reqLength').className = hasLength ? 'text-success' : 'text-danger';
    document.getElementById('reqUpper').className  = hasUpper  ? 'text-success' : 'text-danger';
    document.getElementById('reqLower').className  = hasLower  ? 'text-success' : 'text-danger';
    document.getElementById('reqNumber').className = hasNumber ? 'text-success' : 'text-danger';

    const score  = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;
    const levels = [
        { w: '0%',   bg: '#e5e7eb', label: 'Enter a password to check strength', color: '#6b7280' },
        { w: '25%',  bg: '#ef4444', label: 'Weak',   color: '#ef4444' },
        { w: '50%',  bg: '#f59e0b', label: 'Fair',   color: '#f59e0b' },
        { w: '75%',  bg: '#3b82f6', label: 'Good',   color: '#3b82f6' },
        { w: '100%', bg: '#10b981', label: 'Strong', color: '#10b981' },
    ];
    const level = value.length === 0 ? levels[0] : levels[score];
    fill.style.width      = level.w;
    fill.style.background = level.bg;
    text.textContent      = level.label;
    text.style.color      = level.color;
}

function validatePasswordMatch() {
    const np = document.getElementById('newPassword').value;
    const cp = document.getElementById('confirmPassword').value;
    const el = document.getElementById('confirmPassword');
    if (!cp) { el.style.borderColor = ''; return; }
    el.style.borderColor = (np === cp) ? '#10b981' : '#ef4444';
}


// ===== DARK MODE =====
// ── SESSION ONLY: does NOT persist across page navigation ──
// localStorage is intentionally NOT used here per requirements.
function toggleDarkMode(checkbox) {
    document.body.classList.toggle('dark-mode', checkbox.checked);
    const status = document.getElementById('themeStatus');
    if (status) {
        status.textContent = checkbox.checked ? 'Dark Mode' : 'Light Mode';
    }
    // NOTE: We do NOT save to localStorage — dark mode is session/page only.
    // When user navigates away or refreshes, it resets to Light Mode.
    showToast(
        checkbox.checked ? '🌙 Dark mode enabled (this page only)' : '☀️ Light mode enabled',
        'info'
    );
}

// ── On page load: do NOT apply any saved theme — always start Light ──
// (This replaces the old applySavedTheme function which used localStorage)
function initTheme() {
    // Always start in light mode — dark mode is temporary/per-page only
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = false;
    document.body.classList.remove('dark-mode');
}


// ===== NOTIFICATION TOGGLES =====
// Only one can be active at a time (email OR sms).
// Preference is saved to the database via AJAX.

var _savingNotif = false; // prevent double-clicks

function handleNotifToggle(type, checkbox) {
    if (_savingNotif) {
        // Prevent rapid toggling while saving
        checkbox.checked = !checkbox.checked;
        return;
    }

    const emailToggle = document.getElementById('emailNotifications');
    const smsToggle   = document.getElementById('smsNotifications');
    const emailRow    = document.getElementById('emailNotifRow');
    const smsRow      = document.getElementById('smsNotifRow');

    // Determine what the new preference should be
    let newPreference;

    if (!checkbox.checked) {
        // User turned OFF the current method → set to 'none'
        newPreference = 'none';
    } else {
        // User turned ON this method → turn the other OFF
        newPreference = type;

        if (type === 'email') {
            // Turn off SMS
            if (smsToggle) smsToggle.checked = false;
            if (smsRow)    smsRow.classList.remove('notif-active');
            if (smsRow)    smsRow.classList.add('notif-inactive');
        } else if (type === 'sms') {
            // Turn off Email
            if (emailToggle) emailToggle.checked = false;
            if (emailRow)    emailRow.classList.remove('notif-active');
            if (emailRow)    emailRow.classList.add('notif-inactive');
        }
    }

    // Update active/inactive styles
    if (newPreference === 'email') {
        if (emailRow) { emailRow.classList.add('notif-active'); emailRow.classList.remove('notif-inactive'); }
        if (smsRow)   { smsRow.classList.remove('notif-active'); smsRow.classList.add('notif-inactive'); }
    } else if (newPreference === 'sms') {
        if (smsRow)   { smsRow.classList.add('notif-active'); smsRow.classList.remove('notif-inactive'); }
        if (emailRow) { emailRow.classList.remove('notif-active'); emailRow.classList.add('notif-inactive'); }
    } else {
        // none — both inactive
        if (emailRow) { emailRow.classList.remove('notif-active'); emailRow.classList.add('notif-inactive'); }
        if (smsRow)   { smsRow.classList.remove('notif-active'); smsRow.classList.add('notif-inactive'); }
    }

    // Save to database
    saveNotificationPreference(newPreference);
}

function saveNotificationPreference(preference) {
    _savingNotif = true;

    const statusBar  = document.getElementById('notifStatusBar');
    const statusText = document.getElementById('notifStatusText');

    // Show saving indicator
    if (statusBar)  statusBar.className = 'notif-status-bar warning';
    if (statusText) statusText.textContent = '⏳ Saving preference...';

    const csrf = document.querySelector('[name=csrfmiddlewaretoken]');
    const csrfToken = csrf ? csrf.value : getCookie('csrftoken');

    fetch('/save-settings/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken':  csrfToken,
        },
        body: JSON.stringify({ notification: preference }),
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
        _savingNotif = false;

        if (data.success) {
            // Update status bar
            if (statusBar)  statusBar.className = 'notif-status-bar';

            if (preference === 'email') {
                if (statusText) statusText.textContent = '✅ Email notifications are currently active.';
                showToast('📧 Email notifications enabled', 'success');
            } else if (preference === 'sms') {
                if (statusText) statusText.textContent = '✅ SMS notifications are currently active.';
                showToast('📱 SMS notifications enabled', 'success');
            } else {
                if (statusBar)  statusBar.className = 'notif-status-bar warning';
                if (statusText) statusText.textContent = '⚠️ All notifications are turned off.';
                showToast('🔕 Notifications disabled', 'warning');
            }
        } else {
            // Server rejected — revert the toggle
            revertToggles(preference);
            if (statusBar)  statusBar.className = 'notif-status-bar warning';
            if (statusText) statusText.textContent = '❌ ' + (data.error || 'Failed to save.');
            showToast(data.error || 'Failed to save notification preference', 'error');
        }
    })
    .catch(function(err) {
        _savingNotif = false;
        revertToggles(preference);
        if (statusText) statusText.textContent = '❌ Network error. Please try again.';
        showToast('Network error. Please try again.', 'error');
    });
}

function revertToggles(failedPreference) {
    // If save failed, revert toggles to previous state
    const emailToggle = document.getElementById('emailNotifications');
    const smsToggle   = document.getElementById('smsNotifications');
    const emailRow    = document.getElementById('emailNotifRow');
    const smsRow      = document.getElementById('smsNotifRow');

    // Just turn both off — user can re-select
    if (emailToggle) emailToggle.checked = false;
    if (smsToggle)   smsToggle.checked   = false;
    if (emailRow)    emailRow.classList.remove('notif-active');
    if (smsRow)      smsRow.classList.remove('notif-active');
}

function initNotifRowStyles() {
    // On page load, apply correct active/inactive styles based on DB value
    const emailToggle = document.getElementById('emailNotifications');
    const smsToggle   = document.getElementById('smsNotifications');
    const emailRow    = document.getElementById('emailNotifRow');
    const smsRow      = document.getElementById('smsNotifRow');

    if (!emailToggle || !smsToggle) return;

    if (emailToggle.checked) {
        if (emailRow) { emailRow.classList.add('notif-active'); emailRow.classList.remove('notif-inactive'); }
        if (smsRow)   { smsRow.classList.remove('notif-active'); smsRow.classList.add('notif-inactive'); }
    } else if (smsToggle.checked) {
        if (smsRow)   { smsRow.classList.add('notif-active'); smsRow.classList.remove('notif-inactive'); }
        if (emailRow) { emailRow.classList.remove('notif-active'); emailRow.classList.add('notif-inactive'); }
    } else {
        if (emailRow) emailRow.classList.add('notif-inactive');
        if (smsRow)   smsRow.classList.add('notif-inactive');
    }
}


// ===== TOAST NOTIFICATIONS =====
function showToast(message, type) {
    type = type || 'info';

    const colors = {
        success: '#10b981',
        error:   '#ef4444',
        warning: '#f59e0b',
        info:    '#3b82f6',
    };
    const icons = {
        success: '✓',
        error:   '✗',
        warning: '⚠',
        info:    'ℹ',
    };

    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: toastIn 0.3s ease;
        min-width: 220px;
        max-width: 320px;
    `;
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(function() {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3000);
}


// ===== HELPER: Get CSRF cookie =====
function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}


// ===== INJECT TOAST ANIMATIONS =====
(function injectToastStyles() {
    if (document.getElementById('toastStyles')) return;
    const style = document.createElement('style');
    style.id = 'toastStyles';
    style.textContent = `
        @keyframes toastIn  { from { transform: translateX(110%); opacity: 0; }
                               to   { transform: translateX(0);    opacity: 1; } }
        @keyframes toastOut { from { transform: translateX(0);    opacity: 1; }
                               to   { transform: translateX(110%); opacity: 0; } }
        @keyframes shake    { 0%,100%{ transform:translateX(0); }
                               25%   { transform:translateX(-5px); }
                               75%   { transform:translateX(5px); } }
        .shake { animation: shake 0.3s ease-in-out; }
    `;
    document.head.appendChild(style);
})();


// ===== INIT ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', function () {

    // 1. Calculate and display completion from DB-prefilled values
    updateCompletionBar();

    // 2. Live-update completion as user edits fields
    attachLiveCompletion();

    // 3. Always start in Light Mode (dark mode is session/page only)
    initTheme();

    // 4. Apply correct notification row styles from DB value
    initNotifRowStyles();

    // 5. Show Django flash message as toast
    const body      = document.body;
    const flashMsg  = body.getAttribute('data-flash-msg');
    const flashType = body.getAttribute('data-flash-type');
    if (flashMsg) {
        showToast(flashMsg, flashType || 'info');
    }

});