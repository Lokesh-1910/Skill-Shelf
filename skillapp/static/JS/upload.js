// File Upload Manager
class UploadManager {
    constructor() {
        this.files = [];
        this.uploadQueue = [];
        this.maxSize = 10 * 1024 * 1024; // 10MB
        
        this.init();
    }
    
    init() {
        // DOM Elements
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.browseBtn = document.getElementById('browseBtn');
        this.fileList = document.getElementById('fileList');
        this.fileCount = document.getElementById('fileCount');
        this.uploadQueue = document.getElementById('uploadQueue');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Event Listeners
        this.setupEvents();
    }
    
    setupEvents() {
        // Browse Files
        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        
        // File Input Change
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        
        // Drag & Drop
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });
        
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });
        
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
        
        // Upload Button
        this.uploadBtn.addEventListener('click', () => this.startUpload());
        
        // Clear Button
        this.clearBtn.addEventListener('click', () => this.clearAll());
    }
    
    handleFiles(fileList) {
        for (let file of fileList) {
            if (this.validateFile(file)) {
                this.addFile(file);
            }
        }
        this.updateFileList();
        this.showMessage(`${fileList.length} file(s) selected`, 'success');
    }
    
    validateFile(file) {
        // Check size
        if (file.size > this.maxSize) {
            this.showMessage(`${file.name} exceeds 10MB limit`, 'error');
            return false;
        }
        
        // Check type
        const validTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.zip'];
        const isValid = validTypes.some(type => file.name.toLowerCase().endsWith(type));
        
        if (!isValid) {
            this.showMessage(`${file.name} is not a supported type`, 'error');
            return false;
        }
        
        return true;
    }
    
    addFile(file) {
        const fileObj = {
            id: Date.now(),
            name: file.name,
            size: this.formatSize(file.size),
            type: this.getFileType(file.name),
            file: file,
            status: 'pending',
            progress: 0
        };
        
        this.files.push(fileObj);
    }
    
    removeFile(fileId) {
        this.files = this.files.filter(f => f.id !== fileId);
        this.updateFileList();
        this.showMessage('File removed', 'info');
    }
    
    clearAll() {
        this.files = [];
        this.updateFileList();
        this.showMessage('All files cleared', 'info');
    }
    
    updateFileList() {
        this.fileCount.textContent = this.files.length;
        
        if (this.files.length === 0) {
            this.fileList.innerHTML = `
                <div class="no-files">
                    <i class="fas fa-file"></i>
                    <p>No files selected yet</p>
                </div>
            `;
            this.uploadBtn.disabled = true;
            this.clearBtn.disabled = true;
            return;
        }
        
        this.uploadBtn.disabled = false;
        this.clearBtn.disabled = false;
        
        this.fileList.innerHTML = this.files.map(file => `
            <div class="file-item">
                <div class="file-info">
                    <i class="fas fa-file-${this.getFileIcon(file.type)}"></i>
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${file.size}</div>
                    </div>
                </div>
                <div class="file-actions">
                    <button onclick="uploadManager.removeFile(${file.id})" class="btn-remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    async startUpload() {
        if (this.files.length === 0) return;
        
        // Get document details
        const docType = document.getElementById('docType').value;
        const tags = document.getElementById('tags').value;
        const description = document.getElementById('description').value;
        
        if (!docType) {
            this.showMessage('Please select document type', 'error');
            return;
        }
        
        // Disable upload button
        this.uploadBtn.disabled = true;
        this.uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        
        // Prepare upload queue
        this.uploadQueue.innerHTML = '';
        
        // Upload files one by one
        for (let i = 0; i < this.files.length; i++) {
            await this.uploadFile(this.files[i], i);
        }
        
        // Reset UI
        this.uploadBtn.disabled = false;
        this.uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Start Upload';
        
        this.showMessage('Upload completed!', 'success');
        this.clearAll();
    }
    
    async uploadFile(file, index) {
        return new Promise(resolve => {
            // Create upload item
            const uploadItem = document.createElement('div');
            uploadItem.className = 'upload-item';
            uploadItem.innerHTML = `
                <div class="file-info">
                    <i class="fas fa-file-${this.getFileIcon(file.type)}"></i>
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${file.size}</div>
                        <div class="upload-progress">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
                <div class="upload-status">Uploading...</div>
            `;
            
            this.uploadQueue.appendChild(uploadItem);
            
            // Simulate upload progress
            let progress = 0;
            const progressFill = uploadItem.querySelector('.progress-fill');
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    
                    // Randomly fail for demo
                    if (Math.random() < 0.2) { // 20% chance of failure
                        uploadItem.classList.add('failed');
                        uploadItem.querySelector('.upload-status').textContent = 'Failed';
                        this.updateStats('failed');
                    } else {
                        uploadItem.classList.add('success');
                        uploadItem.querySelector('.upload-status').textContent = 'Success';
                        this.updateStats('success');
                    }
                    
                    resolve();
                }
                
                progressFill.style.width = `${progress}%`;
                this.updateStats('progress');
            }, 300);
        });
    }
    
    updateStats(type) {
        const successCount = document.getElementById('successCount');
        const progressCount = document.getElementById('progressCountText');
        const failedCount = document.getElementById('failedCount');
        const progressCountText = document.getElementById('progressCount');
        
        let success = parseInt(successCount.textContent) || 0;
        let progress = parseInt(progressCount.textContent) || 0;
        let failed = parseInt(failedCount.textContent) || 0;
        
        switch(type) {
            case 'success':
                success++;
                break;
            case 'failed':
                failed++;
                break;
            case 'progress':
                progress = this.files.length - success - failed;
                break;
        }
        
        successCount.textContent = success;
        progressCount.textContent = progress;
        failedCount.textContent = failed;
        progressCountText.textContent = `${success + failed} of ${this.files.length} files processed`;
    }
    
    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
        if (['pdf'].includes(ext)) return 'pdf';
        if (['doc', 'docx'].includes(ext)) return 'word';
        if (['zip', 'rar'].includes(ext)) return 'archive';
        return 'file';
    }
    
    getFileIcon(type) {
        const icons = {
            'image': 'image',
            'pdf': 'pdf',
            'word': 'word',
            'archive': 'archive',
            'file': 'file'
        };
        return icons[type] || 'file';
    }
    
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' Bytes';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    showMessage(text, type) {
        // Remove existing message
        const existing = document.querySelector('.message');
        if (existing) existing.remove();
        
        // Create new message
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        document.body.appendChild(message);
        
        // Auto remove
        setTimeout(() => message.remove(), 3000);
    }
}

// Initialize Upload Manager
const uploadManager = new UploadManager();