class PhotoExporter {
    async exportRecommendedPhotos(photos) {
        const recommended = photos.filter(p => p.level === 'strong' || p.level === 'recommend');

        if (recommended.length === 0) {
            alert('没有推荐的照片可以导出');
            return;
        }

        const btn = document.getElementById('btn-export-photos');
        const originalText = btn.textContent;
        btn.textContent = '正在打包...';
        btn.disabled = true;

        try {
            const zip = new JSZip();
            const folder = zip.folder('推荐照片');

            for (const photo of recommended) {
                const arrayBuffer = await photo.file.arrayBuffer();
                folder.file(photo.name, arrayBuffer);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `推荐照片_${this.getDateString()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败，请重试');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    exportReport(photos) {
        const report = this.generateReport(photos);
        const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `照片分析报告_${this.getDateString()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    generateReport(photos) {
        const lines = [];
        lines.push('═══════════════════════════════════════════');
        lines.push('         照片智能筛选分析报告');
        lines.push('═══════════════════════════════════════════');
        lines.push('');
        lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}`);
        lines.push(`照片总数：${photos.length} 张`);
        lines.push('');

        const strong = photos.filter(p => p.level === 'strong');
        const recommend = photos.filter(p => p.level === 'recommend');
        const normal = photos.filter(p => p.level === 'normal');
        const reject = photos.filter(p => p.level === 'reject');

        lines.push('─── 统计概览 ───────────────────────────────');
        lines.push(`⭐⭐⭐ 强烈推荐：${strong.length} 张`);
        lines.push(`⭐⭐   推荐：    ${recommend.length} 张`);
        lines.push(`⭐     一般：    ${normal.length} 张`);
        lines.push(`❌     不推荐：  ${reject.length} 张`);
        lines.push('');

        const sorted = [...photos].sort((a, b) => b.score - a.score);

        lines.push('─── 详细评分 ───────────────────────────────');
        lines.push('');

        sorted.forEach((photo, index) => {
            const levelText = {
                strong: '大师之作',
                recommend: '优秀作品',
                normal: '中规中矩',
                reject: '需要改进',
            }[photo.level];

            lines.push(`${index + 1}. ${photo.name}`);
            lines.push(`   综合评分：${photo.score} 分 | 等级：${levelText}`);
            lines.push(`   清晰度：${photo.dimensions.sharpness} | 曝光：${photo.dimensions.exposure} | 对比度：${photo.dimensions.contrast} | 色彩：${photo.dimensions.color}`);
            lines.push(`   构图：${photo.dimensions.composition} | 主体：${photo.dimensions.subject} | 光影：${photo.dimensions.lighting} | 氛围：${photo.dimensions.mood}`);
            lines.push(`   点评：${photo.reason}`);
            if (photo.strengths && photo.strengths.length > 0) {
                lines.push(`   亮点：${photo.strengths.join(', ')}`);
            }
            if (photo.weaknesses && photo.weaknesses.length > 0) {
                lines.push(`   不足：${photo.weaknesses.join(', ')}`);
            }
            if (photo.suggestions && photo.suggestions.length > 0) {
                lines.push(`   建议：${photo.suggestions.join('; ')}`);
            }
            lines.push('');
        });

        lines.push('═══════════════════════════════════════════');
        lines.push('               报告结束');
        lines.push('═══════════════════════════════════════════');

        return lines.join('\n');
    }

    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    }
}
