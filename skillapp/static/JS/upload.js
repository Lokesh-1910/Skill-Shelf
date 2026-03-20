// ================================================================
//  upload.js  —  SkillShelf
//  Uses fetch() to upload files via AJAX so the progress bar
//  is visible before navigating away to the documents page.
// ================================================================

class UploadManager {
    constructor() {
        this.files   = [];
        this.maxSize = 10 * 1024 * 1024; // 10 MB
        this.init();
    }

    init() {
        this.dropZone    = document.getElementById('dropZone');
        this.fileInput   = document.getElementById('fileInput');
        this.browseBtn   = document.getElementById('browseBtn');
        this.fileList    = document.getElementById('fileList');
        this.fileCount   = document.getElementById('fileCount');
        this.uploadQueue = document.getElementById('uploadQueue');
        this.uploadBtn   = document.getElementById('uploadBtn');
        this.clearBtn    = document.getElementById('clearBtn');
        this.setupEvents();
    }

    setupEvents() {
        // Browse button
        this.browseBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag over
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        // Drag leave
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });

        // Drop
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Upload button — intercept, use AJAX instead of form submit
        this.uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.startUpload();
        });

        // Clear button
        this.clearBtn.addEventListener('click', () => {
            this.clearAll();
        });
    }

    handleFiles(fileList) {
        var added = 0;
        for (var i = 0; i < fileList.length; i++) {
            if (this.validateFile(fileList[i])) {
                this.addFile(fileList[i]);
                added++;
            }
        }
        this.updateFileList();
        if (added > 0) {
            this.showMessage(added + ' file(s) selected', 'success');
        }
    }

    validateFile(file) {
        if (file.size > this.maxSize) {
            this.showMessage(file.name + ' exceeds 10 MB limit', 'error');
            return false;
        }
        var validTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.zip'];
        var valid = validTypes.some(function(t) {
            return file.name.toLowerCase().endsWith(t);
        });
        if (!valid) {
            this.showMessage(file.name + ' is not a supported type', 'error');
            return false;
        }
        return true;
    }

    addFile(file) {
        this.files.push({
            id:     Date.now() + Math.random(),
            name:   file.name,
            size:   this.formatSize(file.size),
            type:   this.getFileType(file.name),
            file:   file,
            status: 'pending',
        });
    }

    removeFile(fileId) {
        this.files = this.files.filter(function(f) { return f.id !== fileId; });
        this.updateFileList();
        this.showMessage('File removed', 'info');
    }

    clearAll() {
        this.files = [];
        this.fileInput.value = '';
        this.updateFileList();
        this.resetStats();
        this.uploadQueue.innerHTML =
            '<div class="no-uploads">' +
            '<i class="fas fa-upload"></i>' +
            '<p>No uploads in progress</p>' +
            '<small>Selected files will appear here</small>' +
            '</div>';
        this.showMessage('Selection cleared', 'info');
    }

    updateFileList() {
        this.fileCount.textContent = this.files.length;

        if (this.files.length === 0) {
            this.fileList.innerHTML =
                '<div class="no-files">' +
                '<i class="fas fa-file"></i>' +
                '<p>No files selected yet</p>' +
                '</div>';
            this.uploadBtn.disabled = true;
            return;
        }

        this.uploadBtn.disabled = false;
        var self = this;
        this.fileList.innerHTML = this.files.map(function(file) {
            return '<div class="file-item">' +
                '<div class="file-info">' +
                '<i class="fas fa-file-' + self.getFileIcon(file.type) + '"></i>' +
                '<div>' +
                '<div class="file-name">' + file.name + '</div>' +
                '<div class="file-size">' + file.size + '</div>' +
                '</div>' +
                '</div>' +
                '<div class="file-actions">' +
                '<button class="btn-remove" data-id="' + file.id + '">' +
                '<i class="fas fa-times"></i>' +
                '</button>' +
                '</div>' +
                '</div>';
        }).join('');

        // Wire remove buttons
        var self = this;
        this.fileList.querySelectorAll('.btn-remove').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self.removeFile(parseFloat(btn.getAttribute('data-id')));
            });
        });
    }

    // ── Main upload — AJAX via fetch() ──────────────────────────────
    async startUpload() {
        if (this.files.length === 0) return;

        var category    = document.getElementById('docCategory').value;
        var tags        = document.getElementById('docTag').value;
        var description = document.getElementById('description').value;
        var title       = document.getElementById('docTitle').value;

        if (!category) {
            this.showMessage('Please select a document category', 'error');
            document.getElementById('docCategory').focus();
            return;
        }

        // Disable buttons during upload
        this.uploadBtn.disabled = true;
        this.uploadBtn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        this.clearBtn.disabled = true;

        // Clear queue display
        this.uploadQueue.innerHTML = '';
        this.resetStats();

        var successCount = 0;
        var failedCount  = 0;
        var total        = this.files.length;

        // Upload each file one by one so we can show individual progress
        for (var i = 0; i < this.files.length; i++) {
            var fileObj = this.files[i];

            // Create queue item with progress bar
            var item = this.createQueueItem(fileObj);
            this.uploadQueue.appendChild(item);

            // Animate progress bar to simulate activity while uploading
            var progressFill = item.querySelector('.progress-fill');
            var statusLabel  = item.querySelector('.upload-status');
            var ticker = this.startProgressTick(progressFill, 80);

            try {
                // Build FormData for this single file
                var formData = new FormData();
                formData.append('files', fileObj.file);
                formData.append('category', category);
                formData.append('tags', tags);
                formData.append('description', description);
                formData.append('title', title);
                formData.append('csrfmiddlewaretoken', this.getCSRF());

                var response = await fetch('/upload/ajax/', {
                    method: 'POST',
                    body:   formData,
                });

                clearInterval(ticker);
                var data = await response.json();

                if (response.ok && data.results && data.results[0].status === 'success') {
                    // Success
                    progressFill.style.width = '100%';
                    progressFill.style.background = '#27ae60';
                    item.classList.add('success');
                    statusLabel.textContent = 'Success';
                    successCount++;
                } else {
                    throw new Error(
                        (data.results && data.results[0].error) ||
                        data.error || 'Upload failed'
                    );
                }
            } catch (err) {
                clearInterval(ticker);
                progressFill.style.width    = '100%';
                progressFill.style.background = '#e74c3c';
                item.classList.add('failed');
                statusLabel.textContent = 'Failed';
                failedCount++;
            }

            // Update stats counters
            this.updateStats(successCount, total - successCount - failedCount, failedCount, total);
        }

        // Re-enable buttons
        this.uploadBtn.disabled = false;
        this.uploadBtn.innerHTML =
            '<i class="fas fa-cloud-upload-alt"></i> Start Upload';
        this.clearBtn.disabled = false;

        // Final message + redirect after a short delay so user sees the result
        if (successCount === total) {
            this.showMessage(
                successCount + ' document(s) uploaded successfully!', 'success'
            );
            setTimeout(function() {
                window.location.href = '/documents/';
            }, 2000);
        } else if (successCount > 0) {
            this.showMessage(
                successCount + ' uploaded, ' + failedCount + ' failed.', 'info'
            );
            setTimeout(function() {
                window.location.href = '/documents/';
            }, 3000);
        } else {
            this.showMessage('All uploads failed. Please try again.', 'error');
            this.uploadBtn.disabled = false;
        }
    }

    // ── Create a queue item DOM element ─────────────────────────────
    createQueueItem(fileObj) {
        var item = document.createElement('div');
        item.className = 'upload-item';
        item.innerHTML =
            '<div class="file-info">' +
            '<i class="fas fa-file-' + this.getFileIcon(fileObj.type) + '"></i>' +
            '<div>' +
            '<div class="file-name">' + fileObj.name + '</div>' +
            '<div class="file-size">' + fileObj.size + '</div>' +
            '<div class="upload-progress">' +
            '<div class="progress-fill" style="width:0%;"></div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="upload-status">Uploading...</div>';
        return item;
    }

    // ── Animate progress bar up to maxPct while waiting for server ──
    startProgressTick(progressFill, maxPct) {
        var pct = 0;
        return setInterval(function() {
            pct += Math.random() * 15;
            if (pct >= maxPct) pct = maxPct;
            progressFill.style.width = pct + '%';
        }, 200);
    }

    // ── Update the three stat counters ──────────────────────────────
    updateStats(success, inProgress, failed, total) {
        document.getElementById('successCount').textContent     = success;
        document.getElementById('progressCountText').textContent = inProgress;
        document.getElementById('failedCount').textContent      = failed;
        document.getElementById('progressCount').textContent    =
            (success + failed) + ' of ' + total + ' files processed';
    }

    resetStats() {
        this.updateStats(0, 0, 0, 0);
    }

    // ── Get Django CSRF token from cookie ────────────────────────────
    getCSRF() {
        var name   = 'csrftoken';
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var c = cookies[i].trim();
            if (c.startsWith(name + '=')) {
                return decodeURIComponent(c.substring(name.length + 1));
            }
        }
        // Fallback: read from hidden input in form
        var inp = document.querySelector('[name=csrfmiddlewaretoken]');
        return inp ? inp.value : '';
    }

    // ── Helpers ──────────────────────────────────────────────────────
    getFileType(filename) {
        var ext = filename.split('.').pop().toLowerCase();
        if (['jpg','jpeg','png','gif'].includes(ext)) return 'image';
        if (ext === 'pdf')                             return 'pdf';
        if (['doc','docx'].includes(ext))              return 'word';
        if (['zip','rar'].includes(ext))               return 'archive';
        return 'file';
    }

    getFileIcon(type) {
        var icons = {
            image:   'image',
            pdf:     'pdf',
            word:    'word',
            archive: 'archive',
            file:    'alt',
        };
        return icons[type] || 'alt';
    }

    formatSize(bytes) {
        if (bytes < 1024)             return bytes + ' B';
        if (bytes < 1024 * 1024)      return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    showMessage(text, type) {
        var existing = document.querySelector('.message');
        if (existing) existing.remove();

        var colors = {
            success: '#27ae60',
            error:   '#e74c3c',
            info:    '#3498db',
        };

        var msg = document.createElement('div');
        msg.className = 'message ' + type;
        msg.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:9999;' +
            'padding:14px 22px;border-radius:8px;color:white;font-size:14px;' +
            'font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);' +
            'background:' + (colors[type] || colors.info) + ';' +
            'animation:slideIn 0.3s ease;';
        msg.textContent = text;
        document.body.appendChild(msg);

        // Auto-remove after 4 seconds (longer so user can read it)
        setTimeout(function() {
            msg.style.opacity    = '0';
            msg.style.transition = 'opacity 0.4s';
            setTimeout(function() { if (msg.parentNode) msg.remove(); }, 400);
        }, 4000);
    }
}

// Inject slideIn animation
(function() {
    var s = document.createElement('style');
    s.textContent =
        '@keyframes slideIn{from{transform:translateX(110%);opacity:0}' +
        'to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(s);
})();

// Initialise
var uploadManager = new UploadManager();