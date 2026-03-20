// ===== GLOBAL STATE =====
let userData = {
    name: 'Indhumathi S',
    email: 'indhu@example.com',
    phone: '+91 98765 43210',
    gender: 'female',
    dob: '1995-08-15',
    nationality: 'Indian',
    address: 'Chennai, Tamil Nadu',
    bio: 'Welcome to your unified digital profile.',
    profilePhoto: null,
    twoFactorEnabled: false,
    darkMode: false,
    language: 'en',
    timezone: 'IST'
};

let completionFields = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Load saved user data
    loadUserData();
    
    // Initialize completion tracking
    initCompletionTracking();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update completion percentage
    updateCompletion();
    
    // Check for saved theme
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme === 'true') {
        enableDarkMode();
    }
});

function loadUserData() {
    // Load from localStorage if available
    const savedData = localStorage.getItem('userProfile');
    if (savedData) {
        const parsed = JSON.parse(savedData);
        userData = { ...userData, ...parsed };
    }
    
    // Populate form fields
    document.getElementById('fullName').value = userData.name;
    document.getElementById('email').value = userData.email;
    document.getElementById('phone').value = userData.phone;
    document.getElementById('gender').value = userData.gender;
    document.getElementById('dob').value = userData.dob;
    document.getElementById('nationality').value = userData.nationality;
    document.getElementById('address').value = userData.address;
    document.getElementById('bio').value = userData.bio;
    
    // Update display
    document.getElementById('displayName').textContent = userData.name;
    document.getElementById('displayBio').textContent = userData.bio;
    
    // Update avatar if photo exists
    if (userData.profilePhoto) {
        const avatar = document.getElementById('profileAvatar');
        avatar.style.backgroundImage = `url(${userData.profilePhoto})`;
        avatar.textContent = '';
    }
    
    // Set up 2FA toggle
    document.getElementById('twoFactorToggle').checked = userData.twoFactorEnabled;
    document.getElementById('twoFactorStatus').textContent = 
        userData.twoFactorEnabled ? 'Enabled' : 'Disabled';
    
    if (userData.twoFactorEnabled) {
        document.getElementById('twoFactorSetup').classList.remove('hidden');
    }
    
    // Set up dark mode toggle
    document.getElementById('darkModeToggle').checked = userData.darkMode;
    document.getElementById('themeStatus').textContent = 
        userData.darkMode ? 'Dark Mode' : 'Light Mode';
    
    // Set up language and timezone
    document.getElementById('language').value = userData.language;
    document.getElementById('timezone').value = userData.timezone;
}

function initCompletionTracking() {
    completionFields = document.querySelectorAll('.track');
    completionFields.forEach(field => {
        field.addEventListener('input', updateCompletion);
    });
}

function setupEventListeners() {
    // 2FA toggle
    document.getElementById('twoFactorToggle').addEventListener('change', function() {
        if (this.checked) {
            document.getElementById('twoFactorSetup').classList.remove('hidden');
            document.getElementById('twoFactorStatus').textContent = 'Enabled';
        } else {
            document.getElementById('twoFactorSetup').classList.add('hidden');
            document.getElementById('twoFactorStatus').textContent = 'Disabled';
            userData.twoFactorEnabled = false;
            saveUserData();
            showToast('Two-factor authentication disabled', 'info');
        }
    });
    
    // Dark mode toggle
    document.getElementById('darkModeToggle').addEventListener('change', function() {
        if (this.checked) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
    });
    
    // Notification toggles
    document.getElementById('emailNotifications').addEventListener('change', function() {
        showToast(`Email notifications ${this.checked ? 'enabled' : 'disabled'}`, 'info');
    });
    
    document.getElementById('pushNotifications').addEventListener('change', function() {
        showToast(`Push notifications ${this.checked ? 'enabled' : 'disabled'}`, 'info');
    });
    
    document.getElementById('smsNotifications').addEventListener('change', function() {
        showToast(`SMS notifications ${this.checked ? 'enabled' : 'disabled'}`, 'info');
    });
    
    // Language change
    document.getElementById('language').addEventListener('change', function() {
        userData.language = this.value;
        saveUserData();
        showToast(`Language changed to ${this.options[this.selectedIndex].text}`, 'success');
    });
    
    // Timezone change
    document.getElementById('timezone').addEventListener('change', function() {
        userData.timezone = this.value;
        saveUserData();
        showToast(`Timezone changed to ${this.value}`, 'success');
    });
}

// ===== TAB MANAGEMENT =====
function switchTab(tabName) {
    // Update tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show selected tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
}

