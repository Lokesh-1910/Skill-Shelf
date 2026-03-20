
const docs = [
    {
        id: 1,
        name: "Spring Semester Marksheet 2023",
        cat: "Academic",
        date: "2023-01-15",
        size: "1.2 MB",
        tag: "official",
        color: "blue",
        img: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800",
        pages: [
            "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800",
            "https://images.unsplash.com/photo-1586281380117-5c597c9972b1?w-800",
            "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&auto=format&fit=crop&q=60"
        ],
        description: "Official marksheet for Spring Semester 2023. Contains detailed grades for all subjects including Mathematics (A+), Physics (A), and Computer Science (A+). Verified and stamped by the university registrar.",
        uploader: "John Smith",
        lastModified: "2023-01-20",
        format: "PDF",
        pagesCount: 3,
        downloadUrl: "#"
    },
    {
        id: 2,
        name: "Web Development Certificate",
        cat: "Certificates",
        date: "2023-02-28",
        size: "800 KB",
        tag: "important",
        color: "green",
        img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800",
        pages: [
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800"
        ],
        description: "Certificate of Completion for Advanced Web Development Bootcamp. Issued by Tech Academy after successful completion of 12-week intensive course covering HTML, CSS, JavaScript, React, and Node.js.",
        uploader: "Sarah Johnson",
        lastModified: "2023-03-01",
        format: "PDF",
        pagesCount: 1,
        downloadUrl: "#"
    },
    {
        id: 3,
        name: "University Student ID Card",
        cat: "IDs",
        date: "2023-03-10",
        size: "500 KB",
        tag: "personal",
        color: "purple",
        img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800",
        pages: [
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800"
        ],
        description: "Official university student ID card. Valid until December 2025. Contains student number, photo, barcode, and access privileges. Required for campus access and library services.",
        uploader: "Michael Chen",
        lastModified: "2023-03-10",
        format: "JPG",
        pagesCount: 1,
        downloadUrl: "#"
    },
    {
        id: 4,
        name: "Debate Competition Award",
        cat: "Extracurriculars",
        date: "2023-04-05",
        size: "1.5 MB",
        tag: "important",
        color: "yellow",
        img: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800",
        pages: [
            "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800"
        ],
        description: "First place award in Inter-University Debate Competition 2023. Signed by the Dean of Students and competition organizers. Recognition for excellence in public speaking and critical thinking.",
        uploader: "Emma Wilson",
        lastModified: "2023-04-10",
        format: "PNG",
        pagesCount: 1,
        downloadUrl: "#"
    },
    {
        id: 5,
        name: "Official Academic Transcript",
        cat: "Academic",
        date: "2023-05-20",
        size: "1.8 MB",
        tag: "official",
        color: "blue",
        img: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=600",
        pages: [
            "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=600",
            "https://images.unsplash.com/photo-1586281380117-5c597c9972b1?w=800",
            "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=600&auto=format&fit=crop&q=60"
        ],
        description: "Complete academic transcript showing all courses taken from 2020-2023, grades received, credit hours, and cumulative GPA (3.8/4.0). Official document suitable for graduate school applications.",
        uploader: "David Brown",
        lastModified: "2023-05-25",
        format: "PDF",
        pagesCount: 3,
        downloadUrl: "#"
    },
    {
        id: 6,
        name: "Driver's License",
        cat: "IDs",
        date: "2023-06-12",
        size: "600 KB",
        tag: "official",
        color: "orange",
        img: "https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?w=800",
        pages: [
            "https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?w=800"
        ],
        description: "Government-issued driver's license. Valid for 5 years until 2028. Contains personal information, photo, and driving categories B and C. Required for vehicle rental and identification.",
        uploader: "Robert Taylor",
        lastModified: "2023-06-12",
        format: "JPG",
        pagesCount: 1,
        downloadUrl: "#"
    }
];

let activeCategory = "All";
let currentDoc = null;
let zoomLevel = 1;
let rotation = 0;
let currentPage = 0;

const docDiv = document.getElementById("documents");
const catDiv = document.getElementById("categories");
const search = document.getElementById("search");
const sort = document.getElementById("sort");
const dateFilter = document.getElementById("dateFilter");
const tagFilter = document.getElementById("tagFilter");
const sizeFilter = document.getElementById("sizeFilter");
const docCount = document.getElementById("docCount");

