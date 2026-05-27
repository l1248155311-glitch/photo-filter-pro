class PhotoUI {
    constructor() {
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.uploadMoreArea = document.getElementById('upload-more-area');
        this.fileInputMore = document.getElementById('file-input-more');
        this.progressSection = document.getElementById('progress-section');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.progressStatus = document.getElementById('progress-status');
        this.resultsSection = document.getElementById('results-section');
        this.photoGrid = document.getElementById('photo-grid');
        this.modal = document.getElementById('photo-modal');
        this.modalImg = document.getElementById('modal-img');
        this.modalFilename = document.getElementById('modal-filename');
        this.modalScore = document.getElementById('modal-score');
        this.modalLevel = document.getElementById('modal-level');
        this.modalAiResult = document.getElementById('modal-ai-result');
        this.modalDimensions = document.getElementById('modal-dimensions');
        this.modalReason = document.getElementById('modal-reason');
        this.modalStrengths = document.getElementById('modal-strengths');
        this.modalWeaknesses = document.getElementById('modal-weaknesses');
        this.modalSuggestions = document.getElementById('modal-suggestions');
        this.totalCount = document.getElementById('total-count');
        this.recommendCount = document.getElementById('recommend-count');
        this.rejectCount = document.getElementById('reject-count');

        this.currentFilter = 'all';
        this.photos = [];
    }

    init(onFilesSelected) {
        this.onFilesSelected = onFilesSelected;

        // 初始上传区域
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

        // 继续上传区域
        this.uploadMoreArea.addEventListener('click', () => this.fileInputMore.click());
        this.fileInputMore.addEventListener('change', (e) => this.handleFiles(e.target.files));

        this.uploadMoreArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadMoreArea.classList.add('dragover');
        });

        this.uploadMoreArea.addEventListener('dragleave', () => {
            this.uploadMoreArea.classList.remove('dragover');
        });

        this.uploadMoreArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadMoreArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        this.initFilterTabs();
        this.initModal();
    }

    handleFiles(files) {
        const imageFiles = Array.from(files).filter(f =>
            f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'image/webp'
        );

        if (imageFiles.length === 0) {
            alert('请选择 JPG、PNG 或 WebP 格式的图片');
            return;
        }

        this.onFilesSelected(imageFiles);
    }

    showProgress() {
        this.uploadArea.classList.add('hidden');
        this.progressSection.classList.remove('hidden');
    }

    updateProgress(current, total, status) {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = total > 1 ? `${current}/${total}` : '';
        this.progressStatus.textContent = status || '分析中...';
    }

    hideProgress() {
        this.progressSection.classList.add('hidden');
    }

    showResults(photos) {
        this.photos = photos;
        this.resultsSection.classList.remove('hidden');

        const total = photos.length;
        const recommended = photos.filter(p => p.level === 'strong' || p.level === 'recommend').length;
        const rejected = photos.filter(p => p.level === 'reject').length;

        this.totalCount.textContent = total;
        this.recommendCount.textContent = recommended;
        this.rejectCount.textContent = rejected;

        this.renderGrid();
    }

    renderGrid() {
        const filtered = this.currentFilter === 'all'
            ? this.photos
            : this.photos.filter(p => p.level === this.currentFilter);

        filtered.sort((a, b) => b.score - a.score);

        this.photoGrid.innerHTML = filtered.map(photo => this.createPhotoCard(photo)).join('');

        this.photoGrid.querySelectorAll('.photo-card').forEach(card => {
            card.addEventListener('click', () => {
                const photoId = card.dataset.id;
                const photo = this.photos.find(p => p.id === photoId);
                if (photo) this.showModal(photo);
            });
        });
    }

    createPhotoCard(photo) {
        const scoreClass = photo.score >= 70 ? 'high' : photo.score >= 50 ? 'medium' : 'low';
        const levelText = {
            strong: '大师',
            recommend: '优秀',
            normal: '一般',
            reject: '待改进',
        }[photo.level];

        const topDimension = this.getTopDimension(photo.dimensions);

        return `
            <div class="photo-card" data-id="${photo.id}">
                <img src="${photo.thumbnail}" alt="${photo.name}" loading="lazy">
                <div class="photo-card-info">
                    <div class="photo-card-score">
                        <span class="score-badge ${scoreClass}">${photo.score}</span>
                        <span class="level-badge ${photo.level}">${levelText}</span>
                    </div>
                    <div class="photo-card-filename">${photo.name}</div>
                    <div class="photo-card-dimensions">
                        <span class="dimension-tag">${topDimension}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getTopDimension(dimensions) {
        const nameMap = {
            sharpness: '清晰锐利',
            exposure: '曝光精准',
            contrast: '对比度佳',
            color: '色彩出色',
            composition: '构图讲究',
            subject: '主体突出',
            lighting: '光影出色',
            mood: '氛围感强',
        };

        let maxKey = 'sharpness';
        let maxValue = 0;

        for (const [key, value] of Object.entries(dimensions)) {
            if (value > maxValue) {
                maxValue = value;
                maxKey = key;
            }
        }

        return nameMap[maxKey];
    }

    initFilterTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.filter;
                this.renderGrid();
            });
        });
    }

    initModal() {
        this.modal.querySelector('.modal-overlay').addEventListener('click', () => this.hideModal());
        this.modal.querySelector('.modal-close').addEventListener('click', () => this.hideModal());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hideModal();
        });
    }

    showModal(photo) {
        this.modalImg.src = photo.thumbnail;
        this.modalFilename.textContent = photo.name;

        const scoreClass = photo.score >= 70 ? 'high' : photo.score >= 50 ? 'medium' : 'low';
        this.modalScore.querySelector('.score-value').textContent = photo.score;
        this.modalScore.querySelector('.score-circle').className = `score-circle ${scoreClass}`;

        const levelTexts = {
            strong: '⭐⭐⭐ 大师之作',
            recommend: '⭐⭐ 优秀作品',
            normal: '⭐ 中规中矩',
            reject: '❌ 需要改进',
        };
        this.modalLevel.textContent = levelTexts[photo.level];
        this.modalLevel.className = `modal-level ${photo.level}`;

        // AI识别结果
        if (photo.aiResult && photo.aiResult.hasContent) {
            const sceneType = this.getSceneTypeText(photo.aiResult.sceneType);
            const objects = photo.aiResult.objects.slice(0, 3).map(o =>
                `${o.class}(${Math.round(o.score * 100)}%)`
            ).join(', ');

            this.modalAiResult.innerHTML = `
                <div class="ai-result-box">
                    <div class="ai-badge">🤖 AI识别</div>
                    <div class="ai-info">
                        <span class="ai-tag">场景：${sceneType}</span>
                        ${photo.aiResult.mainSubject ? `<span class="ai-tag">主体：${photo.aiResult.mainSubject.class}</span>` : ''}
                        ${objects ? `<span class="ai-tag">物体：${objects}</span>` : ''}
                    </div>
                </div>
            `;
            this.modalAiResult.classList.remove('hidden');
        } else {
            this.modalAiResult.classList.add('hidden');
        }

        const dimensions = [
            { name: '清晰度', value: photo.dimensions.sharpness, icon: '🔍' },
            { name: '曝光', value: photo.dimensions.exposure, icon: '☀️' },
            { name: '对比度', value: photo.dimensions.contrast, icon: '◐' },
            { name: '色彩', value: photo.dimensions.color, icon: '🎨' },
            { name: '构图', value: photo.dimensions.composition, icon: '📐' },
            { name: '主体', value: photo.dimensions.subject, icon: '🎯' },
            { name: '光影', value: photo.dimensions.lighting, icon: '💡' },
            { name: '氛围', value: photo.dimensions.mood, icon: '✨' },
        ];

        this.modalDimensions.innerHTML = dimensions.map(d => {
            const barClass = d.value >= 70 ? 'high' : d.value >= 50 ? 'medium' : 'low';
            return `
                <div class="dimension-row">
                    <span class="dimension-name">${d.icon} ${d.name}</span>
                    <div class="dimension-bar">
                        <div class="dimension-fill ${barClass}" style="width: ${d.value}%"></div>
                    </div>
                    <span class="dimension-score">${d.value}</span>
                </div>
            `;
        }).join('');

        this.modalReason.innerHTML = `<h4>专业点评</h4><p>${photo.reason}</p>`;

        if (photo.strengths && photo.strengths.length > 0) {
            this.modalStrengths.innerHTML = `
                <h4>✅ 亮点</h4>
                <div class="tag-list">
                    ${photo.strengths.map(s => `<span class="tag tag-green">${s}</span>`).join('')}
                </div>
            `;
            this.modalStrengths.classList.remove('hidden');
        } else {
            this.modalStrengths.classList.add('hidden');
        }

        if (photo.weaknesses && photo.weaknesses.length > 0) {
            this.modalWeaknesses.innerHTML = `
                <h4>⚠️ 不足</h4>
                <div class="tag-list">
                    ${photo.weaknesses.map(w => `<span class="tag tag-red">${w}</span>`).join('')}
                </div>
            `;
            this.modalWeaknesses.classList.remove('hidden');
        } else {
            this.modalWeaknesses.classList.add('hidden');
        }

        if (photo.suggestions && photo.suggestions.length > 0) {
            this.modalSuggestions.innerHTML = `
                <h4>💡 改进建议</h4>
                <ul class="suggestion-list">
                    ${photo.suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            `;
            this.modalSuggestions.classList.remove('hidden');
        } else {
            this.modalSuggestions.classList.add('hidden');
        }

        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    getSceneTypeText(sceneType) {
        const texts = {
            portrait: '人像',
            group_photo: '合影',
            animal: '动物',
            vehicle: '交通工具',
            food: '美食',
            indoor: '室内',
            general: '通用',
            unknown: '未知',
        };
        return texts[sceneType] || '通用';
    }

    hideModal() {
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    reset() {
        this.uploadArea.classList.remove('hidden');
        this.progressSection.classList.add('hidden');
        this.resultsSection.classList.add('hidden');
        this.photoGrid.innerHTML = '';
        this.photos = [];
        this.fileInput.value = '';
    }
}