// ===== PROFILE PHOTO =====
function updateProfilePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image size should be less than 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const avatar = document.getElementById('profileAvatar');
        avatar.style.backgroundImage = `url(${e.target.result})`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
        avatar.textContent = '';
        
        userData.profilePhoto = e.target.result;
        saveUserData();
        
        showToast('Profile photo updated successfully!', 'success');
    };
    reader.readAsDataURL(file);
}

// ===== PROFILE COMPLETION =====
function updateCompletion() {
    let filled = 0;
    completionFields.forEach(field => {
        if (field.value && field.value.trim() !== '') {
            filled++;
        }
    });
    
    const percent = Math.round((filled / completionFields.length) * 100);
    const percentElement = document.getElementById('completionPercent');
    const progressFill = document.getElementById('progressFill');
    
    percentElement.textContent = percent + '%';
    progressFill.style.width = percent + '%';
    
    // Update progress bar color based on completion
    if (percent < 30) {
        progressFill.style.background = '#ef4444';
    } else if (percent < 70) {
        progressFill.style.background = '#f59e0b';
    } else if (percent < 100) {
        progressFill.style.background = '#3b82f6';
    } else {
        progressFill.style.background = '#10b981';
    }
}

// ===== SAVE PROFILE =====
function saveProfile() {
    // Get form values
    const name = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const gender = document.getElementById('gender').value;
    const dob = document.getElementById('dob').value;
    const nationality = document.getElementById('nationality').value.trim();
    const address = document.getElementById('address').value.trim();
    const bio = document.getElementById('bio').value.trim();
    
    // Validate required fields
    if (!name || !email || !phone) {
        showToast('Please fill all required fields (*)', 'error');
        highlightEmptyFields();
        return;
    }
    
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    if (!validatePhone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    
    // Update user data
    userData.name = name;
    userData.email = email;
    userData.phone = phone;
    userData.gender = gender;
    userData.dob = dob;
    userData.nationality = nationality;
    userData.address = address;
    userData.bio = bio;
    
    // Update display
    document.getElementById('displayName').textContent = name;
    document.getElementById('displayBio').textContent = bio || 'No bio provided';
    
    // Save to localStorage
    saveUserData();
    
    showToast('Profile saved successfully!', 'success');
    updateCompletion();
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    // Basic phone validation (at least 10 digits)
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
}

function highlightEmptyFields() {
    completionFields.forEach(field => {
        if (!field.value || field.value.trim() === '') {
            field.classList.add('shake');
            setTimeout(() => field.classList.remove('shake'), 300);
        }
    });
}

// ===== RESET FORM =====
function resetForm() {
    if (confirm('Are you sure you want to reset all fields? Unsaved changes will be lost.')) {
        // Reset to saved user data
        document.getElementById('fullName').value = userData.name;
        document.getElementById('email').value = userData.email;
        document.getElementById('phone').value = userData.phone;
        document.getElementById('gender').value = userData.gender;
        document.getElementById('dob').value = userData.dob;
        document.getElementById('nationality').value = userData.nationality;
        document.getElementById('address').value = userData.address;
        document.getElementById('bio').value = userData.bio;
        
        showToast('Form reset to saved values', 'info');
        updateCompletion();
    }
}

// ===== SECURITY FUNCTIONS =====
function checkPasswordStrength(password) {
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    // Update requirement indicators
    const reqLength = document.getElementById('reqLength');
    const reqUpper = document.getElementById('reqUpper');
    const reqLower = document.getElementById('reqLower');
    const reqNumber = document.getElementById('reqNumber');
    
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    reqLength.className = hasLength ? 'text-success' : 'text-danger';
    reqUpper.className = hasUpper ? 'text-success' : 'text-danger';
    reqLower.className = hasLower ? 'text-success' : 'text-danger';
    reqNumber.className = hasNumber ? 'text-success' : 'text-danger';
    
    let strength = 0;
    let message = '';
    let color = '';
    
    if (hasLength) strength += 25;
    if (hasUpper) strength += 25;
    if (hasLower) strength += 25;
    if (hasNumber) strength += 25;
    
    if (strength <= 25) {
        message = 'Weak password';
        color = '#ef4444';
    } else if (strength <= 50) {
        message = 'Fair password';
        color = '#f59e0b';
    } else if (strength <= 75) {
        message = 'Good password';
        color = '#3b82f6';
    } else {
        message = 'Strong password';
        color = '#10b981';
    }
    
    strengthFill.style.width = strength + '%';
    strengthFill.style.background = color;
    strengthText.textContent = message;
    strengthText.style.color = color;
}

function validatePasswordMatch() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmInput = document.getElementById('confirmPassword');
    
    if (confirmPassword && newPassword !== confirmPassword) {
        confirmInput.style.borderColor = '#ef4444';
    } else if (confirmPassword) {
        confirmInput.style.borderColor = '#10b981';
    }
}

