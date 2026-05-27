class PhotoAnalyzer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    async analyze(file, aiResult = null) {
        const img = await this.loadImage(file);
        const imageData = this.getImageData(img);

        const dimensions = {
            sharpness: this.analyzeSharpness(imageData),
            exposure: this.analyzeExposure(imageData),
            contrast: this.analyzeContrast(imageData),
            color: this.analyzeColor(imageData),
            composition: this.analyzeComposition(imageData),
            subject: this.analyzeSubject(imageData),
            lighting: this.analyzeLighting(imageData),
            mood: this.analyzeMood(imageData),
        };

        // 如果有AI分析结果，融合到构图和主体评分中
        if (aiResult && aiResult.hasContent) {
            dimensions.composition = Math.round(
                dimensions.composition * 0.5 + aiResult.compositionScore * 0.5
            );
            dimensions.subject = Math.round(
                dimensions.subject * 0.5 + aiResult.subjectClarity * 0.5
            );
        }

        const score = this.calculateOverallScore(dimensions, aiResult);
        const level = this.getLevel(score);
        const { reason, suggestions } = this.generateReason(dimensions, level, aiResult);
        const strengths = this.getStrengths(dimensions);
        const weaknesses = this.getWeaknesses(dimensions);

        return {
            id: this.generateId(),
            file,
            name: file.name,
            size: file.size,
            dimensions,
            aiResult,
            score,
            level,
            reason,
            suggestions,
            strengths,
            weaknesses,
            thumbnail: await this.createThumbnail(img),
        };
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    getImageData(img) {
        const maxSize = 1200;
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

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.drawImage(img, 0, 0, width, height);
        return this.ctx.getImageData(0, 0, width, height);
    }

    analyzeSharpness(imageData) {
        const { data, width, height } = imageData;
        const gray = this.toGrayscale(data);

        // 方法1: 拉普拉斯方差（检测整体清晰度）
        let laplacianSum = 0;
        let laplacianSqSum = 0;
        const count = (width - 2) * (height - 2);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const laplacian =
                    -4 * gray[idx] +
                    gray[idx - 1] +
                    gray[idx + 1] +
                    gray[idx - width] +
                    gray[idx + width];

                laplacianSum += Math.abs(laplacian);
                laplacianSqSum += laplacian * laplacian;
            }
        }

        const mean = laplacianSum / count;
        const variance = laplacianSqSum / count - mean * mean;

        // 方法2: Sobel梯度（检测边缘强度）
        let gradientSum = 0;
        let gradientSqSum = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const gx = -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1]
                          + gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];
                const gy = -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1]
                          + gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
                const gradient = Math.sqrt(gx * gx + gy * gy);
                gradientSum += gradient;
                gradientSqSum += gradient * gradient;
            }
        }

        const gradientMean = gradientSum / count;
        const gradientVariance = gradientSqSum / count - gradientMean * gradientMean;

        // 方法3: Tenengrad（基于Sobel的清晰度评估）
        let tenengradSum = 0;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const gx = -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1]
                          + gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];
                const gy = -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1]
                          + gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
                tenengradSum += gx * gx + gy * gy;
            }
        }
        const tenengrad = tenengradSum / count;

        // 分辨率归一化因子（基于图像面积）
        const pixelCount = width * height;
        const scaleFactor = Math.sqrt(pixelCount / (1920 * 1080)); // 以1080p为基准

        // 综合评分
        const normalizedVariance = variance / (scaleFactor * scaleFactor);
        const normalizedGradient = gradientMean / scaleFactor;
        const normalizedTenengrad = tenengrad / (scaleFactor * scaleFactor * 1000);

        let score = 0;

        // 基于方差的评分（主要）
        if (normalizedVariance < 5) score += 10;
        else if (normalizedVariance < 20) score += 20 + (normalizedVariance - 5) * 2;
        else if (normalizedVariance < 100) score += 50 + (normalizedVariance - 20) * 0.5;
        else score += 90;

        // 基于梯度的评分（辅助）
        if (normalizedGradient > 15) score += 15;
        else if (normalizedGradient > 8) score += 10;
        else if (normalizedGradient > 3) score += 5;

        // 基于Tenengrad的评分（辅助）
        if (normalizedTenengrad > 50) score += 15;
        else if (normalizedTenengrad > 20) score += 10;
        else if (normalizedTenengrad > 5) score += 5;

        // 如果整体模糊（低梯度+低方差），额外扣分
        if (normalizedGradient < 2 && normalizedVariance < 10) {
            score *= 0.5;
        }

        // 均值过低说明可能是纯色图或非常模糊
        if (mean < 2) score *= 0.4;

        return Math.round(Math.max(5, Math.min(100, score)));
    }

    analyzeExposure(imageData) {
        const { data } = imageData;
        const histogram = new Array(256).fill(0);

        for (let i = 0; i < data.length; i += 4) {
            const brightness = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[brightness]++;
        }

        const totalPixels = data.length / 4;
        const meanBrightness = histogram.reduce((sum, count, val) => sum + val * count, 0) / totalPixels;

        let overexposed = 0;
        let underexposed = 0;
        for (let i = 248; i < 256; i++) overexposed += histogram[i];
        for (let i = 0; i < 8; i++) underexposed += histogram[i];

        const overexposedRatio = overexposed / totalPixels;
        const underexposedRatio = underexposed / totalPixels;

        let score = 100;
        const brightnessDiff = Math.abs(meanBrightness - 128);
        score -= brightnessDiff * 0.6;

        if (overexposedRatio > 0.01) score -= overexposedRatio * 500;
        if (underexposedRatio > 0.03) score -= underexposedRatio * 400;

        return Math.round(Math.max(5, Math.min(100, score)));
    }

    analyzeContrast(imageData) {
        const { data } = imageData;
        const gray = this.toGrayscale(data);

        let sum = 0;
        let sumSq = 0;
        const count = gray.length;

        for (let i = 0; i < count; i++) {
            sum += gray[i];
            sumSq += gray[i] * gray[i];
        }

        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        const stdDev = Math.sqrt(variance);

        let score = stdDev / 45 * 100;
        if (stdDev < 15) score *= 0.5;
        if (stdDev > 75) score *= 0.85;

        return Math.round(Math.max(5, Math.min(100, score)));
    }

    analyzeColor(imageData) {
        const { data } = imageData;
        let saturationSum = 0;
        const count = data.length / 4;

        const histogram = {
            r: new Array(256).fill(0),
            g: new Array(256).fill(0),
            b: new Array(256).fill(0),
        };

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;
            saturationSum += saturation;

            histogram.r[data[i]]++;
            histogram.g[data[i + 1]]++;
            histogram.b[data[i + 2]]++;
        }

        const avgSaturation = saturationSum / count;

        const rMean = histogram.r.reduce((sum, c, v) => sum + v * c, 0) / count;
        const gMean = histogram.g.reduce((sum, c, v) => sum + v * c, 0) / count;
        const bMean = histogram.b.reduce((sum, c, v) => sum + v * c, 0) / count;

        const rVar = histogram.r.reduce((sum, c, v) => sum + c * (v - rMean) ** 2, 0) / count;
        const gVar = histogram.g.reduce((sum, c, v) => sum + c * (v - gMean) ** 2, 0) / count;
        const bVar = histogram.b.reduce((sum, c, v) => sum + c * (v - bMean) ** 2, 0) / count;

        const colorVariance = (rVar + gVar + bVar) / 3;
        const colorStdDev = Math.sqrt(colorVariance);

        let score = 50;

        if (avgSaturation > 0.2 && avgSaturation < 0.6) {
            score += 30;
        } else if (avgSaturation < 0.08) {
            score -= 20;
        } else if (avgSaturation > 0.75) {
            score -= 15;
        }

        if (colorStdDev > 25 && colorStdDev < 65) {
            score += 20;
        } else if (colorStdDev < 12) {
            score -= 10;
        }

        return Math.round(Math.max(5, Math.min(100, score)));
    }

    analyzeComposition(imageData) {
        const { data, width, height } = imageData;
        const gray = this.toGrayscale(data);

        let score = 50;

        const thirdW = width / 3;
        const thirdH = height / 3;

        let edgeStrength = new Array(width * height).fill(0);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const gx = -gray[idx - 1] + gray[idx + 1];
                const gy = -gray[idx - width] + gray[idx + width];
                edgeStrength[idx] = Math.sqrt(gx * gx + gy * gy);
            }
        }

        let ruleOfThirdsScore = 0;
        const thirdLines = [
            { x: Math.round(thirdW), y1: 0, y2: height },
            { x: Math.round(thirdW * 2), y1: 0, y2: height },
            { y: Math.round(thirdH), x1: 0, x2: width },
            { y: Math.round(thirdH * 2), x1: 0, x2: width },
        ];

        for (const line of thirdLines) {
            let lineStrength = 0;
            if (line.x !== undefined) {
                for (let y = line.y1; y < line.y2; y++) {
                    const x = Math.min(Math.max(line.x, 1), width - 2);
                    lineStrength += edgeStrength[y * width + x];
                }
            } else {
                for (let x = line.x1; x < line.x2; x++) {
                    const y = Math.min(Math.max(line.y, 1), height - 2);
                    lineStrength += edgeStrength[y * width + x];
                }
            }
            ruleOfThirdsScore += lineStrength / (width + height);
        }

        ruleOfThirdsScore = Math.min(30, ruleOfThirdsScore / 4);
        score += ruleOfThirdsScore;

        let symmetryScore = 0;
        const centerX = Math.floor(width / 2);
        let diffSum = 0;
        let pixelCount = 0;

        for (let y = 0; y < height; y += 4) {
            for (let x = 0; x < centerX; x += 4) {
                const mirrorX = width - 1 - x;
                const idx1 = (y * width + x) * 4;
                const idx2 = (y * width + mirrorX) * 4;
                diffSum += Math.abs(data[idx1] - data[idx2]) +
                          Math.abs(data[idx1 + 1] - data[idx2 + 1]) +
                          Math.abs(data[idx1 + 2] - data[idx2 + 2]);
                pixelCount++;
            }
        }

        const avgDiff = diffSum / (pixelCount * 3);
        symmetryScore = Math.max(0, 20 - avgDiff / 5);
        score += symmetryScore;

        const centerXRegion = Math.floor(width * 0.4);
        const centerYRegion = Math.floor(height * 0.4);
        const regionWidth = Math.floor(width * 0.2);
        const regionHeight = Math.floor(height * 0.2);

        let centerEdgeSum = 0;
        let totalEdgeSum = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const edge = edgeStrength[y * width + x];
                totalEdgeSum += edge;

                if (x >= centerXRegion && x < centerXRegion + regionWidth &&
                    y >= centerYRegion && y < centerYRegion + regionHeight) {
                    centerEdgeSum += edge;
                }
            }
        }

        const centerRatio = centerEdgeSum / totalEdgeSum;
        if (centerRatio > 0.15 && centerRatio < 0.4) {
            score += 10;
        } else if (centerRatio < 0.05) {
            score -= 10;
        }

        return Math.round(Math.max(5, Math.min(100, score)));
    }

    analyzeSubject(imageData) {
        const { data, width, height } = imageData;
        const gray = this.toGrayscale(data);

        let edgeStrength = new Array(width * height).fill(0);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const gx = -gray[idx - 1] + gray[idx + 1];
                const gy = -gray[idx - width] + gray[idx + width];
                edgeStrength[idx] = Math.sqrt(gx * gx + gy * gy);
            }
        }

        const blockSize = 32;
        const blocksX = Math.ceil(width / blockSize);
        const blocksY = Math.ceil(height / blockSize);
        const blockSaliency = [];

        for (let by = 0; by < blocksY; by++) {
            for (let bx = 0; bx < blocksX; bx++) {
                let blockEdgeSum = 0;
                let pixelCount = 0;

                const startX = bx * blockSize;
                const startY = by * blockSize;
                const endX = Math.min(startX + blockSize, width);
                const endY = Math.min(startY + blockSize, height);

                for (let y = startY; y < endY; y++) {
                    for (let x = startX; x < endX; x++) {
                        blockEdgeSum += edgeStrength[y * width + x];
                        pixelCount++;
                    }
                }

                blockSaliency.push({
                    x: bx,
                    y: by,
                    saliency: blockEdgeSum / pixelCount,
                });
            }
        }

        blockSaliency.sort((a, b) => b.saliency - a.saliency);
        const topBlocks = blockSaliency.slice(0, Math.max(5, Math.floor(blockSaliency.length * 0.1)));

        const avgX = topBlocks.reduce((sum, b) => sum + b.x, 0) / topBlocks.length;
        const avgY = topBlocks.reduce((sum, b) => sum + b.y, 0) / topBlocks.length;

        const centerX = blocksX / 2;
        const centerY = blocksY / 2;
        const distFromCenter = Math.sqrt((avgX - centerX) ** 2 + (avgY - centerY) ** 2);
        const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);

        let score = 50;

        const normalizedDist = distFromCenter / maxDist;
        if (normalizedDist < 0.3) {
            score += 25;
        } else if (normalizedDist < 0.5) {
            score += 15;
        } else {
            score += 5;
        }

        const totalSaliency = blockSaliency.reduce((sum, b) => sum + b.saliency, 0);
        const topSaliency = topBlocks.reduce((sum, b) => sum + b.saliency, 0);
        const saliencyRatio = topSaliency / totalSaliency;

        if (saliencyRatio > 0.3 && saliencyRatio < 0.6) {
            score += 20;
        } else if (saliencyRatio > 0.6) {
            score += 10;
        }

        return Math.round(Math.max(5, Math.min(100, score)));
    }

    analyzeLighting(imageData) {
        const { data } = imageData;
        const gray = this.toGrayscale(data);

        const histogram = new Array(256).fill(0);
        for (let i = 0; i < gray.length; i++) {
            histogram[gray[i]]++;
        }

        const totalPixels = gray.length;
        const meanBrightness = histogram.reduce((sum, count, val) => sum + val * count, 0) / totalPixels;

        let varianceSum = 0;
        for (let i = 0; i < 256; i++) {
            varianceSum += histogram[i] * (i - meanBrightness) ** 2;
        }
        const stdDev = Math.sqrt(varianceSum / totalPixels);

        let lowKey = 0;
        let highKey = 0;
        for (let i = 0; i < 64; i++) lowKey += histogram[i];
        for (let i = 192; i < 256; i++) highKey += histogram[i];

        const lowKeyRatio = lowKey / totalPixels;
        const highKeyRatio = highKey / totalPixels;

        let score = 50;

        if (stdDev > 40 && stdDev < 70) {
            score += 25;
        } else if (stdDev < 20) {
            score -= 15;
        } else if (stdDev > 80) {
            score -= 10;
        }

        if (lowKeyRatio > 0.6) {
            score += 10;
        } else if (highKeyRatio > 0.6) {
            score += 10;
        }

        let shadowHighlightRatio = 1;
        if (lowKeyRatio > 0.01 && highKeyRatio > 0.01) {
            shadowHighlightRatio = Math.min(lowKeyRatio, highKeyRatio) / Math.max(lowKeyRatio, highKeyRatio);
        }

        if (shadowHighlightRatio > 0.5) {
            score += 15;
        } else if (shadowHighlightRatio > 0.2) {
            score += 5;
        }

        return Math.round(Math.max(5, Math.min(100, score)));
    }

    analyzeMood(imageData) {
        const { data } = imageData;

        let rSum = 0, gSum = 0, bSum = 0;
        const count = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            rSum += data[i];
            gSum += data[i + 1];
            bSum += data[i + 2];
        }

        const rAvg = rSum / count / 255;
        const gAvg = gSum / count / 255;
        const bAvg = bSum / count / 255;

        const gray = this.toGrayscale(data);
        let brightnessSum = 0;
        for (let i = 0; i < gray.length; i++) {
            brightnessSum += gray[i];
        }
        const avgBrightness = brightnessSum / gray.length / 255;

        let saturationSum = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            saturationSum += max === 0 ? 0 : (max - min) / max;
        }
        const avgSaturation = saturationSum / count;

        let score = 50;

        if (avgSaturation > 0.15 && avgSaturation < 0.55) {
            score += 15;
        }

        const warmth = rAvg - bAvg;
        if (Math.abs(warmth) < 0.15) {
            score += 10;
        }

        if (avgBrightness > 0.3 && avgBrightness < 0.7) {
            score += 15;
        }

        return Math.round(Math.max(5, Math.min(100, score)));
    }

    calculateOverallScore(dimensions, aiResult = null) {
        const weights = {
            sharpness: 0.20,
            exposure: 0.15,
            contrast: 0.10,
            color: 0.12,
            composition: 0.18,
            subject: 0.12,
            lighting: 0.08,
            mood: 0.05,
        };

        let totalScore = 0;
        for (const [key, weight] of Object.entries(weights)) {
            totalScore += dimensions[key] * weight;
        }

        const scores = Object.values(dimensions);
        const minScore = Math.min(...scores);
        if (minScore < 20) {
            totalScore *= 0.8;
        }

        // AI加分：如果检测到明确主体且置信度高
        if (aiResult && aiResult.hasContent) {
            if (aiResult.mainSubject && aiResult.mainSubject.score > 0.6) {
                totalScore += 5;
            }
            if (aiResult.sceneType !== 'unknown') {
                totalScore += 3;
            }
        }

        return Math.round(Math.max(5, Math.min(100, totalScore)));
    }

    getLevel(score) {
        if (score >= 80) return 'strong';
        if (score >= 65) return 'recommend';
        if (score >= 45) return 'normal';
        return 'reject';
    }

    getLevelText(level) {
        const texts = {
            strong: '⭐⭐⭐ 大师之作',
            recommend: '⭐⭐ 优秀作品',
            normal: '⭐ 中规中矩',
            reject: '❌ 需要改进',
        };
        return texts[level] || '未知';
    }

    generateReason(dimensions, level, aiResult = null) {
        const reasons = [];
        const suggestions = [];

        // AI内容识别结果
        if (aiResult && aiResult.hasContent) {
            const sceneText = this.getSceneTypeText(aiResult.sceneType);
            reasons.push(`识别为${sceneText}场景`);

            if (aiResult.mainSubject) {
                reasons.push(`主体：${aiResult.mainSubject.class}（置信度${Math.round(aiResult.mainSubject.score * 100)}%）`);
            }

            if (aiResult.objects.length > 1) {
                const objNames = [...new Set(aiResult.objects.map(o => o.class))].slice(0, 3);
                reasons.push(`检测到：${objNames.join('、')}`);
            }
        }

        // 技术指标点评
        if (dimensions.sharpness >= 75) {
            reasons.push('焦点清晰，细节锐利');
        } else if (dimensions.sharpness >= 50) {
            reasons.push('清晰度尚可');
        } else {
            reasons.push('画面模糊，对焦不准');
            suggestions.push('使用三脚架或提高快门速度');
        }

        if (dimensions.exposure >= 75) {
            reasons.push('曝光精准，层次丰富');
        } else if (dimensions.exposure < 40) {
            if (dimensions.exposure < 30) {
                reasons.push('曝光严重不足');
                suggestions.push('增加曝光补偿或使用补光');
            } else {
                reasons.push('曝光偏差明显');
                suggestions.push('注意测光，调整曝光参数');
            }
        }

        if (dimensions.contrast >= 70) {
            reasons.push('对比度适中，立体感强');
        } else if (dimensions.contrast < 40) {
            reasons.push('画面发灰，缺乏层次');
            suggestions.push('后期适当增加对比度');
        }

        if (dimensions.color >= 70) {
            reasons.push('色彩自然，还原准确');
        } else if (dimensions.color < 40) {
            reasons.push('色彩失真或饱和度异常');
            suggestions.push('检查白平衡设置');
        }

        if (dimensions.composition >= 75) {
            reasons.push('构图讲究，视觉引导出色');
        } else if (dimensions.composition >= 50) {
            reasons.push('构图中规中矩');
        } else {
            reasons.push('构图有待提升');
            suggestions.push('尝试三分法或引导线构图');
        }

        if (dimensions.subject >= 70) {
            reasons.push('主体突出，视觉焦点明确');
        } else if (dimensions.subject < 40) {
            reasons.push('主体不突出，画面较乱');
            suggestions.push('简化画面，突出主体');
        }

        if (dimensions.lighting >= 70) {
            reasons.push('光影运用出色');
        } else if (dimensions.lighting < 40) {
            reasons.push('光影表现一般');
            suggestions.push('注意光线方向和质感');
        }

        if (dimensions.mood >= 70) {
            reasons.push('氛围感强，富有感染力');
        } else if (dimensions.mood < 40) {
            reasons.push('画面情感表达不足');
        }

        return {
            reason: reasons.length > 0 ? reasons.join('；') : '综合表现一般',
            suggestions: suggestions.slice(0, 3),
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
        return texts[sceneType] || '通用';
    }

    getStrengths(dimensions) {
        const strengths = [];
        const nameMap = {
            sharpness: '清晰度',
            exposure: '曝光',
            contrast: '对比度',
            color: '色彩',
            composition: '构图',
            subject: '主体',
            lighting: '光影',
            mood: '氛围',
        };

        const entries = Object.entries(dimensions).sort((a, b) => b[1] - a[1]);
        for (const [key, value] of entries) {
            if (value >= 70) {
                strengths.push(`${nameMap[key]}(${value})`);
            }
        }

        return strengths.slice(0, 3);
    }

    getWeaknesses(dimensions) {
        const weaknesses = [];
        const nameMap = {
            sharpness: '清晰度',
            exposure: '曝光',
            contrast: '对比度',
            color: '色彩',
            composition: '构图',
            subject: '主体',
            lighting: '光影',
            mood: '氛围',
        };

        const entries = Object.entries(dimensions).sort((a, b) => a[1] - b[1]);
        for (const [key, value] of entries) {
            if (value < 50) {
                weaknesses.push(`${nameMap[key]}(${value})`);
            }
        }

        return weaknesses.slice(0, 3);
    }

    toGrayscale(data) {
        const gray = new Uint8ClampedArray(data.length / 4);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        return gray;
    }

    createThumbnail(img) {
        return new Promise((resolve) => {
            const maxSize = 300;
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

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        });
    }

    generateId() {
        return 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}
