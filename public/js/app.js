class PhotoReviewApp {
    constructor() {
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.progressSection = document.getElementById('progress-section');
        this.progressFill = document.getElementById('progress-fill');
        this.progressStatus = document.getElementById('progress-status');
        this.resultsSection = document.getElementById('results-section');
        this.reviewList = document.getElementById('review-list');
        this.totalCount = document.getElementById('total-count');
        this.modal = document.getElementById('photo-modal');
        this.modalImg = document.getElementById('modal-img');
        this.modalFilename = document.getElementById('modal-filename');
        this.modalReview = document.getElementById('modal-review');

        this.reviews = [];
        this.init();
    }

    init() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        document.getElementById('btn-new-batch').addEventListener('click', () => {
            this.uploadArea.classList.remove('hidden');
            this.resultsSection.classList.add('hidden');
            this.fileInput.value = '';
        });

        this.modal.querySelector('.modal-overlay').addEventListener('click', () => this.hideModal());
        this.modal.querySelector('.modal-close').addEventListener('click', () => this.hideModal());
    }

    async handleFiles(files) {
        const imageFiles = Array.from(files).filter(f =>
            f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'image/webp'
        );

        if (imageFiles.length === 0) {
            alert('请选择 JPG、PNG 或 WebP 格式的图片');
            return;
        }

        const file = imageFiles[0];
        await this.analyzePhoto(file);
    }

    async analyzePhoto(file) {
        this.uploadArea.classList.add('hidden');
        this.progressSection.classList.remove('hidden');
        this.progressFill.style.width = '0%';
        this.progressStatus.textContent = '正在读取照片...';

        try {
            this.progressStatus.textContent = '正在压缩图片...';
            this.progressFill.style.width = '20%';
            const base64 = await this.imageToBase64(file);

            this.progressStatus.textContent = '正在调用AI分析，这可能需要10-30秒...';
            this.progressFill.style.width = '50%';

            // 调用API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageBase64: base64,
                    filename: file.name
                })
            });

            this.progressFill.style.width = '90%';

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || error.error || '分析失败');
            }

            const result = await response.json();

            this.progressFill.style.width = '100%';
            this.progressStatus.textContent = '分析完成！';

            await this.sleep(500);

            const reviewData = {
                id: Date.now(),
                filename: file.name,
                thumbnail: await this.createThumbnail(file),
                review: result.review,
                timestamp: new Date().toLocaleString('zh-CN')
            };

            this.reviews.unshift(reviewData);
            this.showResults();

        } catch (error) {
            console.error('分析失败:', error);
            alert('分析失败: ' + error.message);
            this.progressSection.classList.add('hidden');
            this.uploadArea.classList.remove('hidden');
        }
    }

    imageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 1024;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxSize) {
                            height = Math.round(height * maxSize / width);
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = Math.round(width * maxSize / height);
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject;
                img.src = reader.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    createThumbnail(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 400;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxSize) {
                            height = Math.round(height * maxSize / width);
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = Math.round(width * maxSize / height);
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    showResults() {
        this.progressSection.classList.add('hidden');
        this.resultsSection.classList.remove('hidden');
        this.totalCount.textContent = this.reviews.length;

        this.reviewList.innerHTML = this.reviews.map(review => `
            <div class="review-card" data-id="${review.id}">
                <div class="review-card-header">
                    <img src="${review.thumbnail}" alt="${review.filename}" class="review-thumbnail">
                    <div class="review-meta">
                        <h4>${review.filename}</h4>
                        <span class="review-time">${review.timestamp}</span>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="app.viewReview(${review.id})">查看详情</button>
                </div>
                <div class="review-preview">${review.review.substring(0, 200)}...</div>
            </div>
        `).join('');
    }

    viewReview(id) {
        const review = this.reviews.find(r => r.id === id);
        if (!review) return;

        this.modalImg.src = review.thumbnail;
        this.modalFilename.textContent = review.filename;
        this.modalReview.innerHTML = `
            <div class="ai-review-box">
                <div class="ai-review-title">🤖 AI专业点评</div>
                ${review.review}
            </div>
        `;

        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const app = new PhotoReviewApp();