function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill all password fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    // Check password strength requirements
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    
    if (!hasUpper || !hasLower || !hasNumber) {
        showToast('Password must contain uppercase, lowercase letters and numbers', 'error');
        return;
    }
    
    // Simulate password update
    showToast('Password updated successfully!', 'success');
    
    // Reset form
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('strengthFill').style.width = '0%';
    document.getElementById('strengthText').textContent = 'Enter a password to check strength';
    
    // Reset requirement indicators
    document.querySelectorAll('#reqLength, #reqUpper, #reqLower, #reqNumber').forEach(el => {
        el.className = 'text-danger';
    });
}

// ===== TWO-FACTOR AUTHENTICATION =====
function send2FAOTP() {
    const phoneInput = document.getElementById('twoFactorPhone');
    const phone = phoneInput.value.trim();
    
    if (!phone) {
        showToast('Please enter a phone number', 'error');
        return;
    }
    
    if (!validatePhone(phone)) {
        showToast('Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    // Show OTP box
    document.getElementById('twoFactorOTPBox').classList.remove('hidden');
    
    showToast('OTP sent to ' + phone, 'info');
}

function moveToNext2FA(input, nextIndex) {
    if (input.value.length === 1) {
        const inputs = document.querySelectorAll('#twoFactorOTPBox .otp-input');
        if (nextIndex < inputs.length) {
            inputs[nextIndex].focus();
        }
    }
}

function verify2FAOTP() {
    const inputs = document.querySelectorAll('#twoFactorOTPBox .otp-input');
    let otp = '';
    inputs.forEach(input => {
        otp += input.value;
    });
    
    if (otp.length !== 6) {
        showToast('Please enter complete OTP', 'error');
        return;
    }
    
    // Simulate verification (in real app, verify with backend)
    if (otp === '123456') {
        userData.twoFactorEnabled = true;
        saveUserData();
        
        document.getElementById('twoFactorOTPStatus').textContent = '✓ Two-factor authentication enabled!';
        document.getElementById('twoFactorOTPStatus').style.color = '#10b981';
        document.getElementById('twoFactorOTPStatus').style.background = '#d1fae5';
        
        showToast('Two-factor authentication enabled successfully!', 'success');
        
        // Reset OTP inputs
        inputs.forEach(input => input.value = '');
    } else {
        document.getElementById('twoFactorOTPStatus').textContent = '✗ Invalid OTP. Please try again.';
        document.getElementById('twoFactorOTPStatus').style.color = '#ef4444';
        document.getElementById('twoFactorOTPStatus').style.background = '#fee2e2';
        
        inputs.forEach(input => {
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 300);
        });
    }
}

// ===== SETTINGS FUNCTIONS =====
function enableDarkMode() {
    document.body.classList.add('dark-mode');
    userData.darkMode = true;
    saveUserData();
    document.getElementById('themeStatus').textContent = 'Dark Mode';
    showToast('Dark mode enabled', 'success');
}

function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    userData.darkMode = false;
    saveUserData();
    document.getElementById('themeStatus').textContent = 'Light Mode';
    showToast('Light mode enabled', 'success');
}

function exportData() {
    // Create a JSON file with user data
    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'skill-shelf-data-export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Data exported successfully', 'success');
}

function downloadData() {
    showToast('Backup download started', 'info');
    // In a real app, this would trigger a backup download
}

function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        if (prompt('Type "DELETE" to confirm account deletion:') === 'DELETE') {
            // Simulate account deletion
            showToast('Account deletion scheduled. You will receive a confirmation email.', 'info');
        }
    }
}

function logoutAllDevices() {
    if (confirm('This will log you out from all devices. Continue?')) {
        showToast('Logged out from all devices', 'success');
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        showToast('Logged out successfully', 'success');
        // In a real app, redirect to login page
        setTimeout(() => {
            alert('Redirecting to login page...');
        }, 1000);
    }
}

// ===== UTILITY FUNCTIONS =====
function saveUserData() {
    localStorage.setItem('userProfile', JSON.stringify(userData));
    localStorage.setItem('darkMode', userData.darkMode);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        background: ${type === 'success' ? '#10b981' : 
                     type === 'error' ? '#ef4444' : 
                     type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    // Add icon
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `${icons[type] || ''} ${message}`;
    
    // Add to container
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    .shake {
        animation: shake 0.3s ease-in-out;
    }
`;
document.head.appendChild(style);