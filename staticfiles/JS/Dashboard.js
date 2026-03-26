
// Interactive elements
document.addEventListener('DOMContentLoaded', function () {
    // Upload button functionality
    const uploadBtn = document.querySelector('.upload-btn');
    uploadBtn.addEventListener('click', function () {
        alert('Upload dialog would open here. You can select multiple files to upload.');
    });

    // Action buttons functionality
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
        button.addEventListener('click', function () {
            const actionText = this.textContent.trim();

            if (actionText === 'Upload New Document') {
                alert('Opening document upload dialog...');
            } else if (actionText === 'Create New Category') {
                const categoryName = prompt('Enter name for new category:');
                if (categoryName && categoryName.trim() !== '') {
                    alert(`New category "${categoryName}" created successfully!`);
                }
            } else if (actionText === 'Share Documents') {
                alert('Opening document sharing interface...');
            }
        });
    });

    // Document item clicks
    const documentItems = document.querySelectorAll('.document-item');
    documentItems.forEach(item => {
        item.addEventListener('click', function () {
            const docName = this.querySelector('.doc-info h4').textContent;
            alert(`Viewing document: ${docName}\nThis would open the document preview.`);
        });
    });

    // Profile dropdown simulation
    const userProfile = document.querySelector('.user-profile');
    userProfile.addEventListener('click', function () {
        alert('Profile menu options:\n• View Profile\n• Account Settings\n• Privacy & Security\n• Logout');
    });

    // View all links
    const viewAllLinks = document.querySelectorAll('.view-all');
    viewAllLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const section = this.closest('.section-header').querySelector('h2').textContent;
            alert(`Loading all ${section.toLowerCase()}...`);
        });
    });
});