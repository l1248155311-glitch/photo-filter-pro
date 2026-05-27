class AIAnalyzer {
    constructor() {
        this.cocoModel = null;
        this.isModelLoaded = false;
    }

    async loadModels(onProgress) {
        // 检查TensorFlow.js是否已加载
        if (!window.tfLoaded) {
            console.warn('TensorFlow.js未加载');
            if (onProgress) onProgress('TensorFlow.js未加载，使用基础模式', 0);
            return false;
        }

        if (!window.cocoSsdLoaded) {
            console.warn('COCO-SSD未加载');
            if (onProgress) onProgress('COCO-SSD未加载，使用基础模式', 0);
            return false;
        }

        try {
            if (onProgress) onProgress('正在加载AI模型（首次约20-30秒）...', 10);

            // 等待cocoSsd对象可用
            let retries = 0;
            while (typeof cocoSsd === 'undefined' && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }

            if (typeof cocoSsd === 'undefined') {
                throw new Error('COCO-SSD对象未定义');
            }

            if (onProgress) onProgress('正在下载模型文件...', 30);

            this.cocoModel = await cocoSsd.load({
                base: 'lite_mobilenet_v2'
            });

            this.isModelLoaded = true;
            if (onProgress) onProgress('AI模型加载完成！', 100);

            return true;
        } catch (error) {
            console.error('AI模型加载失败:', error);
            if (onProgress) onProgress('AI模型加载失败，使用基础分析模式', 0);
            return false;
        }
    }

    async analyzeImage(imageElement) {
        if (!this.isModelLoaded || !this.cocoModel) {
            return this.getFallbackResult();
        }

        try {
            const predictions = await this.cocoModel.detect(imageElement);

            const result = {
                hasContent: predictions.length > 0,
                objects: predictions.map(p => ({
                    class: p.class,
                    score: p.score,
                    bbox: p.bbox,
                })),
                mainSubject: this.findMainSubject(predictions, imageElement),
                sceneType: this.detectSceneType(predictions),
                compositionScore: this.analyzeCompositionWithAI(predictions, imageElement),
                subjectClarity: this.analyzeSubjectClarity(predictions, imageElement),
            };

            return result;
        } catch (error) {
            console.error('AI分析失败:', error);
            return this.getFallbackResult();
        }
    }

    findMainSubject(predictions, imageElement) {
        if (predictions.length === 0) return null;

        const imgArea = imageElement.width * imageElement.height;

        let mainObj = null;
        let maxArea = 0;

        for (const pred of predictions) {
            const [x, y, width, height] = pred.bbox;
            const area = width * height;

            if (area > maxArea && pred.score > 0.3) {
                maxArea = area;
                mainObj = pred;
            }
        }

        if (!mainObj) return null;

        const [x, y, width, height] = mainObj.bbox;
        const centerX = (x + width / 2) / imageElement.width;
        const centerY = (y + height / 2) / imageElement.height;

        const areaRatio = maxArea / imgArea;

        return {
            class: mainObj.class,
            score: mainObj.score,
            centerX,
            centerY,
            areaRatio,
            bbox: mainObj.bbox,
        };
    }

    detectSceneType(predictions) {
        const classes = predictions.map(p => p.class.toLowerCase());

        const personClasses = ['person'];
        const animalClasses = ['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'];
        const vehicleClasses = ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'train', 'boat', 'airplane'];
        const foodClasses = ['pizza', 'hot dog', 'cake', 'donut', 'sandwich', 'apple', 'banana', 'orange'];
        const indoorClasses = ['chair', 'couch', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'keyboard'];

        const hasPerson = classes.some(c => personClasses.includes(c));
        const hasAnimal = classes.some(c => animalClasses.includes(c));
        const hasVehicle = classes.some(c => vehicleClasses.includes(c));
        const hasFood = classes.some(c => foodClasses.includes(c));
        const hasIndoor = classes.some(c => indoorClasses.includes(c));

        if (hasPerson && predictions.filter(p => p.class.toLowerCase() === 'person').length > 1) {
            return 'group_photo';
        }
        if (hasPerson) return 'portrait';
        if (hasAnimal) return 'animal';
        if (hasVehicle) return 'vehicle';
        if (hasFood) return 'food';
        if (hasIndoor) return 'indoor';

        return 'general';
    }

    analyzeCompositionWithAI(predictions, imageElement) {
        if (predictions.length === 0) return 50;

        let score = 50;

        const mainSubject = this.findMainSubject(predictions, imageElement);
        if (mainSubject) {
            const cx = mainSubject.centerX;
            const cy = mainSubject.centerY;

            const thirdX = [1/3, 2/3];
            const thirdY = [1/3, 2/3];

            let closestDistX = Math.min(...thirdX.map(tx => Math.abs(cx - tx)));
            let closestDistY = Math.min(...thirdY.map(ty => Math.abs(cy - ty)));

            const ruleOfThirdsScore = 1 - (closestDistX + closestDistY) / 2;
            score += ruleOfThirdsScore * 20;

            if (mainSubject.areaRatio > 0.05 && mainSubject.areaRatio < 0.4) {
                score += 15;
            } else if (mainSubject.areaRatio > 0.4) {
                score += 5;
            }
        }

        if (predictions.length === 1) {
            score += 10;
        } else if (predictions.length > 5) {
            score -= 10;
        }

        return Math.round(Math.max(10, Math.min(100, score)));
    }

    analyzeSubjectClarity(predictions, imageElement) {
        if (predictions.length === 0) return 50;

        let score = 50;

        const mainSubject = this.findMainSubject(predictions, imageElement);
        if (mainSubject) {
            if (mainSubject.score > 0.7) {
                score += 25;
            } else if (mainSubject.score > 0.5) {
                score += 15;
            } else if (mainSubject.score < 0.3) {
                score -= 15;
            }

            if (mainSubject.areaRatio > 0.1 && mainSubject.areaRatio < 0.35) {
                score += 15;
            }
        }

        const highConfCount = predictions.filter(p => p.score > 0.5).length;
        if (highConfCount >= 2) {
            score += 10;
        }

        return Math.round(Math.max(10, Math.min(100, score)));
    }

    getFallbackResult() {
        return {
            hasContent: false,
            objects: [],
            mainSubject: null,
            sceneType: 'unknown',
            compositionScore: 50,
            subjectClarity: 50,
        };
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
        return texts[sceneType] || '未知';
    }

    getObjectsText(objects) {
        if (objects.length === 0) return '未检测到物体';

        const classNames = [...new Set(objects.map(o => o.class))];
        return classNames.slice(0, 5).join(', ');
    }
}
