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
// Reads the CURRENT value of every form field in the profile tab.
// Fields that are already filled from the DB count immediately on page load.

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

        // For select dropdowns, ignore the blank placeholder option
        if (el.tagName === 'SELECT') {
            if (val !== '') filled++;
        } else {
            if (val !== '') filled++;
        }
    });

    // Profile photo counts as one extra field
    const totalFields = PROFILE_FIELDS.length + 1;
    const hasPhoto    = document.getElementById('profileAvatarImg') !== null;
    if (hasPhoto) filled++;

    return Math.round((filled / totalFields) * 100);
}

function updateCompletionBar() {
    const percent     = calculateCompletion();
    const percentEl   = document.getElementById('completionPercent');
    const progressEl  = document.getElementById('progressFill');

    if (!percentEl || !progressEl) return;

    percentEl.textContent   = percent + '%';
    progressEl.style.width  = percent + '%';

    // Colour changes based on how complete the profile is
    if (percent < 30) {
        progressEl.style.background = '#ef4444';       // red
    } else if (percent < 60) {
        progressEl.style.background = '#f59e0b';       // amber
    } else if (percent < 100) {
        progressEl.style.background = '#3b82f6';       // blue
    } else {
        progressEl.style.background = 'linear-gradient(90deg, #2563eb, #10b981)'; // green
    }
}

// Live update while user types in the profile form
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
        // Replace initials div with an <img> for the preview
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
        updateCompletionBar(); // photo now counts toward completion
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

    const score = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;

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
function toggleDarkMode(checkbox) {
    document.body.classList.toggle('dark-mode', checkbox.checked);
    document.getElementById('themeStatus').textContent =
        checkbox.checked ? 'Dark Mode' : 'Light Mode';
    // Persist theme preference in localStorage (UI pref only, not user data)
    localStorage.setItem('skillshelf_theme', checkbox.checked ? 'dark' : 'light');
    showToast(checkbox.checked ? 'Dark mode enabled' : 'Light mode enabled', 'success');
}

function applySavedTheme() {
    const saved  = localStorage.getItem('skillshelf_theme');
    const toggle = document.getElementById('darkModeToggle');
    if (saved === 'dark') {
        document.body.classList.add('dark-mode');
        if (toggle) toggle.checked = true;
        const status = document.getElementById('themeStatus');
        if (status) status.textContent = 'Dark Mode';
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

    // Create or reuse toast container
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

    // 3. Apply saved dark mode theme preference
    applySavedTheme();

    // 4. Show success/error toast if Django added a flash message
    //    (reads from a data attribute we set on <body>)
    const body = document.body;
    const flashMsg  = body.getAttribute('data-flash-msg');
    const flashType = body.getAttribute('data-flash-type');
    if (flashMsg) {
        showToast(flashMsg, flashType || 'info');
    }

    // 5. Notification toggle feedback
    ['emailNotifications', 'smsNotifications'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                const label = id === 'emailNotifications' ? 'Email' : 'SMS';
                showToast(label + ' notifications ' + (this.checked ? 'enabled' : 'disabled'), 'info');
            });
        }
    });

});