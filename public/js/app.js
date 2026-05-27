class PhotoFilterApp {
    constructor() {
        this.analyzer = new PhotoAnalyzer();
        this.aiAnalyzer = new AIAnalyzer();
        this.ui = new PhotoUI();
        this.exporter = new PhotoExporter();
        this.photos = [];
        this.isAiReady = false;
    }

    async init() {
        this.ui.init((files) => this.handleFiles(files));
        this.initExportButtons();

        // 后台加载AI模型，不阻止用户操作
        this.loadAiInBackground();
    }

    async loadAiInBackground() {
        try {
            this.isAiReady = await this.aiAnalyzer.loadModels((status, progress) => {
                console.log('AI加载状态:', status);
            });
            console.log('AI模型加载结果:', this.isAiReady ? '成功' : '失败，使用基础模式');
        } catch (error) {
            console.warn('AI模型加载失败:', error);
            this.isAiReady = false;
        }
    }

    async handleFiles(files) {
        this.ui.showProgress();

        const total = files.length;
        const modeText = this.isAiReady ? 'AI+像素' : '像素分析';
        const startIndex = this.photos.length;

        for (let i = 0; i < total; i++) {
            const file = files[i];
            this.ui.updateProgress(i, total, `[${modeText}] 分析: ${file.name} (${i + 1}/${total})`);

            try {
                let aiResult = null;

                if (this.isAiReady) {
                    try {
                        const img = await this.loadImageForAI(file);
                        aiResult = await this.aiAnalyzer.analyzeImage(img);
                    } catch (aiError) {
                        console.warn(`AI分析失败: ${file.name}`, aiError);
                    }
                }

                const result = await this.analyzer.analyze(file, aiResult);
                this.photos.push(result);
            } catch (error) {
                console.error(`分析失败: ${file.name}`, error);
            }

            // 让浏览器有时间响应
            if (i % 5 === 0) {
                await this.sleep(10);
            }
        }

        this.ui.updateProgress(total, total, `分析完成！共 ${this.photos.length} 张照片`);
        await this.sleep(300);

        this.ui.hideProgress();
        this.ui.showResults(this.photos);
    }

    loadImageForAI(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('图片加载超时'));
            }, 10000);

            img.onload = () => {
                clearTimeout(timeout);
                resolve(img);
            };
            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('图片加载失败'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    initExportButtons() {
        document.getElementById('btn-export-photos').addEventListener('click', () => {
            this.exporter.exportRecommendedPhotos(this.photos);
        });

        document.getElementById('btn-export-report').addEventListener('click', () => {
            this.exporter.exportReport(this.photos);
        });

        document.getElementById('btn-new-batch').addEventListener('click', () => {
            this.photos = [];
            this.ui.reset();
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const app = new PhotoFilterApp();
        await app.init();
    } catch (error) {
        console.error('应用初始化失败:', error);
    }
});
