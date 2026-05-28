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

    // 直接使用API Key（不推荐生产环境）
    const API_KEY = "ark-8b77d443-1d88-41b2-b6e8-8c568be3e573-6646f";

    try {
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
            model: "doubao-1-5-vision-pro-32k-250115",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: imageBase64
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