// Modal elements
const modal = document.getElementById("documentModal");
const closeModalBtn = document.getElementById("closeModal");
const closeModalBtn2 = document.getElementById("closeModal2");
const modalImage = document.getElementById("modalImage");
const modalDescription = document.getElementById("modalDescription");
const modalInfoGrid = document.getElementById("modalInfoGrid");
const thumbnailStrip = document.getElementById("thumbnailStrip");

// Preview controls
const modeButtons = document.querySelectorAll('.mode-btn');
const zoomOutBtn = document.getElementById("zoomOut");
const zoomInBtn = document.getElementById("zoomIn");
const zoomResetBtn = document.getElementById("zoomReset");
const rotateBtn = document.getElementById("rotateBtn");

// Action buttons
const downloadBtn = document.getElementById("downloadBtn");
const printBtn = document.getElementById("printBtn");
const shareBtn = document.getElementById("shareBtn");
const saveCopyBtn = document.getElementById("saveCopyBtn");

function renderCategories() {
    const cats = ["All", ...new Set(docs.map(d => d.cat))];
    catDiv.innerHTML = "";
    cats.forEach(cat => {
        const count = cat === "All" ? docs.length : docs.filter(d => d.cat === cat).length;
        catDiv.innerHTML += `
      <div class="category ${activeCategory === cat ? "active" : ""}" onclick="setCategory('${cat}')">
        <span>${cat}</span>
        <span class="count">${count}</span>
      </div>`;
    });
}

function setCategory(cat) {
    activeCategory = cat;
    render();
}

function openDocument(docId) {
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;

    currentDoc = doc;
    currentPage = 0;
    zoomLevel = 1;
    rotation = 0;

    // Update modal image
    modalImage.src = doc.pages[0];
    modalImage.style.transform = `scale(${zoomLevel}) rotate(${rotation}deg)`;

    // Update document information
    modalInfoGrid.innerHTML = `
    <div class="info-item">
      <h5>Category</h5>
      <p>${doc.cat}</p>
    </div>
    <div class="info-item">
      <h5>Upload Date</h5>
      <p>${new Date(doc.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="info-item">
      <h5>File Size</h5>
      <p>${doc.size}</p>
    </div>
    <div class="info-item">
      <h5>Format</h5>
      <p>${doc.format}</p>
    </div>
    <div class="info-item">
      <h5>Uploaded By</h5>
      <p>${doc.uploader}</p>
    </div>
    <div class="info-item">
      <h5>Last Modified</h5>
      <p>${new Date(doc.lastModified).toLocaleDateString()}</p>
    </div>
    <div class="info-item">
      <h5>Pages</h5>
      <p>${doc.pagesCount} page${doc.pagesCount > 1 ? 's' : ''}</p>
    </div>
    <div class="info-item">
      <h5>Tag</h5>
      <p><span class="tag ${doc.tag}">${doc.tag}</span></p>
    </div>
  `;

    // Update description
    modalDescription.innerHTML = `<p>${doc.description}</p>`;

    // Create thumbnails
    thumbnailStrip.innerHTML = '';
    doc.pages.forEach((page, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = `thumbnail ${index === 0 ? 'active' : ''}`;
        thumbnail.innerHTML = `<img src="${page}" alt="Page ${index + 1}">`;
        thumbnail.onclick = () => {
            document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');
            modalImage.src = page;
            currentPage = index;
        };
        thumbnailStrip.appendChild(thumbnail);
    });

    // Update action buttons
    downloadBtn.onclick = () => downloadDocument(doc);
    printBtn.onclick = () => printDocument(doc);
    shareBtn.onclick = () => shareDocument(doc);
    saveCopyBtn.onclick = () => saveCopy(doc);

    // Show modal
    modal.classList.add("active");
    document.body.style.overflow = 'hidden';
}

function downloadDocument(doc) {
    alert(`Downloading: ${doc.name}\nFormat: ${doc.format}\nSize: ${doc.size}`);
    // In a real app: window.location.href = doc.downloadUrl;
}

function printDocument(doc) {
    alert(`Printing: ${doc.name}`);
    // In a real app: window.print();
}

