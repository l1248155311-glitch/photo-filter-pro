export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageBase64, filename } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'Missing image data' });
    }

    const API_KEY = process.env.DOUBAO_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        // 先上传图片到临时托管服务获取URL
        const imageUrl = await uploadToTempHost(imageBase64);

        const prompt = `你是一位专业的摄影点评师。请对这张照片进行详细点评，包括：

1. **整体评价**（1-2句话总结）
2. **构图分析**（三分法、引导线、对称性、主体位置等）
3. **光影评价**（光线方向、质感、明暗对比）
4. **色彩表现**（饱和度、色调、白平衡）
5. **技术质量**（清晰度、曝光、噪点）
6. **情感表达**（氛围、故事感、感染力）
7. **改进建议**（2-3条具体建议）
8. **评分**（满分100分）

请用专业但易懂的语言点评，让人能学到摄影知识。`;

        const requestBody = {
            model: "doubao-1.5-vision-pro-250328",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl
                            }
                        },
                        {
                            type: "text",
                            text: prompt
                        }
                    ]
                }
            ],
            max_tokens: 2048
        };

        const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error:', errorText);
            return res.status(500).json({ 
                error: 'AI analysis failed', 
                details: errorText
            });
        }

        const data = await response.json();
        const review = data.choices[0].message.content;

        return res.status(200).json({
            success: true,
            filename: filename,
            review: review,
            usage: data.usage
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message
        });
    }
}

// 上传图片到临时托管服务
async function uploadToTempHost(base64Data) {
    // 使用 imgbb 免费API (无需注册)
    // 或者使用其他临时图片托管服务
    
    // 方案1：使用 transfer.sh (临时文件分享)
    try {
        const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
        const response = await fetch('https://transfer.sh/', {
            method: 'POST',
            body: buffer,
            headers: {
                'Content-Type': 'image/jpeg'
            }
        });
        
        if (response.ok) {
            const url = await response.text();
            return url.trim();
        }
    } catch (e) {
        console.log('transfer.sh failed, trying alternative...');
    }

    // 方案2：使用 base64 直接作为 data URL (某些API支持)
    return base64Data;
}