function shareDocument(doc) {
    if (navigator.share) {
        navigator.share({
            title: doc.name,
            text: `Check out this document: ${doc.description}`,
            url: window.location.href
        });
    } else {
        alert(`Share link copied to clipboard for: ${doc.name}`);
        // Fallback: Copy to clipboard
    }
}

function saveCopy(doc) {
    alert(`Saving a copy of: ${doc.name}\nThe copy will be saved to your "Copies" folder.`);
}

function updateZoom() {
    modalImage.style.transform = `scale(${zoomLevel}) rotate(${rotation}deg)`;
}

function render() {
    renderCategories();

    let list = [...docs];

    // Filter by category
    if (activeCategory !== "All") {
        list = list.filter(d => d.cat === activeCategory);
    }

    // Filter by search
    const q = search.value.toLowerCase();
    if (q) {
        list = list.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.cat.toLowerCase().includes(q) ||
            d.tag.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q)
        );
    }

    // Filter by date
    if (dateFilter.value !== "all") {
        list = list.filter(d =>
            new Date(d.date).getFullYear().toString() === dateFilter.value
        );
    }

    // Filter by tag
    if (tagFilter.value !== "all") {
        list = list.filter(d => d.tag === tagFilter.value);
    }

    // Filter by size
    if (sizeFilter.value !== "all") {
        switch (sizeFilter.value) {
            case 'small':
                list = list.filter(d => parseFloat(d.size) < 1);
                break;
            case 'medium':
                list = list.filter(d => parseFloat(d.size) >= 1 && parseFloat(d.size) <= 2);
                break;
            case 'large':
                list = list.filter(d => parseFloat(d.size) > 2);
                break;
        }
    }

    // Sort documents
    switch (sort.value) {
        case 'asc':
            list.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'desc':
            list.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'name':
            list.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'size':
            list.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));
            break;
    }

    // Update document count
    docCount.textContent = `${list.length} document${list.length !== 1 ? 's' : ''} found`;

    // Render documents
    docDiv.innerHTML = list.map(d => `
    <div class="card" onclick="openDocument(${d.id})">
      <div class="card-badge">${d.format}</div>
      <img src="${d.img}" alt="${d.name}">
      <div class="card-body">
        <div class="card-tags">
          <span class="tag ${d.tag}">${d.tag}</span>
          <span class="tag">${d.cat}</span>
        </div>
        <h4>${d.name}</h4>
        <p>${d.description.substring(0, 80)}...</p>
        <div class="card-footer">
          <span><i class="far fa-calendar"></i> ${new Date(d.date).toLocaleDateString()}</span>
          <span><i class="far fa-file"></i> ${d.size}</span>
        </div>
      </div>
    </div>
  `).join("");
}

// Close modal function
function closeModal() {
    modal.classList.remove("active");
    document.body.style.overflow = 'auto';
}

// Event listeners
closeModalBtn.addEventListener('click', closeModal);
closeModalBtn2.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
    }
});

// Preview mode buttons
modeButtons.forEach(button => {
    button.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');

        if (button.dataset.mode === 'fullscreen') {
            modalImage.style.width = '100%';
            modalImage.style.height = '100%';
            modalImage.style.objectFit = 'contain';
        } else if (button.dataset.mode === 'original') {
            modalImage.style.width = 'auto';
            modalImage.style.height = 'auto';
            modalImage.style.maxWidth = '100%';
            modalImage.style.maxHeight = '100%';
        } else {
            modalImage.style.width = '100%';
            modalImage.style.height = '100%';
            modalImage.style.objectFit = 'contain';
        }
    });
});

// Zoom controls
zoomOutBtn.addEventListener('click', () => {
    zoomLevel = Math.max(0.5, zoomLevel - 0.25);
    updateZoom();
});

zoomInBtn.addEventListener('click', () => {
    zoomLevel = Math.min(3, zoomLevel + 0.25);
    updateZoom();
});

zoomResetBtn.addEventListener('click', () => {
    zoomLevel = 1;
    rotation = 0;
    updateZoom();
});

rotateBtn.addEventListener('click', () => {
    rotation += 90;
    updateZoom();
});

// Search and filter events
search.oninput = render;
sort.onchange = render;
dateFilter.onchange = render;
tagFilter.onchange = render;
sizeFilter.onchange = render;

// Initialize
render();